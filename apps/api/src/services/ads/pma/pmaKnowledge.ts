import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "./pmaEngine.js";

const KNOWLEDGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../../../knowledge/ads");

export type PmaKnowledgeEntry = {
  path: string;
  title: string;
  body: string;
};

function safeReadKnowledge(): PmaKnowledgeEntry[] {
  try {
    const files = readdirSync(KNOWLEDGE_ROOT, { recursive: true })
      .map((file) => String(file))
      .filter((file) => file.endsWith(".md") && !file.includes(".."));
    return files.slice(0, 40).map((file) => {
      const body = readFileSync(join(KNOWLEDGE_ROOT, file), "utf8").slice(0, 6000);
      const title = body.match(/^#\s+(.+)$/m)?.[1] ?? file;
      return { path: file, title, body };
    });
  } catch {
    return [];
  }
}

export function retrievePmaKnowledge(query: string, limit = 3) {
  const queryTokens = new Set(tokenize(query));
  return safeReadKnowledge()
    .map((entry) => {
      const tokens = tokenize(`${entry.title} ${entry.body}`);
      const overlap = tokens.filter((token) => queryTokens.has(token)).length;
      return { ...entry, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap)
    .slice(0, limit)
    .map(({ overlap: _overlap, ...entry }) => entry);
}

export function knowledgeSeedTerms() {
  return safeReadKnowledge()
    .flatMap((entry) => entry.body.split("\n"))
    .map((line) => line.replace(/^[-*`#\s]+/, "").replace(/[`*_]/g, "").trim())
    .filter((line) => {
      const words = line.split(/\s+/);
      return words.length >= 2
        && words.length <= 7
        && line.length < 50
        && !/[.!?]|https?:\/\//.test(line)
        && /^(detailed |personal |buy |best )?(birth chart|natal|numerology|life purpose|astrology) report$/i.test(line);
    })
    .slice(0, 12);
}
