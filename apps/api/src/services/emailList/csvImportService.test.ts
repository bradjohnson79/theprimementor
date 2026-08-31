import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createManualContact } from "./contactService.js";
import { commitCsvImport, previewCsvImport } from "./csvImportService.js";
import { createMemoryEmailListStore } from "./emailListStore.js";

const ADMIN = "11111111-1111-1111-1111-111111111111";

describe("csv import uniqueness", () => {
  it("skips existing contacts and in-file repeats so only unique new addresses remain", async () => {
    const store = createMemoryEmailListStore();
    await createManualContact(store, ADMIN, { email: "already@example.com", firstName: "Old" });
    await store.insertExclusion({
      kind: "domain",
      value: "google.com",
      pattern: "@google.com",
      created_by_user_id: ADMIN,
    });

    const preview = await previewCsvImport(store, ADMIN, {
      filename: "messy.csv",
      mimetype: "text/csv",
      buffer: Buffer.from([
        "email,first_name",
        "already@example.com,Old",
        "ALREADY@example.com,Old Two",
        "new@example.com,New",
        "New@Example.com,New Two",
        "new@example.com,New Three",
        "ads@google.com,Ads",
        "fresh@example.com,Fresh",
      ].join("\n")),
    });

    const leftover = preview.preview.rows.filter((row) => row.status === "new");
    assert.deepEqual(leftover.map((row) => row.emailNormalized), ["new@example.com", "fresh@example.com"]);
    assert.equal(new Set(leftover.map((row) => row.emailNormalized)).size, leftover.length);
    assert.equal(preview.preview.summary.exists, 1);
    assert.equal(preview.preview.summary.duplicateInFile, 3);
    assert.equal(preview.preview.summary.excluded, 1);
    assert.equal(preview.preview.summary.new, 2);

    const committed = await commitCsvImport(store, ADMIN, { importSessionId: preview.importSessionId });
    assert.equal(committed.added, 2);
    assert.equal(committed.alreadyExisted, 1);
    assert.equal(committed.duplicateInFile, 3);
    assert.equal(committed.skipped, 1);

    const normalized = store.contacts.map((row) => row.email_normalized);
    assert.equal(normalized.length, new Set(normalized).size);
    assert.deepEqual(normalized.sort(), ["already@example.com", "fresh@example.com", "new@example.com"]);
  });
});
