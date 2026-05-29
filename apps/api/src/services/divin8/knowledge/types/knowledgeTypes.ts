import type {
  Divin8CanonicalConceptResponse,
  Divin8KnowledgeAuthorityLevel,
  Divin8KnowledgeCategory,
  Divin8KnowledgeOverrideResponse,
  Divin8KnowledgeRetrievalMode,
  Divin8KnowledgeStatus,
} from "@wisdom/utils";

export type {
  Divin8KnowledgeAuthorityLevel,
  Divin8KnowledgeCategory,
  Divin8KnowledgeRetrievalMode,
  Divin8KnowledgeStatus,
};

export interface KnowledgeSourceFile {
  originalFilename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface KnowledgeIngestionInput {
  name: string;
  category: Divin8KnowledgeCategory;
  authorityLevel: Divin8KnowledgeAuthorityLevel;
  file: KnowledgeSourceFile;
  adminUserId: string;
}

export interface KnowledgeChunkDraft {
  title: string | null;
  content: string;
  keywords: string[];
  concepts: string[];
  metadata?: Record<string, unknown>;
}

export interface CanonicalConceptDraft {
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
}

export interface KnowledgeOverrideDraft {
  category: Divin8KnowledgeCategory;
  ruleKey: string;
  alwaysUse: string | null;
  neverUse: string[];
  replacements: Record<string, string>;
  authorityLevel: Divin8KnowledgeAuthorityLevel;
  priority: number;
  active: boolean;
  sourceKind: "extracted" | "manual";
  conceptId?: string | null;
}

export interface KnowledgeIngestionPreview {
  extractedText: string;
  chunks: KnowledgeChunkDraft[];
  concepts: CanonicalConceptDraft[];
  overrides: KnowledgeOverrideDraft[];
}

export interface KnowledgeRetrievalLimits {
  maxHardOverrides: number;
  maxCanonicalConcepts: number;
  maxSupplementalChunks: number;
  maxCharsTotal: number;
}

export interface KnowledgeRetrievalInput {
  query: string;
  categories?: Divin8KnowledgeCategory[];
  concepts?: string[];
  mode?: Divin8KnowledgeRetrievalMode;
  limits?: Partial<KnowledgeRetrievalLimits>;
}

export interface RetrievedKnowledgeChunk {
  id: string;
  sourceId: string;
  sourceName: string;
  category: Divin8KnowledgeCategory;
  authorityLevel: Divin8KnowledgeAuthorityLevel;
  title: string | null;
  content: string;
  keywords: string[];
  concepts: string[];
  score: number;
}

export interface RetrievedKnowledgeContext {
  mode: Divin8KnowledgeRetrievalMode;
  concepts: Divin8CanonicalConceptResponse[];
  overrides: Divin8KnowledgeOverrideResponse[];
  chunks: RetrievedKnowledgeChunk[];
  finalContext: string;
}

export interface KnowledgeAuditInput {
  adminUserId: string;
  actionType: string;
  sourceId?: string | null;
  versionId?: string | null;
  conceptId?: string | null;
  overrideId?: string | null;
  before?: unknown;
  after?: unknown;
}

export const DEFAULT_KNOWLEDGE_RETRIEVAL_LIMITS: KnowledgeRetrievalLimits = {
  maxHardOverrides: 10,
  maxCanonicalConcepts: 8,
  maxSupplementalChunks: 5,
  maxCharsTotal: 6000,
};
