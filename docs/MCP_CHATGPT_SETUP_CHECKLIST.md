# MCP + ChatGPT Setup Checklist

## 1) Prepare env

Run:

```bash
cd "/Users/chetchung/edenchatbot and booking system 2026/EdenChatbotBooking"
npm run setup:mcp:oauth -- https://<your-mcp-domain>
```

This writes:

- `MCP_PUBLIC_BASE_URL`
- `MCP_AUTH_ISSUER_URL`
- `MCP_OAUTH_CLIENT_ID`
- `MCP_OAUTH_CLIENT_SECRET`

## 2) GitHub OAuth App

In GitHub -> Developer settings -> OAuth Apps -> New OAuth App:

- Application name: `Eden MCP GitHub`
- Homepage URL: `https://<your-mcp-domain>`
- Authorization callback URL: `https://<your-mcp-domain>/oauth/github/callback`

Copy generated credentials to `.env.local`:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

## 3) Start MCP server

```bash
npm run mcp:github
```

Health check:

- `https://<your-mcp-domain>/healthz`
- `https://<your-mcp-domain>/.well-known/oauth-authorization-server`
- `https://<your-mcp-domain>/.well-known/oauth-protected-resource/mcp`

## 4) Add in ChatGPT (新增應用程式)

- Name: `Eden GitHub MCP`
- MCP Server URL: `https://<your-mcp-domain>/mcp`
- Auth type: `OAuth`
- OAuth Client ID: value of `MCP_OAUTH_CLIENT_ID`
- OAuth Client Secret: value of `MCP_OAUTH_CLIENT_SECRET`

## 5) First live test

Ask ChatGPT:

- "List repos"
- "Read `README.md` from `CC9098/edenchatbot-booking`"
- "Create an issue titled test-mcp"

Then test write:

- low-risk file should `direct_push`
- high-risk path on `main` should `auto_pr`
