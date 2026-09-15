import { and, eq } from "drizzle-orm";
import { webinarRecordingProgress, type Database } from "@wisdom/db";
import { boundOnDemandProgressSeconds, getOnDemandWebinarById } from "@wisdom/utils";
import { createHttpError } from "../booking/errors.js";

export async function getOnDemandWebinarProgress(
  db: Database,
  input: { userId: string; webinarId: string },
) {
  const webinar = getOnDemandWebinarById(input.webinarId);
  if (!webinar) {
    throw createHttpError(404, "On-demand webinar was not found.");
  }
  const [row] = await db
    .select()
    .from(webinarRecordingProgress)
    .where(and(
      eq(webinarRecordingProgress.user_id, input.userId),
      eq(webinarRecordingProgress.webinar_id, input.webinarId),
    ))
    .limit(1);

  return {
    webinarId: input.webinarId,
    positionSeconds: boundOnDemandProgressSeconds(row?.position_seconds ?? 0, webinar.durationSeconds),
    durationSeconds: webinar.durationSeconds,
    updatedAt: row?.updated_at?.toISOString() ?? null,
  };
}

export async function upsertOnDemandWebinarProgress(
  db: Database,
  input: { userId: string; webinarId: string; positionSeconds: number },
) {
  const webinar = getOnDemandWebinarById(input.webinarId);
  if (!webinar) {
    throw createHttpError(404, "On-demand webinar was not found.");
  }
  const positionSeconds = boundOnDemandProgressSeconds(input.positionSeconds, webinar.durationSeconds);
  const now = new Date();

  const [existing] = await db
    .select({ id: webinarRecordingProgress.id })
    .from(webinarRecordingProgress)
    .where(and(
      eq(webinarRecordingProgress.user_id, input.userId),
      eq(webinarRecordingProgress.webinar_id, input.webinarId),
    ))
    .limit(1);

  if (existing) {
    await db
      .update(webinarRecordingProgress)
      .set({
        position_seconds: positionSeconds,
        updated_at: now,
      })
      .where(eq(webinarRecordingProgress.id, existing.id));
  } else {
    await db.insert(webinarRecordingProgress).values({
      user_id: input.userId,
      webinar_id: input.webinarId,
      position_seconds: positionSeconds,
    });
  }

  return {
    webinarId: input.webinarId,
    positionSeconds,
    durationSeconds: webinar.durationSeconds,
    updatedAt: now.toISOString(),
  };
}
