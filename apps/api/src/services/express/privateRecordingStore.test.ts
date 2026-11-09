import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryRecordingStore } from "./privateRecordingStore.js";

test("the test recording store keeps bytes by storage key", async () => {
  const store = createMemoryRecordingStore();
  const bytes = new Uint8Array([1, 2, 3, 4]);
  await store.put("express/order-1/reply.mp3", bytes);
  const stored = await store.get("express/order-1/reply.mp3");
  assert.deepEqual(stored, bytes);
  assert.equal(await store.get("missing"), null);
});
