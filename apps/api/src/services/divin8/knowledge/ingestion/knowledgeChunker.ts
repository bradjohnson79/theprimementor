import type { KnowledgeChunkDraft } from "../types/knowledgeTypes.js";

const MAX_CHUNK_CHARS = 1800;
const MIN_CHUNK_CHARS = 180;
const TOKEN_STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "are",
  "is",
  "of",
  "to",
  "in",
  "as",
  "on",
]);

function normalizeWhitespace(value: string) {
  return value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function titleFromBlock(block: string) {
  const firstLine = block.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine) {
    return null;
  }
  const withoutMarkdown = firstLine.replace(/^#{1,6}\s*/, "").trim();
  return withoutMarkdown.length <= 90 ? withoutMarkdown : null;
}

function keywordsFromContent(content: string) {
  const counts = new Map<string, number>();
  for (const token of content.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, " ").split(/\s+/)) {
    const normalized = token.trim();
    if (normalized.length < 3 || TOKEN_STOPWORDS.has(normalized)) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([token]) => token);
}

function conceptsFromContent(content: string) {
  const concepts = new Set<string>();
  const lower = content.toLowerCase();
  const lifePathMatches = lower.matchAll(/\blife\s+path\s+(\d{1,2})\b/g);
  for (const match of lifePathMatches) {
    concepts.add(`life_path_${match[1]}`);
  }
  const animalBranchMatches = lower.matchAll(/\b(?:animal\s+)?branch\s+(\d{1,2})\b/g);
  for (const match of animalBranchMatches) {
    concepts.add(`animal_branch_${match[1]}`);
  }
  if (/\bcat\b/i.test(content)) {
    concepts.add("cat_branch");
  }
  return [...concepts];
}

function splitOversizedBlock(block: string) {
  if (block.length <= MAX_CHUNK_CHARS) {
    return [block];
  }
  const sentences = block.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (`${current} ${sentence}`.trim().length > MAX_CHUNK_CHARS && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks.length > 0 ? chunks : [block.slice(0, MAX_CHUNK_CHARS)];
}

export function chunkKnowledgeText(text: string): KnowledgeChunkDraft[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const sections = normalized
    .split(/\n(?=#{1,6}\s+)|\n{2,}/)
    .map((section) => section.trim())
    .filter((section) => section.length >= MIN_CHUNK_CHARS);

  const rawChunks = sections.length > 0 ? sections.flatMap(splitOversizedBlock) : splitOversizedBlock(normalized);
  return rawChunks.map((content) => ({
    title: titleFromBlock(content),
    content,
    keywords: keywordsFromContent(content),
    concepts: conceptsFromContent(content),
    metadata: {
      charCount: content.length,
    },
  }));
}
