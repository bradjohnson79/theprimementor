# Isolated Express API and private recording storage

Nothing in this note was created. Production Render, the production database, and production CORS stay as they are.

## API

Use a second Render web service, or a Render preview built from `feat/star-initiation-session`, with its own `DATABASE_URL`. Prefer a Neon branch or a separate Postgres database. The API runs schema repair on boot, so that URL must not be the production database.

Point the preview site's `VITE_API_URL` at that API only. Allow CORS for the Vercel preview origin on that API only. Do not add the preview host to the production allowlist.

Use Stripe test keys, plus separate Resend and OpenAI keys. Leave `EXPRESS_CHECKOUT_ENABLED` and `EXPRESS_NOTIFICATIONS_ENABLED` off until a person turns them on for that service. Outbound mail then goes to the customer and to `ADMIN_EXPRESS_EMAIL`. Express does not use Twilio or SMS.

## Recordings

MP3 and transcript bytes need a private object bucket. This repo has no R2, S3, or Vercel Blob client. The upload API should accept a storage key from that bucket. The in-memory driver in `apps/api/src/services/express/privateRecordingStore.ts` is for tests only. Render disk is not acceptable for paid recordings.

Closest fit: Cloudflare R2 on the existing Cloudflare account, or a private bucket beside the API host. Public R2 list pricing checked for this proposal is about $0.015 per GB-month for storage, with no egress fee for standard R2 reads, and a free allocation on the order of 10 GB-month. A small Express catalog should stay under a few dollars a month until volume grows. Confirm the current price in the Cloudflare dashboard before creating the bucket.

## Reminders

Deadline reminders are Resend emails from a Render Cron Job on the isolated service. It calls `POST /api/internal/express/reminders` with the cron secret. The job sends the morning reminder, the afternoon reminder, and the overdue alert. Do not add that cron to the production Render service. Completed orders are skipped. A missed deadline is flagged for refund review. Automatic refunds are not part of this phase.

## Rough monthly cost before provisioning

- Render web service for the isolated API: about $7/month on the starter instance, or a preview if the workspace already includes one. Confirm in Render before creating it.
- Neon branch or separate database: the free/launch allowance may cover a low-traffic branch. Paid storage is a fraction of a dollar per GB-month. Confirm in Neon.
- R2: typically a few dollars or less at this volume, after the free allocation.
- Render Cron on that same service: confirm whether it is included or billed per job. Do not attach it to production.

No service, bucket, database, or cron was created for this proposal.
