import { adsPmaAnalyses, adsPmaProjects, type Database } from "@wisdom/db";
import { desc, eq } from "drizzle-orm";
import { PMA_DEFAULT_PROJECT } from "./pmaTypes.js";

export async function ensureDefaultPmaProject(db: Database) {
  const [existing] = await db.select().from(adsPmaProjects).where(eq(adsPmaProjects.slug, PMA_DEFAULT_PROJECT.slug)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(adsPmaProjects).values({
    slug: PMA_DEFAULT_PROJECT.slug,
    name: PMA_DEFAULT_PROJECT.name,
    offer_key: PMA_DEFAULT_PROJECT.offerKey,
  }).returning();
  return created!;
}

export async function listPmaProjects(db: Database) {
  await ensureDefaultPmaProject(db);
  return db.select().from(adsPmaProjects);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPmaProjectId(value: string) {
  return UUID_RE.test(value);
}

export async function getPmaProject(db: Database, idOrSlug: string) {
  await ensureDefaultPmaProject(db);
  if (isPmaProjectId(idOrSlug)) {
    const [byId] = await db.select().from(adsPmaProjects).where(eq(adsPmaProjects.id, idOrSlug)).limit(1);
    if (byId) return byId;
  }
  const [bySlug] = await db.select().from(adsPmaProjects).where(eq(adsPmaProjects.slug, idOrSlug)).limit(1);
  return bySlug ?? null;
}

export async function latestPmaAnalysis(db: Database, projectId: string) {
  const [row] = await db.select().from(adsPmaAnalyses)
    .where(eq(adsPmaAnalyses.project_id, projectId))
    .orderBy(desc(adsPmaAnalyses.created_at))
    .limit(1);
  return row ?? null;
}

export async function insertPmaAnalysis(db: Database, input: {
  projectId: string;
  userId?: string | null;
  seeds: string[];
  status: string;
  stage?: string | null;
  payload?: Record<string, unknown>;
  error?: string | null;
}) {
  const [row] = await db.insert(adsPmaAnalyses).values({
    project_id: input.projectId,
    created_by_user_id: input.userId ?? null,
    seeds: input.seeds,
    status: input.status,
    stage: input.stage ?? null,
    payload: input.payload ?? {},
    error: input.error ?? null,
  }).returning();
  return row!;
}

export async function updatePmaAnalysis(db: Database, id: string, patch: {
  status?: string;
  stage?: string | null;
  payload?: Record<string, unknown>;
  error?: string | null;
}) {
  const [row] = await db.update(adsPmaAnalyses).set({
    ...patch,
    updated_at: new Date(),
  }).where(eq(adsPmaAnalyses.id, id)).returning();
  return row ?? null;
}
