import { adsCampaignProposals, type Database } from "@wisdom/db";
import { desc, eq } from "drizzle-orm";
import { createHttpError } from "../../booking/errors.js";
import { getDivin8AdvertisingKnowledge } from "../adsKnowledgeService.js";
import { analyzeKeywords, buildCampaignFromCluster, emptyBehavior, parseKeywordCsv, parseKeywordList } from "./pmaEngine.js";
import { knowledgeSeedTerms } from "./pmaKnowledge.js";
import {
  ensureDefaultPmaProject,
  getPmaProject,
  insertPmaAnalysis,
  latestPmaAnalysis,
  listPmaProjects,
  updatePmaAnalysis,
} from "./pmaStore.js";
import type { PmaAnalysisPayload, PmaCampaignIdea } from "./pmaTypes.js";
import { loadPmaBehaviorSignals } from "./pmaUmaniAdapter.js";

export async function getPmaWorkspace(db: Database, projectKey = "divin8-reports") {
  const project = await getPmaProject(db, projectKey) ?? await ensureDefaultPmaProject(db);
  const analysis = await latestPmaAnalysis(db, project.id);
  return {
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      offerKey: project.offer_key,
    },
    analysis: analysis
      ? {
        id: analysis.id,
        status: analysis.status,
        stage: analysis.stage,
        seeds: analysis.seeds,
        payload: analysis.payload as PmaAnalysisPayload,
        error: analysis.error,
        updatedAt: analysis.updated_at?.toISOString() ?? analysis.created_at.toISOString(),
      }
      : null,
  };
}

export async function listPmaWorkspaceProjects(db: Database) {
  const rows = await listPmaProjects(db);
  return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, offerKey: row.offer_key }));
}

export async function runPmaAnalysis(input: {
  db: Database;
  userId: string;
  projectKey?: string;
  seedsText?: string;
  csvText?: string;
  includeCatalog?: boolean;
  screenshotTerms?: string[];
  logger: { warn: (payload: Record<string, unknown>, message: string) => void };
}) {
  const project = await getPmaProject(input.db, input.projectKey ?? "divin8-reports")
    ?? await ensureDefaultPmaProject(input.db);
  const seeds = parseKeywordList(input.seedsText ?? "");
  const imported = input.csvText ? parseKeywordCsv(input.csvText) : [];
  if (seeds.length + imported.length === 0 && !input.includeCatalog) {
    throw createHttpError(400, "Add at least one seed keyword, or include catalog discovery.");
  }

  const analysis = await insertPmaAnalysis(input.db, {
    projectId: project.id,
    userId: input.userId,
    seeds,
    status: "running",
    stage: "Discovering terms",
  });

  try {
    const knowledge = await getDivin8AdvertisingKnowledge(input.db);
    const knowledgeTerms = [
      ...knowledgeSeedTerms(),
      ...knowledge.customEntries.map((entry) => entry.title),
    ];
    const behavior = await loadPmaBehaviorSignals({
      db: input.db,
      actor: { actorRole: "admin", actorUserId: input.userId },
      logger: input.logger,
    }).catch(() => emptyBehavior());

    const payload = analyzeKeywords({
      seeds,
      imported,
      knowledgeTerms: input.includeCatalog === false ? [] : knowledgeTerms,
      screenshotTerms: input.screenshotTerms,
      behavior,
      projectName: project.name,
    });

    await updatePmaAnalysis(input.db, analysis.id, {
      status: "complete",
      stage: "Building recommendations",
      payload,
      error: null,
    });
    return getPmaWorkspace(input.db, project.id);
  } catch (error) {
    await updatePmaAnalysis(input.db, analysis.id, {
      status: "error",
      error: error instanceof Error ? error.message : "PMA analysis failed",
    });
    throw error;
  }
}

export async function buildPmaCampaignProposal(input: {
  db: Database;
  userId: string;
  projectKey?: string;
  clusterId: string;
}) {
  const workspace = await getPmaWorkspace(input.db, input.projectKey);
  const payload = workspace.analysis?.payload;
  const cluster = payload?.clusters.find((item) => item.id === input.clusterId);
  if (!payload || !cluster) {
    throw createHttpError(404, "Analyze keywords before building a campaign from a cluster.");
  }
  const idea = payload.campaignIdeas.find((item) => item.adGroups[0]?.name === cluster.name)
    ?? buildCampaignFromCluster({
      projectName: workspace.project.name,
      cluster,
      candidates: payload.candidates,
    });
  const [row] = await input.db.insert(adsCampaignProposals).values({
    user_id: input.userId,
    status: "draft",
    objective: idea.objective,
    campaign_type: "Search",
    geography: idea.geography,
    audience: idea.audienceIntent,
    landing_page: idea.landingPage,
    strategy_notes: idea.strategy,
    experiment_hypothesis: idea.experiment.hypothesis,
    payload: idea as unknown as Record<string, unknown>,
  }).returning();
  return { proposalId: row!.id, idea, project: workspace.project, cluster };
}

export async function listPmaCampaignProposals(db: Database, userId: string) {
  const rows = await db.select().from(adsCampaignProposals)
    .where(eq(adsCampaignProposals.user_id, userId))
    .orderBy(desc(adsCampaignProposals.created_at))
    .limit(20);
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    objective: row.objective,
    campaignType: row.campaign_type,
    geography: row.geography,
    audience: row.audience,
    landingPage: row.landing_page,
    strategyNotes: row.strategy_notes,
    experimentHypothesis: row.experiment_hypothesis,
    payload: row.payload as PmaCampaignIdea | Record<string, unknown>,
    updatedAt: row.updated_at?.toISOString() ?? row.created_at.toISOString(),
  }));
}

export function summarizePmaForAgent(workspace: Awaited<ReturnType<typeof getPmaWorkspace>>) {
  const payload = workspace.analysis?.payload;
  if (!payload) {
    return {
      project: workspace.project.name,
      analyzed: false,
      note: "No PMA analysis yet.",
    };
  }
  return {
    project: workspace.project.name,
    analyzed: true,
    topClusters: payload.clusters.slice(0, 4).map((cluster) => ({
      id: cluster.id,
      name: cluster.name,
      intent: cluster.intent,
      divin8Fit: cluster.relevanceLabel,
      opportunity: cluster.opportunityScore,
      behavior: cluster.behaviorLabel,
      treatment: cluster.treatment,
    })),
    negatives: payload.negatives.filter((item) => item.action === "Test exclude").slice(0, 5),
    behavior: {
      status: payload.behavior.status,
      ctaClicks: payload.behavior.ctaClicks,
      purchases: payload.behavior.purchases,
      reportsPath: payload.behavior.reportsPath,
      warning: payload.behavior.warning,
    },
    providers: payload.providers,
    scoringNote: payload.scoringWeights.note,
  };
}
