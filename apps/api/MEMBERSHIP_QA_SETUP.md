# Membership QA Setup

Use this flow to make the local membership purchase pipeline testable without adding any auth bypasses to the app.

## 1. Create the Clerk dev user

The local app trusts real Clerk authentication. The demo account must exist in the Clerk development instance before QA can sign in.

Recommended local QA account:

- Email: `info@aetherx.co`
- Password: `sample123`
- First name: `Brad`
- Last name: `Jay`

Create that user in the Clerk development dashboard for the environment used by your local `CLERK_SECRET_KEY`.

## 2. Sync the local DB row

Once the Clerk user exists, run:

```bash
pnpm --filter @wisdom/api membership:test-user
```

That script will:

- verify the Clerk dev user exists
- refuse to run against a live Clerk secret
- upsert the local `users` row when `DATABASE_URL` is configured

## 3. Configure Stripe membership env vars

The API now fails loudly if any required Stripe membership env vars are missing:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_SEEKER_MONTHLY`
- `STRIPE_PRICE_INITIATE_MONTHLY`

Optional for future annual plans:

- `STRIPE_PRICE_SEEKER_ANNUAL`
- `STRIPE_PRICE_INITIATE_ANNUAL`

Also set:

- `FRONTEND_URL=http://localhost:3000`

## 4. Forward Stripe webhooks locally

Use Stripe CLI:

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

Copy the emitted signing secret into `STRIPE_WEBHOOK_SECRET`.

## 5. Run QA

1. Sign in through the local web app with the Clerk demo account.
2. Confirm the user starts on the free tier.
3. Go to `/membership-signup`.
4. Start a Seeker checkout.
5. Complete the payment with Stripe test card `4242 4242 4242 4242`.
6. Confirm the dashboard refreshes into the paid tier after redirect.
