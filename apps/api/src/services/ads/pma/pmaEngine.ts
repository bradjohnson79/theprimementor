import { getDivin8AdvertisingCatalog } from "../divin8AdsCatalog.js";
import {
  PMA_DEFAULT_SEEDS,
  type PmaAnalysisPayload,
  type PmaBehaviorInsight,
  type PmaCampaignIdea,
  type PmaCluster,
  type PmaImportedMetrics,
  type PmaIntentKind,
  type PmaKeywordCandidate,
  type PmaNegativeCandidate,
  type PmaRelevanceLabel,
} from "./pmaTypes.js";

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "my", "your", "with", "is", "what",
]);

const TRANSACTIONAL = /\b(buy|purchase|order|checkout|get my|pay for|price|cost of|shop)\b/i;
const COMMERCIAL = /\b(best|review|vs|versus|compare|comparison|detailed|professional|premium|complete)\b/i;
const PROBLEM = /\b(why am i|stuck|confused|lost|purpose|direction|understand myself|who am i)\b/i;
const INFORMATIONAL = /\b(what is|meaning of|definition|how does|how do|explained|guide to)\b/i;
const POOR_FIT = /\b(free|calculator|template|jobs?|hiring|course|software|definition|training|pdf|download|salary|internship)\b/i;

const NEGATIVE_THEMES = [
  { term: "free", reason: "Free-seekers rarely convert on a paid Divin8 report." },
  { term: "calculator", reason: "Tool-seeking traffic wants a widget, not a report." },
  { term: "template", reason: "Template searches want DIY assets, not a delivered reading." },
  { term: "jobs", reason: "Employment intent is off-offer." },
  { term: "course", reason: "Education-product intent is a different offer." },
  { term: "software", reason: "Software buyers are looking for an app, not a report." },
  { term: "definition", reason: "Dictionary-style queries are informational and poor-fit." },
  { term: "training", reason: "Training searches seek instruction, not a personal report." },
  { term: "free pdf", reason: "Free-file hunters are not paid-report buyers." },
];

export function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/-/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function normalizeKeyword(value: string) {
  return value
    .toLowerCase()
    .replace(/(\w)-(\w)/g, "$1$2")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "")
    .trim();
}

export function parseKeywordList(input: string) {
  return [...new Set(
    input
      .split(/\r?\n|,/)
      .map((line) => normalizeKeyword(line.replace(/^["']|["']$/g, "")))
      .filter((line) => line.length >= 2 && line.length <= 80),
  )];
}

export function parseKeywordCsv(csv: string) {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [] as Array<{ term: string; metrics: PmaImportedMetrics }>;
  const header = lines[0].toLowerCase().split(",").map((cell) => cell.trim().replace(/^["']|["']$/g, ""));
  const keywordIdx = header.findIndex((cell) => cell === "keyword" || cell === "term" || cell === "search term");
  if (keywordIdx < 0) {
    return parseKeywordList(csv).map((term) => ({ term, metrics: {} }));
  }
  const col = (name: string) => header.findIndex((cell) => cell === name);
  const impressionsIdx = col("impressions");
  const clicksIdx = col("clicks");
  const costIdx = col("cost");
  const conversionsIdx = col("conversions");
  const rows: Array<{ term: string; metrics: PmaImportedMetrics }> = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",").map((cell) => cell.trim().replace(/^["']|["']$/g, ""));
    const term = normalizeKeyword(cells[keywordIdx] ?? "");
    if (!term) continue;
    const observed = (index: number): PmaImportedMetrics[keyof PmaImportedMetrics] | undefined => {
      if (index < 0 || cells[index] === undefined || cells[index] === "") return undefined;
      const value = Number(cells[index]);
      if (!Number.isFinite(value)) return { value: null, origin: "unknown" };
      return { value, origin: "observed" };
    };
    rows.push({
      term,
      metrics: {
        ...(impressionsIdx >= 0 ? { impressions: observed(impressionsIdx) } : {}),
        ...(clicksIdx >= 0 ? { clicks: observed(clicksIdx) } : {}),
        ...(costIdx >= 0 ? { cost: observed(costIdx) } : {}),
        ...(conversionsIdx >= 0 ? { conversions: observed(conversionsIdx) } : {}),
      },
    });
  }
  return rows;
}

export function classifyIntent(term: string): { kind: PmaIntentKind; score: number; reason: string } {
  if (POOR_FIT.test(term)) {
    return { kind: "poor_fit", score: 8, reason: "Matches a poor-fit theme such as free, jobs, or tools." };
  }
  if (TRANSACTIONAL.test(term) || (/\breport\b/i.test(term) && /\b(buy|order|detailed|personal|custom)\b/i.test(term))) {
    return { kind: "transactional", score: 92, reason: "Contains purchase or delivered-report language." };
  }
  if (COMMERCIAL.test(term) && /\b(report|chart|numerology|astrology)\b/i.test(term)) {
    return { kind: "commercial_investigation", score: 78, reason: "Comparison or quality language around a report offer." };
  }
  if (PROBLEM.test(term)) {
    return { kind: "problem_desire", score: 64, reason: "Expresses a personal problem or desired insight." };
  }
  if (INFORMATIONAL.test(term)) {
    return { kind: "informational", score: 28, reason: "Looks like a definition or explainer query." };
  }
  if (/\breport\b/i.test(term)) {
    return { kind: "commercial_investigation", score: 70, reason: "Report language without a clear purchase verb." };
  }
  return { kind: "informational", score: 36, reason: "No strong transaction or problem language." };
}

export function scoreDivin8Relevance(term: string, catalogText: string): { label: PmaRelevanceLabel; score: number; reason: string } {
  const tokens = new Set(tokenize(term));
  const catalogTokens = new Set(tokenize(catalogText));
  const overlap = [...tokens].filter((token) => catalogTokens.has(token));
  const hasReport = tokens.has("report") || tokens.has("chart");
  const hasCore = ["natal", "birth", "numerology", "astrology", "divin8", "blueprint"].some((token) => tokens.has(token));
  if (hasCore && hasReport && overlap.length >= 2) {
    return { label: "Excellent", score: 94, reason: "Matches a Divin8 report product and catalog language." };
  }
  if (hasCore && (hasReport || overlap.length >= 2)) {
    return { label: "Strong", score: 80, reason: "Aligns with a Divin8 system or report type." };
  }
  if (hasCore || overlap.length >= 2) {
    return { label: "Moderate", score: 56, reason: "Related to astrology or self-knowledge, but not a clear report offer." };
  }
  return { label: "Weak", score: 22, reason: "Little overlap with approved Divin8 catalog facts." };
}

export function scoreSpecificity(term: string) {
  const tokens = tokenize(term);
  if (tokens.length >= 4) return 86;
  if (tokens.length === 3) return 72;
  if (tokens.length === 2) return 48;
  return 24;
}

export function opportunityScore(input: {
  intentScore: number;
  relevanceScore: number;
  specificityScore: number;
  behaviorScore: number | null;
}) {
  const weights = input.behaviorScore == null
    ? { intent: 0.4, relevance: 0.4, specificity: 0.2, behavior: 0 }
    : { intent: 0.35, relevance: 0.35, specificity: 0.15, behavior: 0.15 };
  const score = Math.round(
    input.intentScore * weights.intent
    + input.relevanceScore * weights.relevance
    + input.specificityScore * weights.specificity
    + (input.behaviorScore ?? 0) * weights.behavior,
  );
  return {
    score: Math.max(0, Math.min(100, score)),
    weights,
    reason: input.behaviorScore == null
      ? "Weighted from intent, Divin8 relevance, and specificity. Behavior was omitted because no matching Umani signal exists."
      : "Weighted from intent, Divin8 relevance, specificity, and first-party Umani behavior.",
  };
}

function jaccard(a: Set<string>, b: Set<string>) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export function clusterTerms(terms: string[]) {
  const clusters: Array<{ id: string; terms: string[]; tokens: Set<string> }> = [];
  for (const term of terms) {
    const tokens = new Set(tokenize(term));
    let best = -1;
    let bestScore = 0;
    clusters.forEach((cluster, index) => {
      const score = jaccard(tokens, cluster.tokens);
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
    if (best >= 0 && bestScore >= 0.28) {
      clusters[best].terms.push(term);
      tokens.forEach((token) => clusters[best].tokens.add(token));
    } else {
      clusters.push({ id: `cluster_${clusters.length + 1}`, terms: [term], tokens });
    }
  }
  return clusters.map((cluster) => {
    const counts = new Map<string, number>();
    for (const term of cluster.terms) {
      for (const token of tokenize(term)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
    const name = [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 3)
      .map(([token]) => token)
      .join(" ");
    return {
      id: cluster.id,
      name: titleCase(name || cluster.terms[0] || "Untitled cluster"),
      terms: cluster.terms,
    };
  });
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function catalogSeedTerms() {
  return getDivin8AdvertisingCatalog().map((entry) => normalizeKeyword(entry.displayName)).filter(Boolean);
}

export function suggestNegatives(candidates: PmaKeywordCandidate[]): PmaNegativeCandidate[] {
  return NEGATIVE_THEMES.map((theme) => {
    const themePattern = new RegExp(`\\b${theme.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const matches = candidates.filter((candidate) => themePattern.test(candidate.term));
    const keep = matches.some((candidate) => candidate.intent === "transactional" && candidate.relevanceScore >= 80);
    return {
      term: theme.term,
      reason: theme.reason,
      confidence: matches.length ? "Medium" : "Low",
      evidence: matches.length
        ? `Observed in: ${matches.slice(0, 3).map((item) => item.term).join(", ")}`
        : "Heuristic theme. No imported Prime Mentor results contradict it yet.",
      clusterId: matches[0]?.clusterId ?? null,
      action: keep ? "Keep" : matches.length ? "Test exclude" : "Monitor",
    };
  });
}

function treatmentFor(cluster: { intent: PmaIntentKind; relevance: PmaRelevanceLabel; opportunity: number; behaviorLabel: string }) {
  if (cluster.intent === "poor_fit" || cluster.relevance === "Weak") {
    return { treatment: "Negative candidate", reason: "Poor fit or weak Divin8 alignment." };
  }
  if (cluster.intent === "informational") {
    return { treatment: "Organic-only", reason: "Informational demand is better served organically than paid." };
  }
  if (cluster.opportunity >= 80 && cluster.relevance === "Excellent") {
    return { treatment: "Dedicated ad group", reason: "High intent and excellent Divin8 fit deserve their own ad group." };
  }
  if (cluster.opportunity >= 70) {
    return { treatment: "Phrase-match expansion", reason: "Strong enough to test as a phrase-match theme." };
  }
  if (cluster.behaviorLabel.toLowerCase().includes("weak")) {
    return { treatment: "Landing-page variant", reason: "Onsite behavior is weaker than the keyword theory." };
  }
  return { treatment: "Monitor", reason: "Keep watching until more first-party evidence arrives." };
}

export function buildCampaignFromCluster(input: {
  projectName: string;
  cluster: PmaCluster;
  candidates: PmaKeywordCandidate[];
}): PmaCampaignIdea {
  const terms = input.candidates.filter((candidate) => candidate.clusterId === input.cluster.id);
  const exact = terms
    .filter((candidate) => candidate.intent !== "poor_fit" && (candidate.intent === "transactional" || candidate.specificityScore >= 72))
    .map((item) => item.term);
  const phrase = terms.filter((candidate) => !exact.includes(candidate.term) && candidate.intent !== "poor_fit").map((item) => item.term);
  const expansion = terms.filter((candidate) => candidate.intent === "problem_desire").map((item) => item.term);
  return {
    name: `Divin8 — ${input.cluster.name}`,
    objective: "Find people searching for a personal Divin8 report and send them to /reports.",
    audienceIntent: input.cluster.intent.replaceAll("_", " "),
    geography: "English-speaking markets first; tighten after evidence.",
    strategy: "Exact and phrase search around one cluster. No Performance Max. Proposal only.",
    adGroups: [{
      name: input.cluster.name,
      rationale: input.cluster.treatmentReason,
      keywords: input.cluster.terms,
    }],
    exactKeywords: exact.slice(0, 8),
    phraseKeywords: phrase.slice(0, 8),
    expansionKeywords: expansion.slice(0, 6),
    negatives: suggestNegatives(terms).filter((item) => item.action === "Test exclude").map((item) => item.term),
    headlines: [
      `${input.cluster.name} report`,
      "A detailed personal Divin8 report",
      "See the systems behind the reading",
    ],
    descriptions: [
      "Divin8 Reports combine natal, numerology, and related systems into one personal reading.",
      "Land on the reports page and choose the report that matches the question you are actually asking.",
    ],
    differentiation: "Specific report language over generic astrology curiosity.",
    adAngle: "Depth and personal detail, not destiny guarantees.",
    landingPage: "/reports",
    congruenceNotes: "The ad should promise a personal report, not a free calculator or daily horoscope.",
    experiment: {
      hypothesis: `High-intent "${input.cluster.name}" traffic will respond better to depth-based messaging than generic destiny copy.`,
      control: "Current reports landing message",
      variant: "Depth-focused ad pointing at the same /reports page",
      primaryMetric: "Checkout starts and purchases from Prime Mentor commerce data",
      secondaryMetric: "Umani CTA clicks and /reports bounce rate",
    },
    priority: {
      impact: input.cluster.opportunityScore >= 80 ? "High" : "Medium",
      confidence: input.cluster.behaviorLabel === "Unknown" ? "Low" : "Medium",
      effort: "Low",
      risk: "Low",
    },
  };
}

export function behaviorScoreFromInsight(insight: PmaBehaviorInsight): number | null {
  if (insight.status !== "ok" || !insight.reportsPath || insight.reportsPath.visitors <= 0) return null;
  const bounce = insight.reportsPath.bounceRate;
  const cta = insight.ctaClicks ?? 0;
  const purchases = insight.purchases ?? 0;
  if (purchases > 0) return 88;
  if (cta > 0 && bounce < 50) return 74;
  if (bounce < 45) return 62;
  if (bounce > 70 && cta === 0) return 28;
  return 50;
}

export function analyzeKeywords(input: {
  seeds: string[];
  imported?: Array<{ term: string; metrics: PmaImportedMetrics }>;
  knowledgeTerms?: string[];
  screenshotTerms?: string[];
  behavior: PmaBehaviorInsight;
  projectName?: string;
}): PmaAnalysisPayload {
  const catalog = getDivin8AdvertisingCatalog();
  const catalogText = catalog.map((entry) => `${entry.displayName} ${entry.shortDescription} ${entry.systems.join(" ")}`).join(" ");
  const seedTerms = input.seeds.length ? input.seeds : PMA_DEFAULT_SEEDS;
  const importedMap = new Map((input.imported ?? []).map((row) => [row.term, row.metrics]));
  const unique = [...new Set([
    ...seedTerms.map(normalizeKeyword),
    ...catalogSeedTerms(),
    ...(input.knowledgeTerms ?? []).map(normalizeKeyword),
    ...(input.screenshotTerms ?? []).map(normalizeKeyword),
    ...[...importedMap.keys()],
  ])].filter(Boolean);

  const grouped = clusterTerms(unique);
  const termCluster = new Map<string, string>();
  for (const cluster of grouped) {
    for (const term of cluster.terms) termCluster.set(term, cluster.id);
  }

  const behaviorScore = behaviorScoreFromInsight(input.behavior);
  const candidates: PmaKeywordCandidate[] = unique.map((term) => {
    const intent = classifyIntent(term);
    const relevance = scoreDivin8Relevance(term, catalogText);
    const specificity = scoreSpecificity(term);
    const opportunity = opportunityScore({
      intentScore: intent.score,
      relevanceScore: relevance.score,
      specificityScore: specificity,
      behaviorScore,
    });
    const source = importedMap.has(term)
      ? "import"
      : (input.screenshotTerms ?? []).includes(term)
        ? "screenshot"
        : seedTerms.map(normalizeKeyword).includes(term)
          ? "seed"
          : catalogSeedTerms().includes(term)
            ? "catalog"
            : "knowledge";
    return {
      term,
      source,
      intent: intent.kind,
      intentReason: intent.reason,
      intentScore: intent.score,
      relevanceLabel: relevance.label,
      relevanceReason: relevance.reason,
      relevanceScore: relevance.score,
      specificityScore: specificity,
      opportunityScore: opportunity.score,
      opportunityReason: opportunity.reason,
      clusterId: termCluster.get(term) ?? null,
      metrics: importedMap.get(term) ?? {},
    };
  });

  const clusters: PmaCluster[] = grouped.map((cluster) => {
    const members = candidates.filter((candidate) => candidate.clusterId === cluster.id);
    const intent = members.sort((left, right) => right.intentScore - left.intentScore)[0]?.intent ?? "informational";
    const relevance = members.sort((left, right) => right.relevanceScore - left.relevanceScore)[0]?.relevanceLabel ?? "Weak";
    const opportunity = members.length
      ? Math.round(members.reduce((sum, item) => sum + item.opportunityScore, 0) / members.length)
      : 0;
    const behaviorLabel = input.behavior.status !== "ok"
      ? "Unknown"
      : (input.behavior.purchases ?? 0) > 0
        ? "Purchase evidence"
        : (input.behavior.ctaClicks ?? 0) > 0
          ? "CTA activity"
          : input.behavior.reportsPath
            ? "Visits only"
            : "Unknown";
    const next = treatmentFor({ intent, relevance, opportunity, behaviorLabel });
    return {
      id: cluster.id,
      name: cluster.name,
      termCount: cluster.terms.length,
      terms: cluster.terms,
      intent,
      relevanceLabel: relevance,
      opportunityScore: opportunity,
      behaviorLabel,
      treatment: next.treatment,
      treatmentReason: next.reason,
    };
  }).sort((left, right) => right.opportunityScore - left.opportunityScore);

  const campaignIdeas = clusters
    .filter((cluster) => cluster.treatment === "Dedicated ad group" || cluster.treatment === "Phrase-match expansion")
    .slice(0, 3)
    .map((cluster) => buildCampaignFromCluster({
      projectName: input.projectName ?? "Divin8 Reports",
      cluster,
      candidates,
    }));

  return {
    candidates,
    clusters,
    negatives: suggestNegatives(candidates),
    behavior: input.behavior,
    campaignIdeas,
    scoringWeights: {
      intent: behaviorScore == null ? 40 : 35,
      relevance: behaviorScore == null ? 40 : 35,
      specificity: behaviorScore == null ? 20 : 15,
      behavior: behaviorScore == null ? 0 : 15,
      note: "Missing signals are omitted rather than invented. Search volume, CPC, and competition are unknown.",
    },
    providers: {
      googleAds: "unavailable",
      searchConsole: "unavailable",
      umami: input.behavior.status,
      searxng: "unavailable",
    },
  };
}

export function emptyBehavior(warning = "Umani behavior is unavailable."): PmaBehaviorInsight {
  return {
    status: "unavailable",
    range: "30d",
    warning,
    landingPage: "/reports",
    sessions: null,
    pageviews: null,
    bounceRate: null,
    ctaClicks: null,
    purchases: null,
    hasUtmData: false,
    campaigns: [],
    reportsPath: null,
    note: "Engagement is not treated as conversion. Purchases come from Prime Mentor commerce data when available.",
  };
}
