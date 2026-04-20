import type { Database } from "@wisdom/db";
import { createHttpError } from "./booking/errors.js";
import {
  confirmPayment,
  getReusablePaymentForEntity,
  type PaymentEntityType,
} from "./payments/paymentsService.js";
import { getAdminOrderById, parseOrderId, type AdminOrderType } from "./ordersService.js";

function orderTypeToPaymentEntity(type: AdminOrderType): PaymentEntityType | null {
  if (
    type === "report"
    || type === "session"
    || type === "subscription"
    || type === "mentor_training"
  ) {
    return type;
  }
  return null;
}

/**
 * Marks the order's linked payment as paid locally (no Stripe API call). Use when the client
 * paid off-platform or Stripe webhooks failed to sync.
 */
export async function markAdminOrderManualPaid(
  db: Database,
  input: { orderId: string; actorUserId: string; actorRole: string },
) {
  if (input.actorRole !== "admin") {
    throw createHttpError(403, "Admin access required");
  }

  const order = await getAdminOrderById(db, input.orderId);

  if (["paid", "completed", "refunded", "cancelled"].includes(order.status)) {
    throw createHttpError(400, `Order status "${order.status}" cannot be marked paid.`);
  }

  if (order.type === "custom") {
    throw createHttpError(400, "Manual mark-as-paid is not supported for custom orders.");
  }

  let paymentId = order.payment_id;

  if (!paymentId) {
    if (order.type === "webinar") {
      throw createHttpError(
        400,
        "No payment record is linked to this order. Mark as paid requires a matched payment row.",
      );
    }
    const entityType = orderTypeToPaymentEntity(order.type);
    if (!entityType) {
      throw createHttpError(400, "Manual mark-as-paid is not available for this order type.");
    }
    const parsed = parseOrderId(input.orderId);
    const payment = await getReusablePaymentForEntity(db, {
      entityType,
      entityId: parsed.sourceId,
    });
    if (!payment) {
      throw createHttpError(404, "No payment record found for this order.");
    }
    paymentId = payment.id;
  }

  await confirmPayment(db, {
    paymentId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    manual: true,
  });

  return getAdminOrderById(db, input.orderId);
}
