import { createHttpError } from "../booking/errors.js";
import type { EmailListStore, HealthJobCounts } from "./emailListStore.js";
import { STALE_HEALTH_MS, isHealthJobScope, type HealthJobScope } from "./emailHealthTypes.js";
import {
  checkContactHealth,
  serializeHealthJob,
  type HealthCheckDeps,
} from "./emailHealthService.js";

const JOB_CONCURRENCY = 4;
const runningJobs = new Set<string>();

export function parseHealthCheckScope(body: Record<string, unknown>): {
  scope: HealthJobScope;
  ids: string[];
  force: boolean;
} {
  const scopeRaw = typeof body.scope === "string" ? body.scope : "";
  if (!isHealthJobScope(scopeRaw)) {
    throw createHttpError(400, "scope must be ids, unchecked, stale, or all_active");
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
  if (scopeRaw === "ids" && ids.length === 0) {
    throw createHttpError(400, "ids are required when scope is ids");
  }
  return { scope: scopeRaw, ids, force: body.force === true };
}

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) || 1 }, () => worker()));
}

function incrementCount(counts: HealthJobCounts, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

export async function startHealthCheckJob(
  store: EmailListStore,
  userId: string,
  body: Record<string, unknown>,
  deps: HealthCheckDeps = {},
) {
  const parsed = parseHealthCheckScope(body);
  const contacts = await store.listContactsForHealthScope({
    scope: parsed.scope,
    ids: parsed.ids,
    staleBefore: new Date(Date.now() - STALE_HEALTH_MS),
    force: parsed.force,
  });
  const job = await store.createHealthJob({
    user_id: userId,
    scope: parsed.scope,
    total: contacts.length,
    counts: {},
  });
  void runHealthCheckJob(store, job.id, contacts.map((row) => row.id), userId, deps);
  return serializeHealthJob(job);
}

export async function getHealthCheckJob(store: EmailListStore, id: string) {
  const job = await store.getHealthJob(id);
  if (!job) throw createHttpError(404, "Health check job not found");
  return serializeHealthJob(job);
}

export async function runHealthCheckJob(
  store: EmailListStore,
  jobId: string,
  contactIds: string[],
  userId: string,
  deps: HealthCheckDeps = {},
) {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);
  await store.updateHealthJob(jobId, { status: "running", total: contactIds.length });
  const counts: HealthJobCounts = {};
  let completed = 0;
  try {
    await mapPool(contactIds, JOB_CONCURRENCY, async (id) => {
      try {
        const result = await checkContactHealth(store, id, deps, userId);
        incrementCount(counts, result.healthStatus);
        if (result.purged) incrementCount(counts, "removed");
        if (result.suppressed) incrementCount(counts, "suppressed");
        if (["risky", "catch_all", "unknown", "soft_bounce"].includes(result.healthStatus)) {
          incrementCount(counts, "requiresReview");
        }
      } catch (error) {
        const current = await store.getContactById(id);
        if (!current) {
          incrementCount(counts, "skipped");
        } else {
          incrementCount(counts, "unknown");
          incrementCount(counts, "requiresReview");
          await store.updateContact(id, {
            health_status: current.health_status === "checking" ? "unknown" : current.health_status,
            health_checked_at: new Date(),
            health_reason: error instanceof Error ? "Health check failed. Contact left unchanged." : "Health check failed.",
          });
        }
      }
      completed += 1;
      await store.updateHealthJob(jobId, { completed, counts: { ...counts } });
    });
    await store.updateHealthJob(jobId, { status: "completed", completed, counts });
  } catch (error) {
    await store.updateHealthJob(jobId, {
      status: "failed",
      completed,
      counts,
      error: error instanceof Error ? error.message : "Health check job failed",
    });
  } finally {
    runningJobs.delete(jobId);
  }
}
