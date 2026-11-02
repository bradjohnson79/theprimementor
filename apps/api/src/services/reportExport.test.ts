import assert from "node:assert/strict";
import test from "node:test";
import puppeteer from "puppeteer";
import { exportPdfFromMarkdown, exportPdfFromPlainText, htmlToExportLines } from "./reportExport.js";

test("exportPdfFromMarkdown still returns a PDF when Chromium is unavailable", async () => {
  const launchHost = puppeteer as unknown as { launch: typeof puppeteer.launch };
  const originalLaunch = launchHost.launch;
  launchHost.launch = (async () => {
    throw new Error("Chromium unavailable");
  }) as typeof puppeteer.launch;

  try {
    const pdf = await exportPdfFromMarkdown("SEO Report", "## Summary\n\nTest body");
    assert.match(pdf.toString("latin1"), /^%PDF-1.4/);
    assert.match(pdf.toString("latin1"), /SEO Report/);
    assert.match(pdf.toString("latin1"), /Test body/);
  } finally {
    launchHost.launch = originalLaunch;
  }
});

test("plain-text PDF fallback keeps conversation headings readable", () => {
  const pdf = exportPdfFromPlainText("Finance Reading", htmlToExportLines("<h2>User</h2><p>Tell me about finances.</p><h2>Divin8</h2><p>Here is the visible guidance.</p>"));
  const body = pdf.toString("latin1");
  assert.match(body, /^%PDF-1.4/);
  assert.match(body, /Finance Reading/);
  assert.match(body, /Tell me about finances/);
  assert.match(body, /Here is the visible guidance/);
  assert.match(body, /%%EOF/);
});
