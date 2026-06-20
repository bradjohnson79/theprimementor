# Prime Mentor Commerce Sync Audit

## Scope
- In scope: Prime Mentor session checkouts, Divin8 reports, membership subscriptions, Regeneration subscriptions, mentor training purchases, mentoring circle purchases, managed/admin invoices, manual admin mark-paid, refunds, Stripe webhooks, Admin Orders projection, and dry-run reconciliation.
- Out of scope: Amrita/RAYD8. No Prime Mentor local payment path was found for it in this codebase.
- Repair mode: dry-run only by default. Any live repair requires separate approval.

## Known Incident Root Cause
Incident records found in production:
- `cs_live_b1j8lp1kHK8rSXvsZKKRzv9WZ4gWES1RzB5zLViFhMkdT2R1b2NsEN6a0C` / `pi_3TjsjyAd5V3LaCqj11Aqrhld` for a 90 Minute Mentoring Session.
- `cs_live_b1ZQgFkHUerN56bpBpP6U34fQhlV7EUQcRYhDlCYJyZjObgpOEi0MU2OnL` / `pi_3TkRDeAd5V3LaCqj1raAPPcT` for a 90 Minute Mentoring Session.
- `cs_live_b1p3bJ0ViBsqvOZtf33SY9iR8d4ETHGCtvEBzasXdAb6GeuufkpA08wwjt` / `pi_3TjoJ7Ad5V3LaCqj19RpmqWM` for a 30 Minute Q&A Session.

Stripe showed each recent Checkout Session as `complete` and `paid`, with matching `checkout.session.completed` and `payment_intent.succeeded` events. Local `webhook_events` rows were present and `processed_at`, but local `payments.provider_payment_intent_id` remained null until an admin manually marked the order paid.

Failure classification: webhook processed but did not resolve/apply the local session payment state. The hardened fix adds a session-aware `payment_intent.succeeded` fallback that resolves by canonical metadata (`entityType=session`, `entityId`, `bookingId`) and marks the local payment and booking paid idempotently. This catches the same event order and fallback class even if checkout completion processing misses the local row.

Regression test: `apps/api/src/services/payments/stripeReconciliationService.test.ts` reproduces a paid mentoring-session intent with only metadata/local booking linkage and asserts the payment is promoted to paid with the Stripe Payment Intent ID.

Potential siblings query:
```sql
select p.id, p.booking_id, p.status, p.provider_payment_intent_id, p.metadata->>'stripeCheckoutSessionId' as checkout_session_id
from payments p
where p.entity_type = 'session'
  and p.status in ('pending', 'requires_payment', 'paid')
  and p.provider_payment_intent_id is null
  and p.metadata ? 'stripeCheckoutSessionId';
```

Dry-run result:
- Command: `pnpm reconcile:stripe --dry-run --type=session --from=2026-06-18`
- Scanned: 3
- Mismatches: 3
- Finding: all three are high-confidence `stripe_checkout_paid_local_missing_payment_intent` candidates. Local payment/booking status is already `paid` from manual repair, but local `payments.provider_payment_intent_id` is still null.
- Proposed action for each candidate: `attach_stripe_payment_intent_to_local_payment`.
- Live repair was not run.

## Payment Path Inventory
- Session checkout: `paymentService.ts` creates Checkout Sessions and local `payments` rows for booking-backed sessions. Webhooks and the new reconciliation helper update `payments` and `bookings`; Admin Orders project from `bookings` plus `payments`.
- Reports: `paymentService.ts`, `reportPurchaseService.ts`, `paymentsService.ts`, and `stripeWebhookService.ts` create checkout/payment rows, suppress duplicate pending reports, mark report payment paid, and queue Divin8 generation.
- Membership subscriptions: `paymentService.ts`, `stripeWebhookService.ts`, entitlement services, and member/admin subscription services sync Stripe subscription and invoice state into local `subscriptions` and entitlements.
- Regeneration subscriptions: `regenerationSubscriptionService.ts` owns checkout, invoice paid/failed, subscription updates/deletes, local projection, access state, and admin subscription projection.
- Mentor training: `paymentService.ts` and `paymentsService.ts` create local payments and promote `mentor_training_orders` to paid from webhook or manual confirmation.
- Mentoring circle: `paymentService.ts`, `bookingService.ts`, `mentoringCircleService.ts`, and webhook handlers confirm the booking and registration projection.
- Managed invoices: `invoiceService.ts`, webhook invoice handlers, and Admin Order invoice actions sync payment links, Checkout Sessions, payment intents, invoices, and persisted orders.
- Manual paid: `adminOrderPaymentService.ts` calls local-only `confirmPayment(...manual: true)` and marks metadata with `manuallyMarkedPaid`.
- Refunds: `orderRefundService.ts` handles admin-triggered Stripe refunds and local status updates; `charge.refunded` now reconciles Stripe-originated refunds back to local payments.

## Webhook Coverage
- Handled: `checkout.session.completed`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`, `payment_intent.payment_failed`, `payment_intent.succeeded`, `charge.failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Added/hardened: `checkout.session.expired`, `payment_intent.canceled`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
- Idempotency: `webhook_events.stripe_event_id`, advisory transaction locks, and monotonic local transitions prevent duplicate side effects.
- Remaining Stripe Dashboard checklist: confirm production endpoint and subscribed event list match the plan.

## Risk Assessment
- Highest risk before this change was paid one-time session checkouts leaving Admin Orders in pending/local-only state when the Payment Intent arrived before or independently of checkout reconciliation.
- Historical session rows with a paid Stripe Checkout Session and null `provider_payment_intent_id` may exist. Use the dry-run reconciliation script before any repair.
- Refund and dispute webhooks now annotate local payment state; order-source records are not destructively cancelled from external Stripe refund events.
- Live repair remains intentionally gated behind `--live` and must not be run without approval.
