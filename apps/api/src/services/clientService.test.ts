import assert from "node:assert/strict";
import test from "node:test";
import type { AdminOrder } from "./ordersService.js";
import { buildAdminClientsResult } from "./clientService.js";

function makeOrder(input: {
  id: string;
  userId: string;
  email: string;
  clientName: string;
  amount: number;
  status: AdminOrder["status"];
  createdAt: string;
}): AdminOrder {
  return {
    id: input.id,
    source_id: input.id,
    user_id: input.userId,
    archived: false,
    client_name: input.clientName,
    email: input.email,
    type: "session",
    status: input.status,
    amount: input.amount,
    currency: "CAD",
    stripe_payment_id: null,
    payment_status: null,
    payment_id: null,
    payment_provider: null,
    created_at: input.createdAt,
    membership_tier: null,
    available_actions: [],
    execution: {
      state: "idle",
      report_id: null,
      last_generation_error: null,
      last_attempt_timestamp: null,
      generation_started_at: null,
      generation_completed_at: null,
      duration_ms: null,
      version: null,
      output: null,
    },
    recording_link: null,
    recording_added_at: null,
    refunded_at: null,
    refund_reason: null,
    refund_note: null,
    metadata: {
      source_status: null,
      source_created_at: input.createdAt,
      birth_date: null,
      birth_time: null,
      birth_location: null,
      intake: {
        birth_date: null,
        birth_time: null,
        location: null,
        submitted_questions: [],
        notes: null,
      },
      report_type: null,
      report_type_id: null,
      training_package: null,
      training_package_id: null,
      selected_systems: [],
      delivery_status: null,
      session_type: null,
      scheduled_at: null,
      meeting_link: null,
      plan_name: null,
      billing_cycle: null,
      renewal_date: null,
      event_name: null,
      event_date: null,
      access_link: null,
      stripe_subscription_id: null,
      billing_mode: null,
      invoice_id: null,
      invoice_status: null,
      invoice_link: null,
      invoice_expires_at: null,
      invoice_paid_at: null,
      invoice_consumed_at: null,
      order_variant: null,
      invoice_label: null,
      subscription_state: null,
      failure_code: null,
      failure_message: null,
      failure_message_normalized: null,
      last_payment_attempt_at: null,
      payment_match_strategy: null,
    },
  };
}

test("buildAdminClientsResult aggregates canonical orders by user", () => {
  const result = buildAdminClientsResult({
    userRows: [
      { id: "user-1", email: "alpha@example.com", createdAt: new Date("2026-04-01T00:00:00.000Z") },
      { id: "user-2", email: "beta@example.com", createdAt: new Date("2026-04-02T00:00:00.000Z") },
      { id: "user-3", email: "gamma@example.com", createdAt: new Date("2026-04-03T00:00:00.000Z") },
    ],
    clientRows: [
      { id: "client-1a", userId: "user-1", fullBirthName: "Alpha Old", createdAt: new Date("2026-04-01T00:00:00.000Z") },
      { id: "client-1b", userId: "user-1", fullBirthName: "Alpha Prime", createdAt: new Date("2026-04-05T00:00:00.000Z") },
    ],
    ordersByUser: new Map([
      ["user-1", [
        makeOrder({
          id: "session_2",
          userId: "user-1",
          email: "alpha@example.com",
          clientName: "Alpha Prime",
          amount: 120,
          status: "paid",
          createdAt: "2026-04-10T10:00:00.000Z",
        }),
        makeOrder({
          id: "report_1",
          userId: "user-1",
          email: "alpha@example.com",
          clientName: "Alpha Prime",
          amount: 75,
          status: "failed",
          createdAt: "2026-04-02T10:00:00.000Z",
        }),
      ]],
      ["user-2", [
        makeOrder({
          id: "session_3",
          userId: "user-2",
          email: "beta@example.com",
          clientName: "Beta Client",
          amount: 90,
          status: "completed",
          createdAt: "2026-04-08T10:00:00.000Z",
        }),
      ]],
    ]),
  });

  assert.equal(result.clients.length, 2);
  assert.equal(result.meta.totalUsers, 3);
  assert.equal(result.meta.totalActiveClients, 2);
  const alpha = result.clients.find((client) => client.email === "alpha@example.com");
  assert.equal(alpha?.clientId, "client-1b");
  assert.equal(alpha?.name, "Alpha Prime");
  assert.equal(alpha?.totalOrders, 2);
  assert.equal(alpha?.totalSpent, 120);
  assert.equal(alpha?.lastOrderAt, "2026-04-10T10:00:00.000Z");
  assert.equal(alpha?.orders[0]?.orderNumber, "session_2");
});

test("buildAdminClientsResult supports empty active-only state when users exist without purchases", () => {
  const result = buildAdminClientsResult({
    userRows: [
      { id: "user-1", email: "alpha@example.com", createdAt: new Date("2026-04-01T00:00:00.000Z") },
    ],
    clientRows: [],
    ordersByUser: new Map(),
  });

  assert.deepEqual(result.clients, []);
  assert.equal(result.meta.totalUsers, 1);
  assert.equal(result.meta.totalActiveClients, 0);
  assert.equal(result.pagination.total, 0);
});

test("buildAdminClientsResult applies sort before pagination", () => {
  const result = buildAdminClientsResult({
    userRows: [
      { id: "user-1", email: "alpha@example.com", createdAt: new Date("2026-04-01T00:00:00.000Z") },
      { id: "user-2", email: "beta@example.com", createdAt: new Date("2026-04-02T00:00:00.000Z") },
      { id: "user-3", email: "gamma@example.com", createdAt: new Date("2026-04-03T00:00:00.000Z") },
    ],
    clientRows: [],
    ordersByUser: new Map([
      ["user-1", [
        makeOrder({
          id: "session_1",
          userId: "user-1",
          email: "alpha@example.com",
          clientName: "Alpha",
          amount: 100,
          status: "paid",
          createdAt: "2026-04-05T10:00:00.000Z",
        }),
      ]],
      ["user-2", [
        makeOrder({
          id: "session_2",
          userId: "user-2",
          email: "beta@example.com",
          clientName: "Beta",
          amount: 300,
          status: "paid",
          createdAt: "2026-04-06T10:00:00.000Z",
        }),
      ]],
      ["user-3", [
        makeOrder({
          id: "session_3",
          userId: "user-3",
          email: "gamma@example.com",
          clientName: "Gamma",
          amount: 200,
          status: "paid",
          createdAt: "2026-04-07T10:00:00.000Z",
        }),
      ]],
    ]),
    query: {
      sort: "highest_spend",
      limit: 1,
      offset: 1,
    },
  });

  assert.equal(result.pagination.total, 3);
  assert.equal(result.clients.length, 1);
  assert.equal(result.clients[0]?.email, "gamma@example.com");
  assert.equal(result.clients[0]?.totalSpent, 200);
});
