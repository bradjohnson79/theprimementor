import { PDFParse } from "pdf-parse";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/markdown",
]);

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split(String.fromCharCode(0)).join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function isSupportedKnowledgeSource(mimeType: string, filename: string) {
  const normalizedMime = mimeType.toLowerCase();
  const normalizedName = filename.toLowerCase();
  return SUPPORTED_MIME_TYPES.has(normalizedMime)
    || normalizedName.endsWith(".pdf")
    || normalizedName.endsWith(".txt")
    || normalizedName.endsWith(".md")
    || normalizedName.endsWith(".markdown");
}

export async function extractKnowledgeSourceText(input: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}) {
  if (!isSupportedKnowledgeSource(input.mimeType, input.filename)) {
    throw new Error("Knowledge source must be a PDF, TXT, or Markdown file.");
  }

  const normalizedName = input.filename.toLowerCase();
  if (input.mimeType === "application/pdf" || normalizedName.endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(input.buffer) });
    try {
      const parsed = await parser.getText();
      return normalizeExtractedText(parsed.text ?? "");
    } finally {
      await parser.destroy();
    }
  }

  return normalizeExtractedText(input.buffer.toString("utf8"));
}
