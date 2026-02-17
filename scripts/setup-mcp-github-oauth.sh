#!/usr/bin/env bash
set -euo pipefail

WORKDIR="/Users/chetchung/edenchatbot and booking system 2026/EdenChatbotBooking"
cd "$WORKDIR"

if [[ ! -f .env.local ]]; then
  touch .env.local
fi

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: scripts/setup-mcp-github-oauth.sh https://your-mcp-domain"
  echo "Example: scripts/setup-mcp-github-oauth.sh https://mcp.edenclinic.hk"
  exit 1
fi

BASE_URL="${BASE_URL%/}"
ISSUER_URL="$BASE_URL"
MCP_CLIENT_ID="mcp_chatgpt_$(openssl rand -hex 6)"
MCP_CLIENT_SECRET="$(openssl rand -hex 32)"

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env.local; then
    # macOS BSD sed
    sed -i '' "s|^${key}=.*|${key}=${value}|" .env.local
  else
    printf "%s=%s\n" "$key" "$value" >> .env.local
  fi
}

upsert_env "MCP_GITHUB_PORT" "3333"
upsert_env "MCP_PUBLIC_BASE_URL" "$BASE_URL"
upsert_env "MCP_AUTH_ISSUER_URL" "$ISSUER_URL"
upsert_env "MCP_OAUTH_CLIENT_ID" "$MCP_CLIENT_ID"
upsert_env "MCP_OAUTH_CLIENT_SECRET" "$MCP_CLIENT_SECRET"
upsert_env "MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS" "https://chatgpt.com,https://chat.openai.com"
upsert_env "MCP_ACCESS_TOKEN_TTL_SECONDS" "3600"
upsert_env "MCP_AUTH_CODE_TTL_SECONDS" "300"

if ! grep -q "^GITHUB_OAUTH_CLIENT_ID=" .env.local; then
  echo "GITHUB_OAUTH_CLIENT_ID=" >> .env.local
fi
if ! grep -q "^GITHUB_OAUTH_CLIENT_SECRET=" .env.local; then
  echo "GITHUB_OAUTH_CLIENT_SECRET=" >> .env.local
fi
if ! grep -q "^GITHUB_OAUTH_SCOPES=" .env.local; then
  echo "GITHUB_OAUTH_SCOPES=repo read:user" >> .env.local
fi

if ! grep -q "^GITHUB_ALLOWED_REPOS=" .env.local; then
  echo "GITHUB_ALLOWED_REPOS=CC9098/edenchatbot-booking" >> .env.local
fi
if ! grep -q "^GITHUB_PROTECTED_BRANCHES=" .env.local; then
  echo "GITHUB_PROTECTED_BRANCHES=main,master,production" >> .env.local
fi

echo ""
echo "Done. .env.local updated."
echo ""
echo "Use these in ChatGPT app setup:"
echo "- MCP URL: ${BASE_URL}/mcp"
echo "- OAuth Client ID: ${MCP_CLIENT_ID}"
echo "- OAuth Client Secret: ${MCP_CLIENT_SECRET}"
echo ""
echo "Create GitHub OAuth App with callback URL:"
echo "- ${BASE_URL}/oauth/github/callback"
echo ""
echo "Then set in .env.local:"
echo "- GITHUB_OAUTH_CLIENT_ID"
echo "- GITHUB_OAUTH_CLIENT_SECRET"
