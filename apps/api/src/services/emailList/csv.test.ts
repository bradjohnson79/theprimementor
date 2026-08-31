import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExportCsv,
  classifyCsvRow,
  exportHasOnlyAllowedColumns,
  parseCsvRecords,
  recognizeCsvHeaders,
  sanitizeCsvCell,
} from "./csv.js";

describe("csv helpers", () => {
  it("recognizes header aliases", () => {
    const map = recognizeCsvHeaders(["Email Address", "First Name"]);
    assert.equal(map.email, "Email Address");
    assert.equal(map.firstName, "First Name");
  });

  it("classifies new, existing, duplicate, and invalid rows", () => {
    const seen = new Set<string>();
    const existing = new Set(["already@example.com"]);
    assert.equal(classifyCsvRow(2, "new@example.com", "Ada", seen, existing).status, "new");
    assert.equal(classifyCsvRow(3, "already@example.com", "Bea", seen, existing).status, "exists");
    assert.equal(classifyCsvRow(4, "new@example.com", "Ada", seen, existing).status, "duplicate_in_file");
    assert.equal(classifyCsvRow(5, "not-an-email", "Cam", seen, existing).status, "invalid");
    assert.equal(
      classifyCsvRow(6, "ads@google.com", "Ads", new Set(), existing, [{ kind: "domain", value: "google.com" }]).status,
      "excluded",
    );
    assert.equal(classifyCsvRow(7, "Already@Example.com", "Bea", new Set(), existing).status, "exists");
    assert.equal(classifyCsvRow(8, "NEW@example.com", "Ada", seen, existing).status, "duplicate_in_file");
  });

  it("leaves only unique new addresses after existing and in-file duplicates", () => {
    const seen = new Set<string>();
    const existing = new Set(["already@example.com"]);
    const leftover = [
      "already@example.com",
      "ALREADY@example.com",
      "new@example.com",
      "NEW@example.com",
      "fresh@example.com",
    ]
      .map((email, index) => classifyCsvRow(index + 2, email, "Pat", seen, existing))
      .filter((row) => row.status === "new")
      .map((row) => row.emailNormalized);
    assert.deepEqual(leftover, ["new@example.com", "fresh@example.com"]);
    assert.equal(new Set(leftover).size, leftover.length);
  });

  it("escapes formula-injection prefixes and keeps export columns exact", () => {
    assert.equal(sanitizeCsvCell("=cmd"), "'=cmd");
    assert.equal(sanitizeCsvCell("+1"), "'+1");
    const csv = buildExportCsv([
      { email: "ada@example.com", firstName: "=HYPERLINK(1)" },
    ]);
    assert.equal(exportHasOnlyAllowedColumns(csv), true);
    assert.match(csv, /^email,first_name\n/);
    assert.doesNotMatch(csv, /imported_by/);
    assert.doesNotMatch(csv, /encrypted/);
    assert.match(csv, /'=HYPERLINK\(1\)/);
  });

  it("parses quoted CSV records", () => {
    const rows = parseCsvRecords('email,first_name\n"ada@example.com","Ada Lovelace"\n');
    assert.equal(rows[0]?.email, "ada@example.com");
    assert.equal(rows[0]?.first_name, "Ada Lovelace");
  });
});
