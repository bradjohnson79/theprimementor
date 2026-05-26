import assert from "node:assert/strict";
import test from "node:test";
import { resolveRecoveryInvoiceReportType } from "./reportRecoveryInvoiceService.js";

test("resolveRecoveryInvoiceReportType accepts casual report products", () => {
  assert.equal(resolveRecoveryInvoiceReportType("three_questions"), "three_questions");
  assert.equal(resolveRecoveryInvoiceReportType("compatibility"), "compatibility");
  assert.equal(resolveRecoveryInvoiceReportType("annual_12_month"), "annual_12_month");
});

test("resolveRecoveryInvoiceReportType still accepts premium report products", () => {
  assert.equal(resolveRecoveryInvoiceReportType("intro"), "intro");
  assert.equal(resolveRecoveryInvoiceReportType("deep_dive"), "deep_dive");
  assert.equal(resolveRecoveryInvoiceReportType("initiate"), "initiate");
});

test("resolveRecoveryInvoiceReportType accepts route slugs", () => {
  assert.equal(resolveRecoveryInvoiceReportType("three-questions"), "three_questions");
  assert.equal(resolveRecoveryInvoiceReportType("deep-dive"), "deep_dive");
});

test("resolveRecoveryInvoiceReportType rejects unknown report products", () => {
  assert.throws(
    () => resolveRecoveryInvoiceReportType("unknown"),
    /Invalid report type\./,
  );
});
