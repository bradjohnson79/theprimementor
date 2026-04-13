import assert from "node:assert/strict";
import test from "node:test";
import type { Database } from "@wisdom/db";
import { createPersistedOrderFromInvoice } from "./invoiceService.js";

function createSelectChain(responses: unknown[][]) {
  return {
    from() {
      return {
        where() {
          return {
            limit() {
              return Promise.resolve((responses.shift() ?? []) as never[]);
            },
          };
        },
      };
    },
  };
}

test("createPersistedOrderFromInvoice re-loads the existing order after an insert conflict", async () => {
  const existingOrder = {
    id: "order-existing",
    payment_reference: "pi_123",
  };

  let insertAttempted = false;
  const selectResponses = [[], [existingOrder]];
  const db = {
    select() {
      return createSelectChain(selectResponses);
    },
    insert() {
      insertAttempted = true;
      return {
        values() {
          return {
            onConflictDoNothing() {
              return {
                returning() {
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Pick<Database, "select" | "insert" | "update">;

  const result = await createPersistedOrderFromInvoice(db, {
    invoice: {
      id: "invoice-1",
      user_id: "user-1",
      client_id: "client-1",
      billing_mode: "one_time",
      stripe_subscription_id: null,
      product_type: "report",
      label: "Report invoice",
      amount: 25000,
      currency: "cad",
    } as never,
    paymentReference: "pi_123",
    status: "completed",
  });

  assert.equal(insertAttempted, true);
  assert.equal(result, existingOrder);
});
