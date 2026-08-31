# Admin Emails — Gmail setup

Local-first Gmail contact recovery for Prime Mentor Admin. Do not register a production redirect or deploy this until it is explicitly ordered.

## Google Cloud

1. Create or choose a Google Cloud project.
2. Enable the **Gmail API**.
3. Configure the OAuth consent screen:
   - Prefer **Internal** for a Workspace project.
   - If External, add yourself as a test user.
   - Publish only when you are ready for production.
4. Create a **Web application** OAuth client.
5. Add the authorized redirect URI:
   - Local: `http://127.0.0.1:3001/api/admin/gmail/oauth/callback`
   - Production (document only, do not register until ordered): `https://api.theprimementor.com/api/admin/gmail/oauth/callback`

The redirect URI is read from `GOOGLE_GMAIL_REDIRECT_URI`. It is never taken from the request Host header.

## Environment

Set these on the local API only. Do not reuse unused Calendar `GOOGLE_*` scaffolding.

```bash
GOOGLE_GMAIL_CLIENT_ID=
GOOGLE_GMAIL_CLIENT_SECRET=
GOOGLE_GMAIL_REDIRECT_URI=http://127.0.0.1:3001/api/admin/gmail/oauth/callback
GMAIL_TOKEN_ENCRYPTION_KEY=   # 32-byte hex (64 hex characters)
GMAIL_OWNER_ALIASES=          # optional comma-separated owner/alias addresses
ADMIN_URL=http://127.0.0.1:5174
```

Generate an encryption key:

```bash
openssl rand -hex 32
```

Scope requested: `https://www.googleapis.com/auth/gmail.readonly` only. No send, modify, delete, or label scopes.

## Connect and disconnect

1. Open Admin at `http://127.0.0.1:5174/admin/emails`.
2. Click **Connect Gmail**. Google shows the consent screen.
3. Google redirects to the API callback, which stores encrypted tokens and then redirects to `/admin/emails?gmail=connected`.
4. Tokens never appear in the browser, logs, or JSON responses.
5. **Disconnect** decrypts the revocation credential in memory, deletes the local connection, then revokes at Google. If revoke fails, Admin shows a sanitized warning.

## Owner exclusion

The connected Gmail address plus `GMAIL_OWNER_ALIASES` are excluded from candidate results.

## Keyword import and filtration

1. Add shared exclusion filters on Emails: a full address (`noreply@service.com`) or a domain (`@facebook.com` / `facebook.com`).
2. Domain filters match that domain only. `@google.com` skips `ads@google.com` and does not skip `person@gmail.com`.
3. Enter a keyword such as `Adronis`, optionally pick a year, and click **Load 1,000 matches**. A year limits Gmail to that calendar year (`after:YYYY/01/01 before:YYYY+1/01/01`). Leave **All years** to search the whole mailbox. Up to 1,000 unique correspondents fill Candidate preview (100 per page). Addresses already on Contacts and exclusion-filter matches are omitted automatically. Use **Continue** for the next 1,000, then select one, the current page, or all loaded rows and **Add selected to Contacts**. **Remove** drops a row from this preview.
4. **Import matching contacts** still auto-saves eligible new addresses from the same 1,000-address batch and also fills the preview.
5. **Export CSV** downloads `email,first_name` only for AWeber.

Candidate preview and CSV import collapse the same address to one row (`Jane@X.com` and `jane@x.com` count as the same). CSV preview keeps only unique new addresses. Rows already on Contacts, repeats in the file, and exclusion-filter matches are omitted and are not imported again. The contacts table has a unique index on the normalized email.

## Production (later)

When ordered: add the production redirect URI on the Google client, set production env vars, migrate production, then deploy. Until then, keep this local-only.
