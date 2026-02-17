import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { Octokit } from "@octokit/rest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type RepoRef = { owner: string; repo: string };

type RiskDecision = {
  decision: "direct_push" | "auto_pr";
  signals: string[];
  protectedBranch: boolean;
};

type EncodedOAuthState = {
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  scope: string;
  iat: number;
  exp: number;
};

type EncodedAuthorizationCode = {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  githubAccessToken: string;
  subject: string;
  iat: number;
  exp: number;
};

type EncodedAccessToken = {
  clientId: string;
  scopes: string[];
  githubAccessToken: string;
  subject: string;
  iat: number;
  exp: number;
};

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

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseRegexList(candidatePatterns: string[], fallbackPatterns: string[]): RegExp[] {
  const source = candidatePatterns.length > 0 ? candidatePatterns : fallbackPatterns;
  const result: RegExp[] = [];

  for (const pattern of source) {
    try {
      result.push(new RegExp(pattern));
    } catch {
      // ignore invalid regex
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
  return { owner: owner.trim(), repo: repo.trim() };
}

function repoKey(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

function getSecretKey(): Buffer {
  const source =
    process.env.MCP_OAUTH_CODE_SECRET ||
    process.env.MCP_OAUTH_CLIENT_SECRET ||
    process.env.GITHUB_OAUTH_CLIENT_SECRET ||
    "";

  if (!source) {
    throw new Error("Missing MCP_OAUTH_CODE_SECRET or fallback client secret for token encryption");
  }

  return createHash("sha256").update(source).digest();
}

function sealPayload(payload: object): string {
  const key = getSecretKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

function unsealPayload<T>(token: string): T {
  const [ivB64, cipherB64, tagB64] = token.split(".");
  if (!ivB64 || !cipherB64 || !tagB64) {
    throw new Error("Invalid sealed token format");
  }

  const key = getSecretKey();
  const iv = Buffer.from(ivB64, "base64url");
  const encrypted = Buffer.from(cipherB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

function assertRepoAllowed(owner: string, repo: string): void {
  const allowlistRaw = process.env.GITHUB_ALLOWED_REPOS ?? "";
  const allowlist = new Set(parseCsv(allowlistRaw).map((entry) => entry.toLowerCase()));

  if (allowlist.size === 0) {
    return;
  }

  const key = repoKey(owner, repo);
  const wildcardKey = `${owner.toLowerCase()}/*`;
  if (!allowlist.has(key) && !allowlist.has(wildcardKey)) {
    throw new Error(`Repository ${owner}/${repo} blocked by GITHUB_ALLOWED_REPOS`);
  }
}

function assessRisk(params: {
  targetBranch: string;
  path: string;
  content: string;
  allowHighRiskDirectPush: boolean;
}): RiskDecision {
  const protectedBranches = parseCsv(process.env.GITHUB_PROTECTED_BRANCHES ?? "main,master,production").map(
    (branch) => branch.toLowerCase(),
  );

  const highRiskPatterns = parseRegexList(
    parseCsv(process.env.GITHUB_HIGH_RISK_PATH_PATTERNS ?? ""),
    DEFAULT_HIGH_RISK_PATH_PATTERNS,
  );

  const signals: string[] = [];
  const branch = params.targetBranch.toLowerCase();
  const protectedBranch = protectedBranches.includes(branch);

  if (protectedBranch) {
    if (highRiskPatterns.some((pattern) => pattern.test(params.path))) {
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

function getGithubClient(githubAccessToken: string): Octokit {
  return new Octokit({
    auth: githubAccessToken,
    baseUrl: process.env.GITHUB_API_BASE_URL ?? "https://api.github.com",
  });
}

async function getDefaultBranch(client: Octokit, repoRef: RepoRef): Promise<string> {
  const response = await client.request("GET /repos/{owner}/{repo}", {
    owner: repoRef.owner,
    repo: repoRef.repo,
  });

  return response.data.default_branch ?? "main";
}

async function getFileSha(
  client: Octokit,
  params: { owner: string; repo: string; path: string; ref?: string },
): Promise<string | null> {
  try {
    const response = await client.request("GET /repos/{owner}/{repo}/contents/{path}", params);
    if (Array.isArray(response.data)) {
      throw new Error(`${params.path} is a directory`);
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
  params: { owner: string; repo: string; baseBranch: string; newBranch: string },
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

export function getCodeChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createOAuthMetadata(baseUrl: string) {
  const origin = new URL(baseUrl).origin;
  return {
    issuer: `${origin}/`,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    grant_types_supported: ["authorization_code"],
    scopes_supported: ["mcp:tools"],
  };
}

export function createProtectedResourceMetadata(baseUrl: string) {
  const origin = new URL(baseUrl).origin;
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [`${origin}/`],
    scopes_supported: ["mcp:tools"],
    resource_name: "GitHub Hybrid MCP",
  };
}

export function encodeOAuthState(payload: Omit<EncodedOAuthState, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  return sealPayload({
    ...payload,
    iat: now,
    exp: now + 600,
  });
}

export function decodeOAuthState(token: string): EncodedOAuthState {
  const decoded = unsealPayload<EncodedOAuthState>(token);
  if (decoded.exp < Date.now() / 1000) {
    throw new Error("OAuth state expired");
  }
  return decoded;
}

export function encodeAuthorizationCode(payload: Omit<EncodedAuthorizationCode, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(process.env.MCP_AUTH_CODE_TTL_SECONDS ?? "300");
  return sealPayload({
    ...payload,
    iat: now,
    exp: now + ttl,
  });
}

export function decodeAuthorizationCode(token: string): EncodedAuthorizationCode {
  const decoded = unsealPayload<EncodedAuthorizationCode>(token);
  if (decoded.exp < Date.now() / 1000) {
    throw new Error("Authorization code expired");
  }
  return decoded;
}

export function encodeAccessToken(payload: Omit<EncodedAccessToken, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(process.env.MCP_ACCESS_TOKEN_TTL_SECONDS ?? "3600");
  return sealPayload({
    ...payload,
    iat: now,
    exp: now + ttl,
  });
}

export function decodeAccessToken(token: string): EncodedAccessToken {
  const decoded = unsealPayload<EncodedAccessToken>(token);
  if (decoded.exp < Date.now() / 1000) {
    throw new Error("Access token expired");
  }
  return decoded;
}

export function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function isOAuthModeEnabled(): boolean {
  return Boolean(
    process.env.MCP_OAUTH_CLIENT_ID &&
      process.env.MCP_OAUTH_CLIENT_SECRET &&
      process.env.GITHUB_OAUTH_CLIENT_ID &&
      process.env.GITHUB_OAUTH_CLIENT_SECRET,
  );
}

export function createMcpServer(githubAccessToken: string): McpServer {
  const githubClient = getGithubClient(githubAccessToken);

  const server = new McpServer(
    {
      name: "github-hybrid-write-server",
      version: "0.3.0",
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
      description: "List repositories available to this GitHub identity.",
      inputSchema: {
        owner: z.string().optional(),
        visibility: z.enum(["all", "public", "private"]).default("all"),
        per_page: z.number().int().min(1).max(100).default(30),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ owner, visibility, per_page }) => {
      let repos: Array<{ owner: string; repo: string; private: boolean; defaultBranch: string }> = [];

      if (owner) {
        const response = await githubClient.request("GET /users/{username}/repos", {
          username: owner,
          per_page,
          sort: "updated",
        });

        repos = response.data
          .filter((item) => (visibility === "all" ? true : visibility === "private" ? item.private : !item.private))
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

      const allowlistRaw = process.env.GITHUB_ALLOWED_REPOS ?? "";
      const allowlist = new Set(parseCsv(allowlistRaw).map((entry) => entry.toLowerCase()));
      if (allowlist.size > 0) {
        repos = repos.filter((r) => {
          const key = repoKey(r.owner, r.repo);
          const wildcard = `${r.owner.toLowerCase()}/*`;
          return allowlist.has(key) || allowlist.has(wildcard);
        });
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
        ref: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
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
                message: "Path resolves to non-file content",
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
        head: z.string(),
        base: z.string(),
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
        "Write a file. Default direct push; if high-risk on protected branch, auto branch + PR.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        content: z.string(),
        commit_message: z.string(),
        branch: z.string().optional(),
        expected_sha: z.string().optional(),
        pr_title: z.string().optional(),
        pr_body: z.string().optional(),
        allow_high_risk_direct_push: z.boolean().default(false),
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
