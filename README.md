# Authlete Study Session 2026-02

Development bootstrap for hosting the oauth-server and mcp-server over HTTP for iterative work. 

## Requirements

- Node.js runtime (>= 18)
- [ngrok CLI](https://ngrok.com/download) – Authlete requires the authorization server to be reachable via HTTPS, so ngrok (or an equivalent public HTTPS tunnel) is mandatory even for local work.

## Install

```bash
npm install
```

## Configuration

Copy the sample environment file and adjust it to match your Authlete/ngrok setup:

```bash
cp .env.example .env
# then edit .env
```

All server processes automatically load `.env` via `dotenv`, so the values you set there will apply to both `npm run dev` and the Playwright tests later on.

## Local HTTP development

```bash
npm run dev
```

- oauth-server: http://localhost:9000
- mcp-server: http://localhost:9001 (protected with OAuth Bearer tokens; stays on localhost/HTTP)

Environment overrides:

- `OAUTH_PORT` / `MCP_PORT`
- `OAUTH_SERVER_ISSUER` (defaults to `http://localhost:9000`; set to your ngrok HTTPS OAuth URL for Authlete)
- `MCP_BASE_URL` (defaults to `http://localhost:${MCP_PORT}`; OAuth audience is `${MCP_BASE_URL}/mcp`)
- `AUTH_SECRET` (required by `@hono/session` to encrypt the login session cookie)
- `MCP_SCOPES` (comma-separated list, defaults to `mcp.echo`)
- `MCP_SERVICE_DOCUMENTATION_URL` (optional URL linked from metadata)
- `MCP_RESOURCE_NAME`, `MCP_SERVER_NAME`, `MCP_SERVER_VERSION` (optional display strings)

## Exposing oauth-server via ngrok CLI

1. Start the local servers:

   ```bash
   npm run dev
   ```

2. In another terminal, authenticate ngrok (one-time setup):

   ```bash
   ngrok config add-authtoken <your-token>
   ```

3. Expose only the oauth-server (port `9000`):

   ```bash
   ngrok http 9000
   ```

The CLI prints an `https://*.ngrok-free.app` URL that proxies to `http://localhost:9000`. Share that URL for external testing while keeping the MCP server private. Stop ngrok with `Ctrl+C` when finished.

> **Note:** Because Authlete will call back to the authorization server over HTTPS, ensure this ngrok URL is configured anywhere Authlete expects the issuer/endpoint origins.

## OAuth-protected MCP server

- `@hono/mcp`'s `simpleMcpAuthRouter` serves all `/.well-known` resources, pointing clients to the local MCP endpoint (`${MCP_BASE_URL}/mcp`, default `http://localhost:9001/mcp`).
- Every request under `/mcp` must include `Authorization: Bearer <token>`. Tokens are validated with the OAuth server’s JWKS: the MCP server auto-discovers `jwks_uri` from `${OAUTH_SERVER_ISSUER}/.well-known/oauth-authorization-server` (falling back to `.well-known/openid-configuration`) and enforces `audience`/`scope`. Failures (missing/invalid tokens or insufficient scope) return RFC 6750-compliant `WWW-Authenticate` headers so clients know how to recover.
- `@modelcontextprotocol/sdk` powers the MCP Echo tool (`mcp.echo`). Extend `/apps/mcp-server/src/mcp` with additional tools as you expand coverage.

## File layout

- `apps/oauth-server/src/index.ts`: minimal OAuth endpoints (HTTP stub)
- `apps/mcp-server/src/index.ts`: bearer-protected MCP Echo stub
