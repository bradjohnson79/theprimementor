import {
  clients,
  invoices,
  orders,
  reports,
  stripeCustomers,
  subscriptions,
  webhookEvents,
  type Database,
} from "@wisdom/db";

export type DashboardStatus = "operational" | "active" | "degraded" | "error";
export type DashboardActivityKind = "order_completed" | "payment_failed" | "subscription_renewal" | "new_client";

export interface DashboardKpi {
  value: number;
  delta: number;
  delta_label: string;
  trend: "up" | "down" | "neutral";
}

export interface DashboardRevenuePoint {
  date: string;
  total: number;
}

export interface DashboardActivityItem {
  id: string;
  kind: DashboardActivityKind;
  title: string;
  detail: string;
  status: "success" | "failure" | "info";
  created_at: string;
}

export interface DashboardStatusItem {
  label: string;
  status: DashboardStatus;
  detail: string;
  value: string;
}

export interface AdminDashboardData {
  kpis: {
    total_clients: DashboardKpi;
    total_orders: DashboardKpi;
    revenue_this_month: DashboardKpi;
    active_subscriptions: DashboardKpi;
  };
  revenue_over_time: DashboardRevenuePoint[];
  recent_activity: DashboardActivityItem[];
  system_status: DashboardStatusItem[];
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDelta(delta: number, suffix: string) {
  if (delta === 0) return `No change ${suffix}`;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta} ${suffix}`;
}

function formatPercentDelta(current: number, previous: number) {
  if (previous === 0 && current === 0) {
    return { delta: 0, label: "No change vs last month", trend: "neutral" as const };
  }
  if (previous === 0) {
    return { delta: 100, label: "+100% vs last month", trend: "up" as const };
  }
  const raw = Math.round(((current - previous) / previous) * 100);
  const prefix = raw > 0 ? "+" : "";
  return {
    delta: raw,
    label: `${prefix}${raw}% vs last month`,
    trend: raw > 0 ? "up" as const : raw < 0 ? "down" as const : "neutral" as const,
  };
}

function getSubscriptionState(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).subscriptionStatus;
  return typeof value === "string" ? value : null;
}

export async function getAdminDashboardData(db: Database): Promise<AdminDashboardData> {
  const now = new Date();
  const today = startOfDay(now);
  const sevenDaysAgo = addDays(today, -6);
  const fourteenDaysAgo = addDays(today, -13);
  const monthStart = startOfMonth(now);
  const previousMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const thirtyDaysAgo = addDays(today, -29);
  const yesterday = addDays(today, -1);

  const [clientRows, orderRows, invoiceRows, webhookRows, reportRows, stripeCustomerRows, subscriptionRows] = await Promise.all([
    db.select({ id: clients.id, createdAt: clients.created_at }).from(clients),
    db.select({
      id: orders.id,
      type: orders.type,
      label: orders.label,
      amount: orders.amount,
      currency: orders.currency,
      status: orders.status,
      failureMessageNormalized: orders.failure_message_normalized,
      createdAt: orders.created_at,
    }).from(orders),
    db.select({
      id: invoices.id,
      label: invoices.label,
      billingMode: invoices.billing_mode,
      status: invoices.status,
      failureMessageNormalized: invoices.failure_message_normalized,
      lastPaymentAttemptAt: invoices.last_payment_attempt_at,
      paidAt: invoices.paid_at,
      metadata: invoices.metadata,
      createdAt: invoices.created_at,
    }).from(invoices),
    db.select({
      id: webhookEvents.id,
      eventType: webhookEvents.stripe_event_type,
      processedAt: webhookEvents.processed_at,
      createdAt: webhookEvents.created_at,
    }).from(webhookEvents),
    db.select({
      id: reports.id,
      status: reports.status,
      meta: reports.meta,
      updatedAt: reports.updated_at,
      createdAt: reports.created_at,
    }).from(reports),
    db.select({
      id: stripeCustomers.id,
    }).from(stripeCustomers),
    db.select({
      id: subscriptions.id,
      stripeSubscriptionId: subscriptions.stripe_subscription_id,
      status: subscriptions.status,
    }).from(subscriptions),
  ]);

  const clientsThisWeek = clientRows.filter((row) => row.createdAt >= sevenDaysAgo).length;
  const clientsPrevWeek = clientRows.filter((row) => row.createdAt >= fourteenDaysAgo && row.createdAt < sevenDaysAgo).length;
  const clientDelta = clientsThisWeek - clientsPrevWeek;

  const ordersThisWeek = orderRows.filter((row) => row.createdAt >= sevenDaysAgo).length;
  const ordersPrevWeek = orderRows.filter((row) => row.createdAt >= fourteenDaysAgo && row.createdAt < sevenDaysAgo).length;
  const orderDelta = ordersThisWeek - ordersPrevWeek;

  const revenueThisMonthCents = orderRows
    .filter((row) => row.status === "completed" && row.createdAt >= monthStart)
    .reduce((sum, row) => sum + row.amount, 0);
  const revenueLastMonthCents = orderRows
    .filter((row) => row.status === "completed" && row.createdAt >= previousMonthStart && row.createdAt < monthStart)
    .reduce((sum, row) => sum + row.amount, 0);
  const revenueDelta = formatPercentDelta(revenueThisMonthCents, revenueLastMonthCents);

  const activeSubscriptions = invoiceRows.filter((row) =>
    row.billingMode === "subscription"
      && (getSubscriptionState(row.metadata) === "active" || getSubscriptionState(row.metadata) === "trialing"),
  ).length;
  const newSubscriptionsThisWeek = invoiceRows.filter((row) => row.billingMode === "subscription" && row.createdAt >= sevenDaysAgo).length;
  const newSubscriptionsPrevWeek = invoiceRows.filter((row) =>
    row.billingMode === "subscription" && row.createdAt >= fourteenDaysAgo && row.createdAt < sevenDaysAgo,
  ).length;
  const subscriptionDelta = newSubscriptionsThisWeek - newSubscriptionsPrevWeek;

  const revenueMap = new Map<string, number>();
  for (let index = 0; index < 30; index += 1) {
    const day = addDays(thirtyDaysAgo, index);
    revenueMap.set(startOfDay(day).toISOString().slice(0, 10), 0);
  }
  for (const row of orderRows) {
    if (row.status !== "completed" || row.createdAt < thirtyDaysAgo) continue;
    const key = startOfDay(row.createdAt).toISOString().slice(0, 10);
    if (!revenueMap.has(key)) continue;
    revenueMap.set(key, (revenueMap.get(key) ?? 0) + row.amount / 100);
  }
  const revenue_over_time = Array.from(revenueMap.entries()).map(([date, total]) => ({ date, total }));

  const recentActivity: DashboardActivityItem[] = [
    ...orderRows
      .filter((row) => row.status === "completed" && row.type !== "subscription_renewal")
      .map((row) => ({
        id: `order_${row.id}`,
        kind: "order_completed" as const,
        title: "Order completed",
        detail: row.label,
        status: "success" as const,
        created_at: row.createdAt.toISOString(),
      })),
    ...orderRows
      .filter((row) => row.status === "completed" && row.type === "subscription_renewal")
      .map((row) => ({
        id: `renewal_${row.id}`,
        kind: "subscription_renewal" as const,
        title: "Subscription renewal",
        detail: row.label,
        status: "success" as const,
        created_at: row.createdAt.toISOString(),
      })),
    ...invoiceRows
      .filter((row) => row.status === "failed" && row.lastPaymentAttemptAt)
      .map((row) => ({
        id: `failed_${row.id}`,
        kind: "payment_failed" as const,
        title: "Payment failed",
        detail: row.failureMessageNormalized ?? row.label,
        status: "failure" as const,
        created_at: (row.lastPaymentAttemptAt ?? row.createdAt).toISOString(),
      })),
    ...clientRows.map((row) => ({
      id: `client_${row.id}`,
      kind: "new_client" as const,
      title: "New client",
      detail: "Client record created",
      status: "info" as const,
      created_at: row.createdAt.toISOString(),
    })),
  ]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 10);

  const failedPaymentsLast24h = invoiceRows.filter((row) =>
    row.status === "failed" && (row.lastPaymentAttemptAt ?? row.createdAt) >= yesterday,
  ).length;
  const activePaymentLinks = invoiceRows.filter((row) =>
    row.status === "pending" && row.createdAt >= thirtyDaysAgo,
  ).length;
  const expiredPaymentLinks = invoiceRows.filter((row) => row.status === "expired").length;
  const pendingSubscriptionInvoices = invoiceRows.filter((row) =>
    row.billingMode === "subscription" && row.status === "pending",
  ).length;
  const activeSubscriptionRows = subscriptionRows.filter((row) => row.status === "active" || row.status === "trialing").length;
  const pastDueSubscriptionRows = subscriptionRows.filter((row) => row.status === "past_due" || row.status === "unpaid").length;
  const incompleteSubscriptionRows = subscriptionRows.filter((row) => row.status === "incomplete" || row.status === "incomplete_expired").length;
  const subscriptionRenewalsLast30d = orderRows.filter((row) =>
    row.type === "subscription_renewal" && row.status === "completed" && row.createdAt >= thirtyDaysAgo,
  ).length;
  const missingStripeCustomerMappings = Math.max(0, invoiceRows.length - stripeCustomerRows.length);
  const unprocessedWebhookRows = webhookRows.filter((row) => !row.processedAt);
  const paymentFailureWebhookCount24h = webhookRows.filter((row) =>
    row.createdAt >= yesterday
      && (
        row.eventType === "payment_intent.payment_failed"
        || row.eventType === "charge.failed"
        || row.eventType === "checkout.session.async_payment_failed"
        || row.eventType === "invoice.payment_failed"
      ),
  ).length;
  const checkoutCompletedWebhookCount24h = webhookRows.filter((row) =>
    row.createdAt >= yesterday && row.eventType === "checkout.session.completed",
  ).length;
  const completedOrdersLast24h = orderRows.filter((row) => row.status === "completed" && row.createdAt >= yesterday).length;
  const paymentsStatus: DashboardStatusItem =
    failedPaymentsLast24h >= 5 && completedOrdersLast24h === 0
      ? {
        label: "Payments system",
        status: "error",
        detail: "Recent failures are outpacing successful orders.",
        value: `${failedPaymentsLast24h} failed`,
      }
      : failedPaymentsLast24h > 0
        ? {
          label: "Payments system",
          status: "degraded",
          detail: "Payments are processing, but failures need review.",
          value: `${failedPaymentsLast24h} failed`,
        }
        : {
          label: "Payments system",
          status: "operational",
          detail: "Recent invoice and order flow looks healthy.",
          value: `${completedOrdersLast24h} completed / 24h`,
        };

  const paymentLinksStatus: DashboardStatusItem =
    expiredPaymentLinks > 0
      ? {
        label: "Stripe Payment Links",
        status: "degraded",
        detail: "Some invoice links have expired and may need regeneration.",
        value: `${activePaymentLinks} active / ${expiredPaymentLinks} expired`,
      }
      : {
        label: "Stripe Payment Links",
        status: activePaymentLinks > 0 ? "active" : "operational",
        detail: activePaymentLinks > 0
          ? "Pending invoice links are currently available to clients."
          : "No pending payment links are waiting for payment.",
        value: `${activePaymentLinks} active`,
      };

  const checkoutStatus: DashboardStatusItem =
    paymentFailureWebhookCount24h > checkoutCompletedWebhookCount24h && paymentFailureWebhookCount24h > 0
      ? {
        label: "Stripe Checkout",
        status: "degraded",
        detail: "Checkout failures are currently outpacing successful completions.",
        value: `${checkoutCompletedWebhookCount24h} complete / ${paymentFailureWebhookCount24h} failed`,
      }
      : {
        label: "Stripe Checkout",
        status: checkoutCompletedWebhookCount24h > 0 ? "active" : "operational",
        detail: checkoutCompletedWebhookCount24h > 0
          ? "Checkout completions are being recorded from Stripe webhooks."
          : "No recent checkout completions in the last 24 hours.",
        value: `${checkoutCompletedWebhookCount24h} completed / 24h`,
      };

  const subscriptionStatus: DashboardStatusItem =
    pastDueSubscriptionRows > 0 || incompleteSubscriptionRows > 0
      ? {
        label: "Stripe Subscriptions",
        status: "degraded",
        detail: "Some subscriptions need payment or onboarding attention.",
        value: `${activeSubscriptionRows} active / ${pastDueSubscriptionRows + incompleteSubscriptionRows} attention`,
      }
      : {
        label: "Stripe Subscriptions",
        status: activeSubscriptionRows > 0 || pendingSubscriptionInvoices > 0 ? "active" : "operational",
        detail: activeSubscriptionRows > 0
          ? "Subscription billing and renewal sync are healthy."
          : "No active subscriptions are currently tracked.",
        value: `${activeSubscriptionRows} active / ${subscriptionRenewalsLast30d} renewals`,
      };

  const customerSyncStatus: DashboardStatusItem =
    missingStripeCustomerMappings > 0
      ? {
        label: "Stripe Customer Sync",
        status: "degraded",
        detail: "Some invoice records do not yet have a matching Stripe customer mapping.",
        value: `${stripeCustomerRows.length} mapped / ${missingStripeCustomerMappings} pending`,
      }
      : {
        label: "Stripe Customer Sync",
        status: stripeCustomerRows.length > 0 ? "active" : "operational",
        detail: stripeCustomerRows.length > 0
          ? "Stored Stripe customers are available for reuse."
          : "No Stripe customer mappings have been created yet.",
        value: `${stripeCustomerRows.length} mapped`,
      };

  const latestWebhook = webhookRows
    .filter((row) => row.processedAt)
    .sort((left, right) => (right.processedAt?.getTime() ?? 0) - (left.processedAt?.getTime() ?? 0))[0];
  const pendingWebhooks = webhookRows.filter((row) => !row.processedAt).length;
  const webhookStatus: DashboardStatusItem = pendingWebhooks > 0
    ? {
      label: "Webhook status",
      status: "degraded",
      detail: "Some Stripe events are still waiting to be processed.",
      value: `${pendingWebhooks} pending / ${unprocessedWebhookRows.length} queued`,
    }
    : {
      label: "Webhook status",
      status: latestWebhook ? "operational" : "active",
      detail: latestWebhook
        ? `Last processed ${latestWebhook.eventType}.`
        : "No webhook events have been recorded yet.",
      value: latestWebhook?.processedAt?.toISOString() ?? "No events",
    };

  const failedPaymentsStatus: DashboardStatusItem = {
    label: "Failed payments",
    status: failedPaymentsLast24h > 0 ? "degraded" : "operational",
    detail: failedPaymentsLast24h > 0
      ? "Review invoice failures and regenerate links as needed."
      : "No failed payments in the last 24 hours.",
    value: `${failedPaymentsLast24h} / 24h`,
  };

  const recentDivin8Failures = reportRows.filter((row) => {
    const meta = row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? row.meta as Record<string, unknown>
      : null;
    const executionState = typeof meta?.execution_state === "string" ? meta.execution_state : null;
    return (row.updatedAt ?? row.createdAt) >= yesterday && (executionState === "failed" || row.status === "failed");
  }).length;
  const activeDivin8Runs = reportRows.filter((row) => {
    const meta = row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? row.meta as Record<string, unknown>
      : null;
    const executionState = typeof meta?.execution_state === "string" ? meta.execution_state : null;
    return executionState === "generating" || row.status === "generating";
  }).length;
  const divin8Status: DashboardStatusItem = recentDivin8Failures > 0
    ? {
      label: "Divin8 Engine",
      status: "degraded",
      detail: "Recent generation failures need review.",
      value: `${recentDivin8Failures} failed / 24h`,
    }
    : activeDivin8Runs > 0
      ? {
        label: "Divin8 Engine",
        status: "active",
        detail: "Readings are currently running.",
        value: `${activeDivin8Runs} active`,
      }
      : {
        label: "Divin8 Engine",
        status: "operational",
        detail: "No recent generation failures detected.",
        value: "Ready",
      };

  return {
    kpis: {
      total_clients: {
        value: clientRows.length,
        delta: clientDelta,
        delta_label: formatDelta(clientDelta, "this week"),
        trend: clientDelta > 0 ? "up" : clientDelta < 0 ? "down" : "neutral",
      },
      total_orders: {
        value: orderRows.length,
        delta: orderDelta,
        delta_label: formatDelta(orderDelta, "this week"),
        trend: orderDelta > 0 ? "up" : orderDelta < 0 ? "down" : "neutral",
      },
      revenue_this_month: {
        value: revenueThisMonthCents / 100,
        delta: revenueDelta.delta,
        delta_label: revenueDelta.label,
        trend: revenueDelta.trend,
      },
      active_subscriptions: {
        value: activeSubscriptions,
        delta: subscriptionDelta,
        delta_label: formatDelta(subscriptionDelta, "new this week"),
        trend: subscriptionDelta > 0 ? "up" : subscriptionDelta < 0 ? "down" : "neutral",
      },
    },
    revenue_over_time,
    recent_activity: recentActivity,
    system_status: [
      paymentsStatus,
      paymentLinksStatus,
      checkoutStatus,
      subscriptionStatus,
      customerSyncStatus,
      webhookStatus,
      failedPaymentsStatus,
      divin8Status,
    ],
  };
}
