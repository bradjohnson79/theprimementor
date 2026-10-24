import assert from "node:assert/strict";
import test from "node:test";
import { resolveRootDb, tagTopLevelTransactions } from "@wisdom/db";

function fakeDb() {
  const tx = { kind: "tx" };
  const db = {
    kind: "root",
    seenConfig: undefined as unknown,
    transaction: async (callback: (t: object) => unknown, config?: unknown) => {
      db.seenConfig = config;
      return callback(tx);
    },
  };
  return { db, tx };
}

test("resolveRootDb returns the root db for a top-level transaction handle", async () => {
  const { db, tx } = fakeDb();
  tagTopLevelTransactions(db);
  let seen: object | undefined;
  const result = await db.transaction(async (t) => {
    seen = t;
    return "done";
  }, { isolationLevel: "serializable" });
  assert.equal(result, "done");
  assert.equal(seen, tx);
  assert.deepEqual(db.seenConfig, { isolationLevel: "serializable" });
  assert.equal(resolveRootDb(tx), db);
  // still resolves after the transaction finished (the fire-and-forget case)
  assert.equal(resolveRootDb(seen), db);
});

test("resolveRootDb leaves non-transaction handles unchanged", () => {
  const { db } = fakeDb();
  tagTopLevelTransactions(db);
  assert.equal(resolveRootDb(db), db);
  const other = { kind: "untracked" };
  assert.equal(resolveRootDb(other), other);
  assert.equal(resolveRootDb(null), null);
  assert.equal(resolveRootDb(undefined), undefined);
});
