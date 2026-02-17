# GitHub MCP Server (Hybrid Direct Push + OAuth)

This MCP server exposes GitHub tools and supports two modes:

- OAuth mode (recommended): ChatGPT authenticates to this server via OAuth, then this server authenticates user to GitHub OAuth.
- Static mode (fallback): uses a single `GITHUB_TOKEN` for all requests.

Hybrid write policy:

- Default behavior: direct push to target branch.
- Safety behavior: if a write is high-risk and targets a protected branch, it auto-creates `branch + PR`.

## Tools

- `github_list_repos`
- `github_get_file`
- `github_write_file`
- `github_create_issue`
- `github_create_pull_request`

## OAuth Flow (ChatGPT usable)

1. ChatGPT opens `/authorize` on this server.
2. This server redirects user to GitHub OAuth consent.
3. GitHub redirects back to `/oauth/github/callback`.
4. This server issues OAuth code to ChatGPT redirect URI.
5. ChatGPT exchanges code at `/token` and calls `/mcp` with Bearer token.

## Environment Variables

### Required for OAuth mode

```bash
MCP_GITHUB_PORT=3333
MCP_PUBLIC_BASE_URL=https://your-mcp-domain.com
MCP_AUTH_ISSUER_URL=https://your-mcp-domain.com

# ChatGPT -> this server OAuth client
MCP_OAUTH_CLIENT_ID=chatgpt_client_id
MCP_OAUTH_CLIENT_SECRET=chatgpt_client_secret
MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS=https://chatgpt.com,https://chat.openai.com

# this server -> GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=github_oauth_app_client_id
GITHUB_OAUTH_CLIENT_SECRET=github_oauth_app_client_secret
GITHUB_OAUTH_SCOPES=repo read:user

# optional hardening
GITHUB_ALLOWED_REPOS=CC9098/edenchatbot-booking
GITHUB_PROTECTED_BRANCHES=main,master,production
```

### Fallback static mode (no OAuth)

```bash
GITHUB_TOKEN=ghp_xxx
```

If OAuth vars are missing, server auto-falls back to static mode.

## Hybrid Risk Rules (v1)

`github_write_file` switches to auto-PR when all conditions match:

1. Target branch is protected (`GITHUB_PROTECTED_BRANCHES`)
2. At least one risk signal exists:
- Path matches a high-risk regex (`GITHUB_HIGH_RISK_PATH_PATTERNS` or defaults)
- Content contains destructive SQL keywords (`DROP TABLE`, `ALTER TABLE`, `TRUNCATE TABLE`)
- Content size >= 8000 chars
3. `allow_high_risk_direct_push` is not `true`

## Run

```bash
npm run mcp:github
npm run typecheck:mcp:github
```

## ChatGPT App Setup

In ChatGPT "新增應用程式":

- MCP Server URL: `https://your-mcp-domain.com/mcp`
- Auth type: OAuth
- OAuth Client ID: `MCP_OAUTH_CLIENT_ID`
- OAuth Client Secret: `MCP_OAUTH_CLIENT_SECRET`

Also add your callback URL from GitHub OAuth app settings:

- `https://your-mcp-domain.com/oauth/github/callback`

## Production Notes

- Deploy behind HTTPS.
- Restrict `GITHUB_ALLOWED_REPOS`.
- Keep protected branch list tight.
- Add persistent store (DB/Redis) for OAuth transactions and access tokens (current storage is in-memory).
