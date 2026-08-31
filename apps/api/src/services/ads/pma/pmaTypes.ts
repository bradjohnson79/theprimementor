export const PMA_INTENT_KINDS = [
  "transactional",
  "commercial_investigation",
  "problem_desire",
  "informational",
  "poor_fit",
] as const;
export type PmaIntentKind = (typeof PMA_INTENT_KINDS)[number];

export const PMA_RELEVANCE_LABELS = ["Excellent", "Strong", "Moderate", "Weak"] as const;
export type PmaRelevanceLabel = (typeof PMA_RELEVANCE_LABELS)[number];

export const PMA_METRIC_ORIGINS = ["observed", "derived", "estimated", "unknown"] as const;
export type PmaMetricOrigin = (typeof PMA_METRIC_ORIGINS)[number];

export const PMA_ANALYSIS_STAGES = [
  "Discovering terms",
  "Extracting concepts",
  "Clustering",
  "Classifying intent",
  "Scoring opportunity",
  "Loading Umani signals",
  "Building recommendations",
] as const;
export type PmaAnalysisStage = (typeof PMA_ANALYSIS_STAGES)[number];

export type PmaObservedMetric = {
  value: number | null;
  origin: PmaMetricOrigin;
};

export type PmaImportedMetrics = {
  impressions?: PmaObservedMetric;
  clicks?: PmaObservedMetric;
  cost?: PmaObservedMetric;
  conversions?: PmaObservedMetric;
};

export type PmaKeywordCandidate = {
  term: string;
  source: "seed" | "catalog" | "knowledge" | "import" | "screenshot";
  intent: PmaIntentKind;
  intentReason: string;
  intentScore: number;
  relevanceLabel: PmaRelevanceLabel;
  relevanceReason: string;
  relevanceScore: number;
  specificityScore: number;
  opportunityScore: number;
  opportunityReason: string;
  clusterId: string | null;
  metrics: PmaImportedMetrics;
};

export type PmaCluster = {
  id: string;
  name: string;
  termCount: number;
  terms: string[];
  intent: PmaIntentKind;
  relevanceLabel: PmaRelevanceLabel;
  opportunityScore: number;
  behaviorLabel: string;
  treatment: string;
  treatmentReason: string;
};

export type PmaNegativeCandidate = {
  term: string;
  reason: string;
  confidence: "High" | "Medium" | "Low";
  evidence: string;
  clusterId: string | null;
  action: "Test exclude" | "Monitor" | "Keep";
};

export type PmaBehaviorInsight = {
  status: "ok" | "degraded" | "unavailable";
  range: "24h" | "7d" | "30d";
  warning: string | null;
  landingPage: string;
  sessions: number | null;
  pageviews: number | null;
  bounceRate: number | null;
  ctaClicks: number | null;
  purchases: number | null;
  hasUtmData: boolean;
  campaigns: Array<{
    label: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    visitors: number;
    bounceRate: number;
  }>;
  reportsPath: {
    path: string;
    visitors: number;
    pageviews: number;
    bounceRate: number;
  } | null;
  note: string;
};

export type PmaCampaignIdea = {
  name: string;
  objective: string;
  audienceIntent: string;
  geography: string;
  strategy: string;
  adGroups: Array<{ name: string; rationale: string; keywords: string[] }>;
  exactKeywords: string[];
  phraseKeywords: string[];
  expansionKeywords: string[];
  negatives: string[];
  headlines: string[];
  descriptions: string[];
  differentiation: string;
  adAngle: string;
  landingPage: string;
  congruenceNotes: string;
  experiment: {
    hypothesis: string;
    control: string;
    variant: string;
    primaryMetric: string;
    secondaryMetric: string;
  };
  priority: {
    impact: "High" | "Medium" | "Low";
    confidence: "High" | "Medium" | "Low";
    effort: "Low" | "Medium" | "High";
    risk: "Low" | "Medium" | "High";
  };
};

export type PmaLesson = {
  clusterName: string;
  observation: string;
  result: string;
  lesson: string;
  confidence: "High" | "Medium" | "Low";
  validated: false;
};

export type PmaAnalysisPayload = {
  candidates: PmaKeywordCandidate[];
  clusters: PmaCluster[];
  negatives: PmaNegativeCandidate[];
  behavior: PmaBehaviorInsight;
  campaignIdeas: PmaCampaignIdea[];
  scoringWeights: {
    intent: number;
    relevance: number;
    specificity: number;
    behavior: number;
    note: string;
  };
  providers: {
    googleAds: "unavailable";
    searchConsole: "unavailable";
    umami: "ok" | "degraded" | "unavailable";
    searxng: "unavailable";
  };
};

export type PmaProject = {
  id: string;
  slug: string;
  name: string;
  offerKey: string;
};

export const PMA_DEFAULT_PROJECT = {
  slug: "divin8-reports",
  name: "Divin8 Reports",
  offerKey: "divin8_reports",
} as const;

export const PMA_DEFAULT_SEEDS = [
  "detailed birth chart report",
  "personal astrology report",
  "numerology report",
  "life purpose report",
];
