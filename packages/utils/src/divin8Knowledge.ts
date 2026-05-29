export const DIVIN8_KNOWLEDGE_CATEGORIES = [
  "numerology",
  "numerology_chaldean",
  "numerology_pythagorean",
  "numerology_prime_canon",
  "chinese_bazi",
  "chinese_bazi_vietnamese_branch",
  "vedic_astrology",
  "western_astrology",
  "runes",
  "iching",
  "tarot",
  "kabbalah",
  "human_design",
  "body_map",
  "doctrine",
  "general",
] as const;

export const DIVIN8_KNOWLEDGE_AUTHORITY_LEVELS = [
  "hard_override",
  "canonical_interpretation",
  "supplemental_reference",
] as const;

export const DIVIN8_KNOWLEDGE_STATUSES = [
  "uploading",
  "processing",
  "indexed",
  "ready",
  "failed",
  "disabled",
  "deleted",
] as const;

export const DIVIN8_KNOWLEDGE_RETRIEVAL_MODES = [
  "chat",
  "intro_report",
  "deep_dive",
  "initiate",
  "timeline",
  "compatibility",
  "three_question",
] as const;

export type Divin8KnowledgeCategory = typeof DIVIN8_KNOWLEDGE_CATEGORIES[number];
export type Divin8KnowledgeAuthorityLevel = typeof DIVIN8_KNOWLEDGE_AUTHORITY_LEVELS[number];
export type Divin8KnowledgeStatus = typeof DIVIN8_KNOWLEDGE_STATUSES[number];
export type Divin8KnowledgeRetrievalMode = typeof DIVIN8_KNOWLEDGE_RETRIEVAL_MODES[number];

export interface Divin8KnowledgeSourceSummary {
  id: string;
  name: string;
  category: Divin8KnowledgeCategory;
  authorityLevel: Divin8KnowledgeAuthorityLevel;
  status: Divin8KnowledgeStatus;
  enabled: boolean;
  currentVersionId: string | null;
  currentVersionLabel: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  updatedAt: string | null;
  lastProcessedAt: string | null;
}

export interface Divin8KnowledgeSourceVersion {
  id: string;
  sourceId: string;
  versionNumber: number;
  versionLabel: string;
  status: Divin8KnowledgeStatus;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface Divin8CanonicalConceptResponse {
  id: string;
  category: Divin8KnowledgeCategory;
  conceptKey: string;
  displayName: string;
  canonicalMeanings: string[];
  forbiddenInterpretations: string[];
  preferredTerms: string[];
  replacementRules: Record<string, string>;
  authorityLevel: Divin8KnowledgeAuthorityLevel;
  priority: number;
  active: boolean;
  sourceKind: "extracted" | "manual";
  sourceId: string | null;
  versionId: string | null;
  updatedAt: string | null;
}

export interface Divin8KnowledgeOverrideResponse {
  id: string;
  category: Divin8KnowledgeCategory;
  ruleKey: string;
  alwaysUse: string | null;
  neverUse: string[];
  replacements: Record<string, string>;
  authorityLevel: Divin8KnowledgeAuthorityLevel;
  priority: number;
  active: boolean;
  sourceKind: "extracted" | "manual";
  conceptId: string | null;
  updatedAt: string | null;
}

export interface Divin8KnowledgeChunkPreview {
  title: string | null;
  content: string;
  concepts: string[];
  keywords: string[];
}

export interface Divin8KnowledgePreviewResponse {
  extractedTextPreview: string;
  chunks: Divin8KnowledgeChunkPreview[];
  concepts: Array<Omit<Divin8CanonicalConceptResponse, "id" | "sourceId" | "versionId" | "updatedAt">>;
  overrides: Array<Omit<Divin8KnowledgeOverrideResponse, "id" | "conceptId" | "updatedAt">>;
}

export interface Divin8KnowledgeSourceDetailResponse {
  source: Divin8KnowledgeSourceSummary;
  versions: Divin8KnowledgeSourceVersion[];
  concepts: Divin8CanonicalConceptResponse[];
  overrides: Divin8KnowledgeOverrideResponse[];
  chunks: Divin8KnowledgeChunkPreview[];
}

export interface Divin8KnowledgeSourcesResponse {
  sources: Divin8KnowledgeSourceSummary[];
}

export interface Divin8KnowledgeRetrievalDebugRequest {
  query: string;
  categories?: Divin8KnowledgeCategory[];
  mode?: Divin8KnowledgeRetrievalMode;
}

export interface Divin8KnowledgeRetrievalDebugResponse {
  query: string;
  mode: Divin8KnowledgeRetrievalMode;
  matchedConcepts: Divin8CanonicalConceptResponse[];
  appliedOverrides: Divin8KnowledgeOverrideResponse[];
  matchedChunks: Array<Divin8KnowledgeChunkPreview & {
    sourceId: string;
    sourceName: string;
    chunkId: string;
    score: number;
  }>;
  finalContext: string;
}

export function isDivin8KnowledgeCategory(value: unknown): value is Divin8KnowledgeCategory {
  return typeof value === "string" && (DIVIN8_KNOWLEDGE_CATEGORIES as readonly string[]).includes(value);
}

export function isDivin8KnowledgeAuthorityLevel(value: unknown): value is Divin8KnowledgeAuthorityLevel {
  return typeof value === "string" && (DIVIN8_KNOWLEDGE_AUTHORITY_LEVELS as readonly string[]).includes(value);
}

export function isDivin8KnowledgeRetrievalMode(value: unknown): value is Divin8KnowledgeRetrievalMode {
  return typeof value === "string" && (DIVIN8_KNOWLEDGE_RETRIEVAL_MODES as readonly string[]).includes(value);
}
