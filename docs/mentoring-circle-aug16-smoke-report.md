# Mentoring Circle Webinar — August 16, 2026 Smoke Report

**Date tested:** 2026-08-06 (Pacific)  
**Scope:** Homepage promo, Stripe Checkout price wiring, post-payment Zoom redirect, confirmation email Zoom link  
**Status:** Ready for deploy (local/unit/API smoke passed; full live checkout not executed)

## Summary

The August 16 Mentoring Circle webinar is wired end-to-end in code:

1. Homepage promo card sits **above** the Regeneration Q&A Package card.
2. CTA opens **Stripe Checkout** directly (signed-in users) or routes through sign-up then auto-checkout.
3. Checkout uses Stripe Price ID `price_1U1crjAd5V3LaCqjFeK5s5oK` ($29.00 CAD).
4. After payment, success URL redirects the buyer to the Zoom registration page.
5. Existing Resend confirmation email (`mentoring_circle.confirmed`) includes the Zoom registration link.

## Event configuration

| Field | Value |
| --- | --- |
| Event ID | `2026-08-16` |
| Title | Mentoring Circle: The Prime State |
| Start | Sunday, August 16, 2026 · 9:30 AM America/Vancouver |
| Sales open | 2026-05-30 12:00 America/Vancouver |
| Display / booking amount | `$29 CAD` (`2900` cents; matches Stripe price) |
| Stripe Price ID | `price_1U1crjAd5V3LaCqjFeK5s5oK` |
| Zoom registration | https://us02web.zoom.us/meeting/register/B0evn6u1QMWwqKc-tWIXZw |
| Poster | `/images/mentoring-circle-banner-aug16.jpg` |

## What changed

- `apps/api/src/services/mentoringCircleService.ts` — added Aug 16 event + Zoom + Stripe price
- `apps/api/src/config/mentoringCircleBilling.ts` — resolve price from env override or event fallback
- `apps/api/src/services/paymentService.ts` — Mentoring Circle Checkout uses Stripe Price ID; success URL includes `redirect=zoom`
- `apps/web/src/routes/Home.tsx` — promo banner above Regeneration Q&A; Stripe CTA
- `apps/web/src/components/mentoring-circle/MentoringCircleCheckoutButton.tsx` — direct checkout / sign-up handoff
- `apps/web/src/routes/MentoringCircle.tsx` — autocheckout support, Zoom redirect after success, updated copy/poster
- `apps/web/public/images/mentoring-circle-banner-aug16.jpg` — promo art

## Smoke checks

| Check | Result | Evidence |
| --- | --- | --- |
| Unit tests (`mentoringCircleService`, `mentoringCircleBilling`) | PASS (11/11) | Node test runner |
| Notification template suite | PASS (16/16) | Includes Mentoring Circle confirmed template coverage |
| Active event on 2026-08-06 | PASS | Resolves `2026-08-16` with sales open |
| Stripe Price retrieve (live key) | PASS | `active=true`, `currency=cad`, `unit_amount=2900`, `type=one_time` |
| Zoom registration URL HTTP | PASS | `200` |
| Local homepage (`vite` / `:3000`) | PASS | `200` |
| Local promo image | PASS | `200`, `image/jpeg`, 350380 bytes |
| Homepage source order | PASS | `MentoringCirclePromoBanner` appears before `RegenerationOfferHomePanel` |
| Confirmation email Zoom CTA | PASS | Rendered subject + HTML includes Zoom URL and “Open Zoom Link” |
| Production deploy of this change | NOT YET | Production still serves SPA fallback for the new image path (`text/html` index), so deploy is required |

## Post-payment flow (verified in code)

1. Stripe Checkout success → `/mentoring-circle?checkout=success&redirect=zoom&eventId=2026-08-16&checkoutSessionId=...`
2. Client syncs checkout session / polls access
3. On confirmed access (or sync timeout with redirect flag), browser navigates to Zoom registration URL
4. Webhook path still calls `sendMentoringCircleConfirmedNotification` with `joinUrl = event.zoomLink` (Resend backup)

## Manual follow-ups after deploy

1. Confirm homepage shows Aug 16 card above Regeneration Q&A.
2. Signed-out: CTA → sign-up → returns with `autocheckout=1` → Stripe.
3. Signed-in: CTA → Stripe Checkout shows **$29 CAD**.
4. Complete a real/test purchase and confirm:
   - immediate Zoom registration redirect
   - Resend email contains the same Zoom link
5. Optional: set `STRIPE_LIVE_PRICE_MENTORING_CIRCLE=price_1U1crjAd5V3LaCqjFeK5s5oK` in production env (not required; event embeds the same fallback).

## Notes

- Event start time is set to **9:30 AM Pacific** to match prior Mentoring Circle scheduling; adjust if a different clock time is required.
- Full card-charge checkout was not completed in this smoke pass (would create a real live charge). Stripe Price validity was verified via the Stripe API instead.
