import assert from "node:assert/strict";
import test from "node:test";
import puppeteer from "puppeteer";
import { exportPdfFromMarkdown } from "./reportExport.js";

test("exportPdfFromMarkdown wraps puppeteer failures with PDF_EXPORT_FAILED", async () => {
  const launchHost = puppeteer as unknown as { launch: typeof puppeteer.launch };
  const originalLaunch = launchHost.launch;
  launchHost.launch = (async () => {
    throw new Error("Chromium unavailable");
  }) as typeof puppeteer.launch;

  try {
    await assert.rejects(
      () => exportPdfFromMarkdown("SEO Report", "## Summary\n\nTest body"),
      /PDF_EXPORT_FAILED/,
    );
  } finally {
    launchHost.launch = originalLaunch;
  }
});
