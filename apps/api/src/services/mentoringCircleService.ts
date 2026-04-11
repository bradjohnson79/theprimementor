import { and, eq } from "drizzle-orm";
import { mentoringCircleRegistrations, type Database } from "@wisdom/db";
import { PLATFORM_TIMEZONE, toUtcIsoString } from "@wisdom/utils";
import { resolveMemberAccess } from "./divin8/memberAccessService.js";
import { createZoomMeeting } from "./zoomService.js";
import { createHttpError } from "./booking/errors.js";

const MENTORING_CIRCLE_EVENT = {
  eventKey: "mentoring-circle-april-26-2026",
  eventTitle: "Mentoring Circle: The Prime Law",
  eventStartAt: "2026-04-26T09:00:00-07:00",
  timezone: PLATFORM_TIMEZONE,
  durationMinutes: 90,
  priceCents: 2500,
  posterPath: "/images/mentoring-circle-april-26.png",
} as const;

export interface MentoringCircleState {
  eventKey: string;
  eventTitle: string;
  sessionDate: string;
  timezone: string;
  posterPath: string;
  priceCents: number;
  registered: boolean;
  joinUrl: string | null;
}

type RegistrationRow = typeof mentoringCircleRegistrations.$inferSelect;

function serializeState(row: RegistrationRow | null): MentoringCircleState {
  return {
    eventKey: MENTORING_CIRCLE_EVENT.eventKey,
    eventTitle: MENTORING_CIRCLE_EVENT.eventTitle,
    sessionDate: toUtcIsoString(new Date(MENTORING_CIRCLE_EVENT.eventStartAt)),
    timezone: MENTORING_CIRCLE_EVENT.timezone,
    posterPath: MENTORING_CIRCLE_EVENT.posterPath,
    priceCents: MENTORING_CIRCLE_EVENT.priceCents,
    registered: Boolean(row),
    joinUrl: row?.join_url ?? null,
  };
}

async function getExistingRegistration(db: Database, userId: string) {
  const [row] = await db
    .select()
    .from(mentoringCircleRegistrations)
    .where(and(
      eq(mentoringCircleRegistrations.user_id, userId),
      eq(mentoringCircleRegistrations.event_key, MENTORING_CIRCLE_EVENT.eventKey),
    ))
    .limit(1);
  return row ?? null;
}

export async function getMentoringCircleStateForUser(db: Database, userId: string): Promise<MentoringCircleState> {
  const existing = await getExistingRegistration(db, userId);
  return serializeState(existing);
}

export async function registerForMentoringCircle(
  db: Database,
  input: { userId: string; accessMode?: string },
): Promise<MentoringCircleState> {
  const existing = await getExistingRegistration(db, input.userId);
  if (existing) {
    return serializeState(existing);
  }

  const memberAccess = await resolveMemberAccess(db, input.userId);
  const includesMentorCircle = memberAccess?.capabilities.includesMentorCircle === true;
  const accessMode = typeof input.accessMode === "string" ? input.accessMode.trim() : "";

  if (!includesMentorCircle && accessMode !== "placeholder_paid") {
    throw createHttpError(403, "Payment is required before registration");
  }

  const meeting = await createZoomMeeting({
    topic: MENTORING_CIRCLE_EVENT.eventTitle,
    startTime: toUtcIsoString(new Date(MENTORING_CIRCLE_EVENT.eventStartAt)),
    duration: MENTORING_CIRCLE_EVENT.durationMinutes,
    timezone: MENTORING_CIRCLE_EVENT.timezone,
  });

  const [created] = await db
    .insert(mentoringCircleRegistrations)
    .values({
      user_id: input.userId,
      event_key: MENTORING_CIRCLE_EVENT.eventKey,
      event_title: MENTORING_CIRCLE_EVENT.eventTitle,
      event_start_at: new Date(MENTORING_CIRCLE_EVENT.eventStartAt),
      timezone: MENTORING_CIRCLE_EVENT.timezone,
      status: "registered",
      join_url: meeting.joinUrl,
    })
    .returning();

  return serializeState(created);
}
