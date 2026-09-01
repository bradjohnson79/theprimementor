# Admin Ads Intelligence

Admin Ads Command Center and Ads Agent for Prime Mentor Admin. Production API is Render; Admin is Vercel.

## What this includes

- Admin navigation: **Ads**
- Command Center, Campaigns, Keyword Strategy (PMA), Settings, Divin8 Intelligence, Campaign Lab, and remaining placeholders
- Right-side Ads Agent drawer talking only to OpenRouter through the Prime Mentor API
- In-app Google Ads OAuth, encrypted refresh-token storage, and READ_ONLY reporting
- Isolated `ads_*` tables applied locally only

## Ads Agent inference

The browser never talks to OpenRouter. There is no Ollama, OpenAI, Anthropic, or Gemini fallback.

```text
Ads Drawer → POST /api/admin/ads/agent/chat (202 enqueue)
  → background generateAdsAgentReply → OpenRouter z-ai/glm-5.3-flash
  → GET conversation poll until assistant message
```

The HTTP request does not wait for the model. That avoids Cloudflare 524s and the secondary missing-CORS error on timed-out origin responses.

Layered Ads memory lives in `ads_agent_memories` (workspace, owner decisions, campaign, screenshot, performance). New conversation clears the transcript only.

When Google Ads is `READ_ONLY`, the agent may call controlled read-only tools. It never receives refresh tokens, access tokens, or the developer token.

## Google Ads OAuth

```text
Settings Connect → GET /api/admin/ads/google/oauth/start → Google consent
  → GET /api/admin/ads/google/oauth/callback → encrypted refresh token
  → Google Ads API validate → READ_ONLY
```

Live reporting uses Google Ads API `v25`. Validation always refreshes the access token first. A test-only developer token stays `DISCONNECTED` and Settings shows Google's rejection.

Exact local redirect URI (never taken from the request Host header):

```text
http://127.0.0.1:3001/api/admin/ads/google/oauth/callback
```

Production redirect URI (must be registered on the Google Cloud web client and set as `GOOGLE_ADS_REDIRECT_URI` on Render):

```text
https://api.theprimementor.com/api/admin/ads/google/oauth/callback
```

Add the local URI to the Prime Mentor Ads web client in Google Cloud before the first live Connect.

Scope: `https://www.googleapis.com/auth/adwords` only, with `access_type=offline` and `prompt=consent`.

The refresh token is stored encrypted in `ads_google_connections`. It is never written to `.env`, returned to the browser, or logged.

Environment (local API only; never put these in Admin `VITE_*` vars):

```bash
OPENROUTER_API_KEY=
ADS_AGENT_MODEL=z-ai/glm-5.3-flash
OPENROUTER_HTTP_REFERER=
OPENROUTER_APP_TITLE=Prime Mentor Ads Agent
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_REDIRECT_URI=http://127.0.0.1:3001/api/admin/ads/google/oauth/callback
ADS_TOKEN_ENCRYPTION_KEY=
```

`GOOGLE_ADS_REFRESH_TOKEN` is unused. Do not put the refresh token in env.

Settings shows Configured / Not configured flags, the advertising account `405-845-9597`, and the manager account `860-469-0994`. It never shows secrets.

## Local database

Apply locally only:

- `packages/db/drizzle/20260831_ads_intelligence.sql`
- `packages/db/drizzle/20260901_ads_google_oauth.sql`
- `packages/db/drizzle/20260903_ads_agent_memory.sql`

Do not add these tables to `schemaRepairService.ts`. Apply the SQL files on the target Neon branch before relying on Ads Agent memory.

The `ads_agent_settings.ollama_url` column is leftover from the first local-AI pass and is no longer the authority for inference.

## Capability modes

- Disconnected until OAuth + Ads API validation succeed
- Current live mode: `READ_ONLY`
- Later writes: `CONTROLLED_WRITE` with Proposal → Review → Owner Approval → Execute
