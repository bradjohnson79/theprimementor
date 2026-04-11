import HTMLtoDOCX from "html-to-docx";
import puppeteer from "puppeteer";
import { markdownToSanitizedHtml } from "./reportFormat.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function exportHtmlDocument(title: string, innerBodyHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
body{font-family:Georgia,serif;font-size:11pt;line-height:1.55;max-width:720px;margin:24px auto;color:#111;}
h1{font-size:18pt;margin-bottom:1em;}
h2{font-size:14pt;margin-top:1.4em;margin-bottom:0.5em;}
p{margin:0.65em 0;}
ul,ol{margin:0.5em 0 0.5em 1.25em;}
blockquote{border-left:3px solid #ccc;margin:1em 0;padding-left:1em;color:#333;}
</style></head><body><h1>${escapeHtml(title)}</h1>${innerBodyHtml}</body></html>`;
}

export async function exportDocxFromMarkdown(title: string, fullMarkdown: string): Promise<Buffer> {
  const inner = markdownToSanitizedHtml(fullMarkdown);
  const html = exportHtmlDocument(title, inner);
  const out = await HTMLtoDOCX(html, null, {
    title,
    creator: "The Prime Mentor",
    footer: false,
    pageNumber: false,
  });
  if (Buffer.isBuffer(out)) return out;
  if (out instanceof ArrayBuffer) return Buffer.from(out);
  return Buffer.from(out as Uint8Array);
}

/**
 * PDF via Puppeteer — requires Chromium (Docker/VPS or bundled cache). Serverless often fails.
 * Callers should catch and return 503 "PDF export temporarily unavailable".
 */
export async function exportPdfFromMarkdown(title: string, fullMarkdown: string): Promise<Buffer> {
  const inner = markdownToSanitizedHtml(fullMarkdown);
  const html = exportHtmlDocument(title, inner);
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 45_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    return Buffer.from(pdf);
  } catch (err) {
    const wrapped = new Error("PDF_EXPORT_FAILED");
    (wrapped as Error & { cause?: unknown }).cause = err;
    throw wrapped;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
