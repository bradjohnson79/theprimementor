import HTMLtoDOCX from "html-to-docx";
import puppeteer from "puppeteer";
import { markdownToSanitizedHtml } from "./reportFormat.js";

const PUPPETEER_LAUNCH_TIMEOUT_MS = 8_000;
const PUPPETEER_PAGE_TIMEOUT_MS = 20_000;

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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function htmlToExportLines(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<\/(p|h1|h2|h3|h4|div|blockquote|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function encodeWinAnsi(value: string) {
  return value.replace(/[^\t\n\r\x20-\x7E]/g, (character) => {
    switch (character) {
      case "“":
      case "”":
        return "\"";
      case "‘":
      case "’":
        return "'";
      case "–":
      case "—":
        return "-";
      case "…":
        return "...";
      default:
        return "?";
    }
  });
}

function escapePdfLiteral(value: string) {
  return encodeWinAnsi(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapExportLine(line: string, width = 92) {
  const words = line.split(" ");
  const rows: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      rows.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) rows.push(current);
  return rows.length > 0 ? rows : [""];
}

export function exportPdfFromPlainText(title: string, lines: string[]): Buffer {
  const pageWidth = 612;
  const pageHeight = 792;
  const left = 54;
  const top = 720;
  const lineHeight = 14;
  const wrapped = [
    ...wrapExportLine(title, 70),
    "",
    ...lines.flatMap((line) => wrapExportLine(line)),
  ];
  const linesPerPage = 46;
  const pages: string[][] = [];
  for (let index = 0; index < wrapped.length; index += linesPerPage) {
    pages.push(wrapped.slice(index, index + linesPerPage));
  }
  if (pages.length === 0) pages.push([title]);

  const pageCount = pages.length;
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const firstContentId = 4;
  const firstPageId = firstContentId + pageCount;
  const objects: string[] = new Array(firstPageId + pageCount);

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId] = `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, index) => `${firstPageId + index} 0 R`).join(" ")}] /Count ${pageCount} >>`;
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>";

  pages.forEach((pageLines, index) => {
    const commands = [
      "BT",
      "/F1 12 Tf",
      `${lineHeight} TL`,
      `${left} ${top} Td`,
      ...pageLines.map((line, lineIndex) => `${lineIndex === 0 ? "" : "T* "}(${escapePdfLiteral(line)}) Tj`),
      "ET",
    ].join("\n");
    objects[firstContentId + index] = `<< /Length ${Buffer.byteLength(commands, "latin1")} >>\nstream\n${commands}\nendstream`;
    objects[firstPageId + index] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${firstContentId + index} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
  });

  const header = "%PDF-1.4\n";
  const bodies = objects.slice(1).map((body, index) => `${index + 1} 0 obj\n${body}\nendobj\n`);
  let position = Buffer.byteLength(header, "latin1");
  const xrefOffsets = bodies.map((body) => {
    const offset = position;
    position += Buffer.byteLength(body, "latin1");
    return offset;
  });
  const xref = [
    "xref",
    `0 ${bodies.length + 1}`,
    "0000000000 65535 f ",
    ...xrefOffsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
  ].join("\n");
  const trailer = `\ntrailer\n<< /Size ${bodies.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${position}\n%%EOF\n`;
  return Buffer.from(`${header}${bodies.join("")}${xref}${trailer}`, "latin1");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function exportPdfWithPuppeteer(title: string, html: string): Promise<Buffer> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await withTimeout(
      puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      }),
      PUPPETEER_LAUNCH_TIMEOUT_MS,
      "Puppeteer launch timed out",
    );
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: PUPPETEER_PAGE_TIMEOUT_MS });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Prefer Chromium when it is available. Fall back to a text PDF so Render and
 * other hosts without a browser still export conversations and reports.
 */
export async function exportPdfFromMarkdown(title: string, fullMarkdown: string): Promise<Buffer> {
  const inner = markdownToSanitizedHtml(fullMarkdown);
  const html = exportHtmlDocument(title, inner);
  try {
    return await exportPdfWithPuppeteer(title, html);
  } catch (err) {
    try {
      return exportPdfFromPlainText(title, htmlToExportLines(inner));
    } catch {
      const wrapped = new Error("PDF_EXPORT_FAILED");
      (wrapped as Error & { cause?: unknown }).cause = err;
      throw wrapped;
    }
  }
}
