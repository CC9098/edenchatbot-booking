import { createHash, randomBytes, randomUUID } from "node:crypto";

import dotenv from "dotenv";
import express from "express";
import { Octokit } from "@octokit/rest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

dotenv.config({ path: ".env.local" });
dotenv.config();

type RepoRef = {
  owner: string;
  repo: string;
};

type RiskDecision = {
  decision: "direct_push" | "auto_pr";
  signals: string[];
  protectedBranch: boolean;
};

type SessionContext = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  subject: string;
};

type GithubAuthTx = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
  createdAt: number;
};

type AuthCodeRecord = {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  githubAccessToken: string;
  subject: string;
  expiresAt: number;
};

type AccessTokenRecord = {
  clientId: string;
  scopes: string[];
  expiresAt: number;
  githubAccessToken: string;
  subject: string;
};

const MCP_PORT = Number(process.env.MCP_GITHUB_PORT ?? process.env.MCP_PORT ?? "3333");
const MCP_PUBLIC_BASE_URL = process.env.MCP_PUBLIC_BASE_URL ?? `http://localhost:${MCP_PORT}`;
const MCP_AUTH_ISSUER_URL = process.env.MCP_AUTH_ISSUER_URL ?? MCP_PUBLIC_BASE_URL;
const MCP_RESOURCE_URL = new URL("/mcp", MCP_PUBLIC_BASE_URL);

const OAUTH_CLIENT_ID = process.env.MCP_OAUTH_CLIENT_ID ?? "";
const OAUTH_CLIENT_SECRET = process.env.MCP_OAUTH_CLIENT_SECRET ?? "";
const OAUTH_ALLOWED_REDIRECT_ORIGINS = parseCsv(process.env.MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS ?? "");
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.MCP_ACCESS_TOKEN_TTL_SECONDS ?? "3600");
const AUTH_CODE_TTL_SECONDS = Number(process.env.MCP_AUTH_CODE_TTL_SECONDS ?? "300");

const GITHUB_OAUTH_CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID ?? "";
const GITHUB_OAUTH_CLIENT_SECRET = process.env.GITHUB_OAUTH_CLIENT_SECRET ?? "";
const GITHUB_OAUTH_SCOPES = process.env.GITHUB_OAUTH_SCOPES ?? "repo read:user";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_API_BASE_URL = process.env.GITHUB_API_BASE_URL ?? "https://api.github.com";
const GITHUB_AUTH_URL = process.env.GITHUB_AUTH_URL ?? "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = process.env.GITHUB_TOKEN_URL ?? "https://github.com/login/oauth/access_token";

const OAUTH_ENABLED =
  Boolean(OAUTH_CLIENT_ID) &&
  Boolean(OAUTH_CLIENT_SECRET) &&
  Boolean(GITHUB_OAUTH_CLIENT_ID) &&
  Boolean(GITHUB_OAUTH_CLIENT_SECRET);

if (!OAUTH_ENABLED && !GITHUB_TOKEN) {
  throw new Error(
    "Missing credentials. Set OAuth env vars (MCP_OAUTH_* + GITHUB_OAUTH_*) or fallback GITHUB_TOKEN.",
  );
}

const GITHUB_PROTECTED_BRANCHES = parseCsv(
  process.env.GITHUB_PROTECTED_BRANCHES ?? "main,master,production",
).map((branch) => branch.toLowerCase());

const DEFAULT_HIGH_RISK_PATH_PATTERNS = [
  "^\\.github/workflows/",
  "^supabase/migrations/",
  "^drizzle\\.config\\.ts$",
  "^package\\.json$",
  "^package-lock\\.json$",
  "^vercel\\.json$",
  "^next\\.config\\.",
  "^\\.env",
];

const HIGH_RISK_PATH_PATTERNS = parseRegexList(
  parseCsv(process.env.GITHUB_HIGH_RISK_PATH_PATTERNS ?? ""),
  DEFAULT_HIGH_RISK_PATH_PATTERNS,
);
const REPO_ALLOWLIST = parseRepoAllowlist(process.env.GITHUB_ALLOWED_REPOS ?? "");

const githubAuthTransactions = new Map<string, GithubAuthTx>();
const authCodes = new Map<string, AuthCodeRecord>();
const accessTokens = new Map<string, AccessTokenRecord>();

const staticOctokit = !OAUTH_ENABLED
  ? new Octokit({
      auth: GITHUB_TOKEN,
      baseUrl: GITHUB_API_BASE_URL,
    })
  : null;

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseRepoAllowlist(raw: string): Set<string> {
  const values = parseCsv(raw).map((entry) => entry.toLowerCase());
  return new Set(values);
}

function parseRegexList(candidatePatterns: string[], fallbackPatterns: string[]): RegExp[] {
  const source = candidatePatterns.length > 0 ? candidatePatterns : fallbackPatterns;
  const result: RegExp[] = [];

  for (const pattern of source) {
    try {
      result.push(new RegExp(pattern));
    } catch (error) {
      console.warn(`[mcp-github] Ignoring invalid regex pattern: ${pattern}`, error);
    }
  }

  return result;
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").trim();
}

function sanitizeBranchFragment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/[\/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function parseRepoRef(owner: string, repo: string): RepoRef {
  return {
    owner: owner.trim(),
    repo: repo.trim(),
  };
}

function repoKey(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

function assertRepoAllowed(owner: string, repo: string): void {
  if (REPO_ALLOWLIST.size === 0) {
    return;
  }

  const key = repoKey(owner, repo);
  const wildcardKey = `${owner.toLowerCase()}/*`;
  if (!REPO_ALLOWLIST.has(key) && !REPO_ALLOWLIST.has(wildcardKey)) {
    throw new Error(
      `Repository ${owner}/${repo} is blocked by GITHUB_ALLOWED_REPOS allowlist.`,
    );
  }
}

function assessRisk(params: {
  targetBranch: string;
  path: string;
  content: string;
  allowHighRiskDirectPush: boolean;
}): RiskDecision {
  const signals: string[] = [];
  const branch = params.targetBranch.toLowerCase();
  const protectedBranch = GITHUB_PROTECTED_BRANCHES.includes(branch);

  if (protectedBranch) {
    if (HIGH_RISK_PATH_PATTERNS.some((pattern) => pattern.test(params.path))) {
      signals.push("path_matches_high_risk_pattern");
    }

    const destructiveSqlRegex = /\b(drop\s+table|alter\s+table|truncate\s+table)\b/i;
    if (destructiveSqlRegex.test(params.content)) {
      signals.push("content_contains_destructive_sql");
    }

    if (params.content.length >= 8000) {
      signals.push("content_too_large_for_safe_direct_push");
    }
  }

  const shouldAutoPr = protectedBranch && signals.length > 0 && !params.allowHighRiskDirectPush;

  return {
    decision: shouldAutoPr ? "auto_pr" : "direct_push",
    signals,
    protectedBranch,
  };
}

function getSessionIdFromHeaders(headers: Record<string, unknown>): string | null {
  const value = headers["mcp-session-id"];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return null;
}

function parseBearerToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function getCodeChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function isRedirectUriAllowed(uri: string): boolean {
  if (OAUTH_ALLOWED_REDIRECT_ORIGINS.length === 0) {
    return true;
  }

  try {
    const parsed = new URL(uri);
    return OAUTH_ALLOWED_REDIRECT_ORIGINS.includes(parsed.origin);
  } catch {
    return false;
  }
}

function createGithubClient(githubAccessToken: string): Octokit {
  return new Octokit({
    auth: githubAccessToken,
    baseUrl: GITHUB_API_BASE_URL,
  });
}

async function getDefaultBranch(client: Octokit, { owner, repo }: RepoRef): Promise<string> {
  const response = await client.request("GET /repos/{owner}/{repo}", {
    owner,
    repo,
  });

  return response.data.default_branch ?? "main";
}

async function getFileSha(
  client: Octokit,
  params: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  },
): Promise<string | null> {
  try {
    const response = await client.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: params.owner,
      repo: params.repo,
      path: params.path,
      ref: params.ref,
    });

    if (Array.isArray(response.data)) {
      throw new Error(`${params.path} is a directory, expected a file path.`);
    }

    return response.data.sha ?? null;
  } catch (error) {
    if (typeof error === "object" && error && "status" in error && error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function upsertFile(
  client: Octokit,
  params: {
    owner: string;
    repo: string;
    path: string;
    content: string;
    message: string;
    branch: string;
    expectedSha?: string;
  },
): Promise<{ commitSha: string; contentSha: string }> {
  const currentSha =
    params.expectedSha ??
    (await getFileSha(client, {
      owner: params.owner,
      repo: params.repo,
      path: params.path,
      ref: params.branch,
    }));

  const response = await client.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    branch: params.branch,
    message: params.message,
    content: Buffer.from(params.content, "utf8").toString("base64"),
    sha: currentSha ?? undefined,
  });

  return {
    commitSha: response.data.commit.sha ?? "",
    contentSha: response.data.content?.sha ?? "",
  };
}

async function createBranchFromBase(
  client: Octokit,
  params: {
    owner: string;
    repo: string;
    baseBranch: string;
    newBranch: string;
  },
): Promise<void> {
  const baseRef = await client.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
    owner: params.owner,
    repo: params.repo,
    ref: `heads/${params.baseBranch}`,
  });

  await client.request("POST /repos/{owner}/{repo}/git/refs", {
    owner: params.owner,
    repo: params.repo,
    ref: `refs/heads/${params.newBranch}`,
    sha: baseRef.data.object.sha,
  });
}

function buildHybridBranchName(path: string): string {
  const fragment = sanitizeBranchFragment(path) || "change";
  return `mcp-auto/${fragment}-${Date.now()}`;
}

function createServer(githubClient: Octokit): McpServer {
  const server = new McpServer(
    {
      name: "github-hybrid-write-server",
      version: "0.2.0",
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  server.registerTool(
    "github_list_repos",
    {
      description:
        "List repositories available to the caller GitHub token. If allowlist is set, only allowlisted repos are returned.",
      inputSchema: {
        owner: z.string().optional().describe("Optional owner/org to filter by"),
        visibility: z.enum(["all", "public", "private"]).default("all"),
        per_page: z.number().int().min(1).max(100).default(30),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ owner, visibility, per_page }) => {
      let repos: Array<{ owner: string; repo: string; private: boolean; defaultBranch: string }> = [];
      const seenRepoKeys = new Set<string>();

      if (REPO_ALLOWLIST.size > 0) {
        for (const allowed of REPO_ALLOWLIST) {
          if (allowed.endsWith("/*")) {
            const allowOwner = allowed.replace(/\/\*$/, "");
            if (!allowOwner || (owner && allowOwner !== owner.toLowerCase())) {
              continue;
            }

            let ownerRepos:
              | Array<{ owner: { login: string }; name: string; private: boolean; default_branch?: string }>
              | null = null;

            try {
              const orgResponse = await githubClient.request("GET /orgs/{org}/repos", {
                org: allowOwner,
                per_page,
                type: visibility === "all" ? "all" : visibility,
                sort: "updated",
              });
              ownerRepos = orgResponse.data.map((item) => ({
                owner: { login: item.owner.login },
                name: item.name,
                private: item.private,
                default_branch: item.default_branch ?? "main",
              }));
            } catch {
              try {
                const userResponse = await githubClient.request("GET /users/{username}/repos", {
                  username: allowOwner,
                  per_page,
                  sort: "updated",
                });
                ownerRepos = userResponse.data
                  .filter((item) => {
                    if (visibility === "all") {
                      return true;
                    }
                    return visibility === "private" ? item.private : !item.private;
                  })
                  .map((item) => ({
                    owner: { login: item.owner.login },
                    name: item.name,
                    private: item.private,
                    default_branch: item.default_branch ?? "main",
                  }));
              } catch {
                ownerRepos = null;
              }
            }

            if (!ownerRepos) {
              continue;
            }

            for (const repoItem of ownerRepos) {
              const key = repoKey(repoItem.owner.login, repoItem.name);
              if (seenRepoKeys.has(key)) {
                continue;
              }
              seenRepoKeys.add(key);
              repos.push({
                owner: repoItem.owner.login,
                repo: repoItem.name,
                private: repoItem.private,
                defaultBranch: repoItem.default_branch ?? "main",
              });
            }
            continue;
          }

          const [allowOwner, allowRepo] = allowed.split("/");
          if (!allowOwner || !allowRepo || (owner && allowOwner !== owner.toLowerCase())) {
            continue;
          }

          try {
            const response = await githubClient.request("GET /repos/{owner}/{repo}", {
              owner: allowOwner,
              repo: allowRepo,
            });

            const key = repoKey(response.data.owner.login, response.data.name);
            if (seenRepoKeys.has(key)) {
              continue;
            }
            seenRepoKeys.add(key);

            repos.push({
              owner: response.data.owner.login,
              repo: response.data.name,
              private: response.data.private,
              defaultBranch: response.data.default_branch ?? "main",
            });
          } catch {
            // ignore inaccessible repos
          }
        }
      } else if (owner) {
        const response = await githubClient.request("GET /users/{username}/repos", {
          username: owner,
          per_page,
          sort: "updated",
        });

        repos = response.data
          .filter((item) => {
            if (visibility === "all") {
              return true;
            }
            return visibility === "private" ? item.private : !item.private;
          })
          .map((item) => ({
            owner: item.owner.login,
            repo: item.name,
            private: item.private,
            defaultBranch: item.default_branch ?? "main",
          }));
      } else {
        const response = await githubClient.request("GET /user/repos", {
          visibility,
          per_page,
          sort: "updated",
        });

        repos = response.data.map((item) => ({
          owner: item.owner.login,
          repo: item.name,
          private: item.private,
          defaultBranch: item.default_branch ?? "main",
        }));
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ total: repos.length, repos }) }],
      };
    },
  );

  server.registerTool(
    "github_get_file",
    {
      description: "Read a file from a GitHub repository branch.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        ref: z.string().optional().describe("Branch, tag or commit SHA"),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ owner, repo, path, ref }) => {
      const repoRef = parseRepoRef(owner, repo);
      assertRepoAllowed(repoRef.owner, repoRef.repo);

      const normalizedPath = normalizePath(path);
      const response = await githubClient.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner: repoRef.owner,
        repo: repoRef.repo,
        path: normalizedPath,
        ref,
      });

      if (Array.isArray(response.data)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                kind: "directory",
                path: normalizedPath,
                entries: response.data.map((entry) => ({
                  name: entry.name,
                  path: entry.path,
                  type: entry.type,
                })),
              }),
            },
          ],
        };
      }

      if (response.data.type !== "file") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                kind: response.data.type,
                path: response.data.path,
                message: "Path resolves to non-file content (submodule/symlink).",
              }),
            },
          ],
        };
      }

      const content =
        response.data.encoding === "base64"
          ? Buffer.from(response.data.content ?? "", "base64").toString("utf8")
          : response.data.content ?? "";

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              kind: "file",
              owner: repoRef.owner,
              repo: repoRef.repo,
              path: response.data.path,
              sha: response.data.sha,
              size: response.data.size,
              ref: ref ?? null,
              content,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "github_create_issue",
    {
      description: "Create a GitHub issue in a repository.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        body: z.string().optional(),
      },
    },
    async ({ owner, repo, title, body }) => {
      const repoRef = parseRepoRef(owner, repo);
      assertRepoAllowed(repoRef.owner, repoRef.repo);

      const response = await githubClient.request("POST /repos/{owner}/{repo}/issues", {
        owner: repoRef.owner,
        repo: repoRef.repo,
        title,
        body,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              issueNumber: response.data.number,
              url: response.data.html_url,
              state: response.data.state,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "github_create_pull_request",
    {
      description: "Create a pull request from head branch into base branch.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        head: z.string().describe("Source branch name"),
        base: z.string().describe("Target branch name"),
        body: z.string().optional(),
      },
    },
    async ({ owner, repo, title, head, base, body }) => {
      const repoRef = parseRepoRef(owner, repo);
      assertRepoAllowed(repoRef.owner, repoRef.repo);

      const response = await githubClient.request("POST /repos/{owner}/{repo}/pulls", {
        owner: repoRef.owner,
        repo: repoRef.repo,
        title,
        head,
        base,
        body,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              pullNumber: response.data.number,
              url: response.data.html_url,
              state: response.data.state,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "github_write_file",
    {
      description:
        "Write a single file change. Default is direct push. If high-risk change is detected on a protected branch, it auto-creates branch + PR.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        content: z.string().describe("Full new file content"),
        commit_message: z.string(),
        branch: z.string().optional().describe("Target branch; default: repository default branch"),
        expected_sha: z.string().optional().describe("Optional optimistic concurrency sha"),
        pr_title: z.string().optional(),
        pr_body: z.string().optional(),
        allow_high_risk_direct_push: z
          .boolean()
          .default(false)
          .describe("Set true to bypass auto-PR safety for high-risk changes"),
      },
    },
    async ({
      owner,
      repo,
      path,
      content,
      commit_message,
      branch,
      expected_sha,
      pr_title,
      pr_body,
      allow_high_risk_direct_push,
    }) => {
      const repoRef = parseRepoRef(owner, repo);
      assertRepoAllowed(repoRef.owner, repoRef.repo);

      const normalizedPath = normalizePath(path);
      const targetBranch = branch ?? (await getDefaultBranch(githubClient, repoRef));
      const risk = assessRisk({
        targetBranch,
        path: normalizedPath,
        content,
        allowHighRiskDirectPush: allow_high_risk_direct_push,
      });

      if (risk.decision === "direct_push") {
        const writeResult = await upsertFile(githubClient, {
          owner: repoRef.owner,
          repo: repoRef.repo,
          path: normalizedPath,
          content,
          message: commit_message,
          branch: targetBranch,
          expectedSha: expected_sha,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                mode: "direct_push",
                owner: repoRef.owner,
                repo: repoRef.repo,
                path: normalizedPath,
                branch: targetBranch,
                commitSha: writeResult.commitSha,
                contentSha: writeResult.contentSha,
                protectedBranch: risk.protectedBranch,
                riskSignals: risk.signals,
              }),
            },
          ],
        };
      }

      const workingBranch = buildHybridBranchName(normalizedPath);
      await createBranchFromBase(githubClient, {
        owner: repoRef.owner,
        repo: repoRef.repo,
        baseBranch: targetBranch,
        newBranch: workingBranch,
      });

      const writeResult = await upsertFile(githubClient, {
        owner: repoRef.owner,
        repo: repoRef.repo,
        path: normalizedPath,
        content,
        message: commit_message,
        branch: workingBranch,
      });

      const prResponse = await githubClient.request("POST /repos/{owner}/{repo}/pulls", {
        owner: repoRef.owner,
        repo: repoRef.repo,
        title: pr_title ?? `[auto-pr] ${commit_message}`,
        body:
          pr_body ??
          `Auto-created because high-risk change was detected.\\n\\nRisk signals: ${risk.signals.join(", ")}`,
        head: workingBranch,
        base: targetBranch,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              mode: "auto_pr",
              owner: repoRef.owner,
              repo: repoRef.repo,
              path: normalizedPath,
              baseBranch: targetBranch,
              workingBranch,
              commitSha: writeResult.commitSha,
              contentSha: writeResult.contentSha,
              riskSignals: risk.signals,
              pullNumber: prResponse.data.number,
              pullUrl: prResponse.data.html_url,
            }),
          },
        ],
      };
    },
  );

  return server;
}

const app = createMcpExpressApp();
app.use(express.urlencoded({ extended: false }));

if (OAUTH_ENABLED) {
  const oauthMetadata = {
    issuer: new URL(MCP_AUTH_ISSUER_URL).href,
    authorization_endpoint: new URL("/authorize", MCP_PUBLIC_BASE_URL).href,
    token_endpoint: new URL("/token", MCP_PUBLIC_BASE_URL).href,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    grant_types_supported: ["authorization_code"],
    scopes_supported: ["mcp:tools"],
  };

  app.use(
    mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl: MCP_RESOURCE_URL,
      scopesSupported: ["mcp:tools"],
      resourceName: "GitHub Hybrid MCP",
    }),
  );

  app.get("/authorize", (req, res) => {
    const responseType = typeof req.query.response_type === "string" ? req.query.response_type : "";
    const clientId = typeof req.query.client_id === "string" ? req.query.client_id : "";
    const redirectUri = typeof req.query.redirect_uri === "string" ? req.query.redirect_uri : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const codeChallenge =
      typeof req.query.code_challenge === "string" ? req.query.code_challenge : "";
    const codeChallengeMethod =
      typeof req.query.code_challenge_method === "string" ? req.query.code_challenge_method : "";
    const scope = typeof req.query.scope === "string" ? req.query.scope : "mcp:tools";

    if (responseType !== "code") {
      res.status(400).send("Unsupported response_type");
      return;
    }

    if (clientId !== OAUTH_CLIENT_ID) {
      res.status(401).send("Invalid client_id");
      return;
    }

    if (!redirectUri || !isRedirectUriAllowed(redirectUri)) {
      res.status(400).send("Invalid redirect_uri");
      return;
    }

    if (!codeChallenge || codeChallengeMethod !== "S256") {
      res.status(400).send("PKCE S256 is required");
      return;
    }

    const authTxId = randomUUID();
    githubAuthTransactions.set(authTxId, {
      clientId,
      redirectUri,
      state,
      codeChallenge,
      scope,
      createdAt: Date.now(),
    });

    const githubAuthorizeUrl = new URL(GITHUB_AUTH_URL);
    githubAuthorizeUrl.searchParams.set("client_id", GITHUB_OAUTH_CLIENT_ID);
    githubAuthorizeUrl.searchParams.set(
      "redirect_uri",
      new URL("/oauth/github/callback", MCP_PUBLIC_BASE_URL).href,
    );
    githubAuthorizeUrl.searchParams.set("scope", GITHUB_OAUTH_SCOPES);
    githubAuthorizeUrl.searchParams.set("state", authTxId);

    res.redirect(githubAuthorizeUrl.href);
  });

  app.get("/oauth/github/callback", async (req, res) => {
    const githubCode = typeof req.query.code === "string" ? req.query.code : "";
    const authTxId = typeof req.query.state === "string" ? req.query.state : "";
    const tx = githubAuthTransactions.get(authTxId);
    githubAuthTransactions.delete(authTxId);

    if (!githubCode || !tx) {
      res.status(400).send("Invalid OAuth callback");
      return;
    }

    try {
      const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: GITHUB_OAUTH_CLIENT_ID,
          client_secret: GITHUB_OAUTH_CLIENT_SECRET,
          code: githubCode,
          redirect_uri: new URL("/oauth/github/callback", MCP_PUBLIC_BASE_URL).href,
        }),
      });

      if (!tokenResponse.ok) {
        const text = await tokenResponse.text();
        throw new Error(`GitHub token exchange failed: ${text}`);
      }

      const tokenJson = (await tokenResponse.json()) as {
        access_token?: string;
      };

      if (!tokenJson.access_token) {
        throw new Error("GitHub token exchange returned no access_token");
      }

      const userClient = createGithubClient(tokenJson.access_token);
      const me = await userClient.request("GET /user");
      const subject = String(me.data.id);

      const authCode = randomBytes(32).toString("hex");
      authCodes.set(authCode, {
        clientId: tx.clientId,
        redirectUri: tx.redirectUri,
        scope: tx.scope,
        codeChallenge: tx.codeChallenge,
        githubAccessToken: tokenJson.access_token,
        subject,
        expiresAt: Math.floor(Date.now() / 1000) + AUTH_CODE_TTL_SECONDS,
      });

      const redirect = new URL(tx.redirectUri);
      redirect.searchParams.set("code", authCode);
      if (tx.state) {
        redirect.searchParams.set("state", tx.state);
      }

      res.redirect(redirect.href);
    } catch (error) {
      console.error("[mcp-github] GitHub callback error", error);
      res.status(500).send("OAuth exchange failed");
    }
  });

  app.post("/token", (req, res) => {
    const grantType = typeof req.body.grant_type === "string" ? req.body.grant_type : "";
    const code = typeof req.body.code === "string" ? req.body.code : "";
    const redirectUri = typeof req.body.redirect_uri === "string" ? req.body.redirect_uri : "";
    const clientId = typeof req.body.client_id === "string" ? req.body.client_id : "";
    const clientSecret = typeof req.body.client_secret === "string" ? req.body.client_secret : "";
    const codeVerifier = typeof req.body.code_verifier === "string" ? req.body.code_verifier : "";

    if (grantType !== "authorization_code") {
      res.status(400).json({ error: "unsupported_grant_type" });
      return;
    }

    if (clientId !== OAUTH_CLIENT_ID || clientSecret !== OAUTH_CLIENT_SECRET) {
      res.status(401).json({ error: "invalid_client" });
      return;
    }

    const record = authCodes.get(code);
    authCodes.delete(code);

    if (!record) {
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    if (record.expiresAt < Date.now() / 1000) {
      res.status(400).json({ error: "invalid_grant", error_description: "Code expired" });
      return;
    }

    if (record.clientId !== clientId || record.redirectUri !== redirectUri) {
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    if (!codeVerifier || getCodeChallengeFromVerifier(codeVerifier) !== record.codeChallenge) {
      res.status(400).json({ error: "invalid_grant", error_description: "PKCE validation failed" });
      return;
    }

    const accessToken = randomBytes(32).toString("hex");
    const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;

    accessTokens.set(accessToken, {
      clientId,
      scopes: record.scope.split(" ").filter(Boolean),
      expiresAt,
      githubAccessToken: record.githubAccessToken,
      subject: record.subject,
    });

    res.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: record.scope,
    });
  });
}

const authMiddleware = OAUTH_ENABLED
  ? requireBearerAuth({
      verifier: {
        verifyAccessToken: async (token) => {
          const record = accessTokens.get(token);
          if (!record) {
            throw new InvalidTokenError("Invalid token");
          }

          return {
            token,
            clientId: record.clientId,
            scopes: record.scopes,
            expiresAt: record.expiresAt,
          };
        },
      },
      requiredScopes: ["mcp:tools"],
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(MCP_RESOURCE_URL),
    })
  : null;

const sessions: Record<string, SessionContext> = {};

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "github-hybrid-write-server", oauthEnabled: OAUTH_ENABLED });
});

const mcpPostHandler = async (req: express.Request, res: express.Response): Promise<void> => {
  const sessionId = getSessionIdFromHeaders(req.headers as Record<string, unknown>);

  if (sessionId) {
    const session = sessions[sessionId];
    if (!session) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: `Unknown session id: ${sessionId}`,
        },
        id: null,
      });
      return;
    }

    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  if (!isInitializeRequest(req.body)) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Initialization request required when session id is missing.",
      },
      id: null,
    });
    return;
  }

  let githubClient: Octokit;
  let subject = "static-token";

  if (OAUTH_ENABLED) {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Missing bearer token",
        },
        id: null,
      });
      return;
    }

    const accessRecord = accessTokens.get(token);
    if (!accessRecord) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Invalid bearer token",
        },
        id: null,
      });
      return;
    }

    githubClient = createGithubClient(accessRecord.githubAccessToken);
    subject = accessRecord.subject;
  } else {
    githubClient = staticOctokit as Octokit;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (initializedSessionId) => {
      sessions[initializedSessionId] = {
        transport,
        server,
        subject,
      };
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      delete sessions[sid];
    }
  };

  const server = createServer(githubClient);
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
};

const mcpGetHandler = async (req: express.Request, res: express.Response): Promise<void> => {
  const sessionId = getSessionIdFromHeaders(req.headers as Record<string, unknown>);

  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send("Missing or invalid mcp-session-id");
    return;
  }

  await sessions[sessionId].transport.handleRequest(req, res);
};

const mcpDeleteHandler = async (req: express.Request, res: express.Response): Promise<void> => {
  const sessionId = getSessionIdFromHeaders(req.headers as Record<string, unknown>);

  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send("Missing or invalid mcp-session-id");
    return;
  }

  await sessions[sessionId].transport.handleRequest(req, res);
};

if (authMiddleware) {
  app.post("/mcp", authMiddleware, (req, res) => {
    void mcpPostHandler(req, res).catch((error) => {
      console.error("[mcp-github] POST /mcp error", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    });
  });

  app.get("/mcp", authMiddleware, (req, res) => {
    void mcpGetHandler(req, res).catch((error) => {
      console.error("[mcp-github] GET /mcp error", error);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    });
  });

  app.delete("/mcp", authMiddleware, (req, res) => {
    void mcpDeleteHandler(req, res).catch((error) => {
      console.error("[mcp-github] DELETE /mcp error", error);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    });
  });
} else {
  app.post("/mcp", (req, res) => {
    void mcpPostHandler(req, res).catch((error) => {
      console.error("[mcp-github] POST /mcp error", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    });
  });

  app.get("/mcp", (req, res) => {
    void mcpGetHandler(req, res).catch((error) => {
      console.error("[mcp-github] GET /mcp error", error);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    });
  });

  app.delete("/mcp", (req, res) => {
    void mcpDeleteHandler(req, res).catch((error) => {
      console.error("[mcp-github] DELETE /mcp error", error);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    });
  });
}

app.listen(MCP_PORT, (error?: Error) => {
  if (error) {
    console.error("[mcp-github] failed to start server", error);
    process.exit(1);
  }

  console.log(`[mcp-github] listening on ${new URL('/mcp', MCP_PUBLIC_BASE_URL).href}`);
  if (OAUTH_ENABLED) {
    console.log(`[mcp-github] OAuth issuer: ${MCP_AUTH_ISSUER_URL}`);
  } else {
    console.log("[mcp-github] running in static token mode (no OAuth)");
  }
});
