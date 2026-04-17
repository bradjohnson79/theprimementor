import { and, desc, eq, inArray } from "drizzle-orm";
import { bookings, mentoringCircleRegistrations, payments, type Database } from "@wisdom/db";
import { logger, toUtcIsoString } from "@wisdom/utils";
import { sendMentoringCircleReminderNotification } from "./booking/notificationService.js";
import { createHttpError } from "./booking/errors.js";

export const MENTORING_CIRCLE_BOOKING_TYPE_ID = "mentoring-circle-prime-law";

export interface MentoringCircleEventDefinition {
  eventId: string;
  eventKey: string;
  eventTitle: string;
  eventStartAt: string;
  salesOpenAt: string;
  timezone: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  posterPath: string;
  zoomLink: string;
  legacyEventKeys?: string[];
}

export interface MentoringCircleEventState {
  eventId: string;
  eventKey: string;
  eventTitle: string;
  sessionDate: string;
  salesOpenAt: string;
  salesOpen: boolean;
  timezone: string;
  posterPath: string;
  priceCents: number;
  currency: string;
  bookingId: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  purchaseStatus: "not_started" | "pending_payment" | "confirmed";
  accessStatus: "locked" | "pending_payment" | "confirmed";
  joinEligible: boolean;
  registered: boolean;
  joinUrl: string | null;
}

export interface MentoringCircleState {
  currentEvent: MentoringCircleEventState | null;
  nextEvent: MentoringCircleEventState | null;
  activeEventForPurchase: MentoringCircleEventState | null;
  requestedEvent: MentoringCircleEventState | null;
}

type RegistrationRow = typeof mentoringCircleRegistrations.$inferSelect;

export interface MentoringCircleBookingAccessRow {
  bookingId: string;
  eventKey: string | null;
  status: string;
  joinUrl: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
}

export type MentoringCircleReminderWindow = "24h" | "1h";

export interface MentoringCircleReminderTarget {
  eventId: string;
  eventKey: string;
  reminderWindow: MentoringCircleReminderWindow;
  reminderAt: string;
}

export interface MentoringCircleReminderJobResult {
  processedEvents: MentoringCircleReminderTarget[];
  recipientsTargeted: number;
  notificationsAttempted: number;
  notificationsFailed: number;
}

const MENTORING_CIRCLE_TIMEZONE = "America/Vancouver";
const MENTORING_CIRCLE_REMINDER_GRACE_MS = 15 * 60_000;

const MENTORING_CIRCLE_EVENTS: MentoringCircleEventDefinition[] = [
  {
    eventId: "2026-04-26",
    eventKey: "2026-04-26",
    eventTitle: "Mentoring Circle: The Prime Law",
    eventStartAt: "2026-04-26T09:00:00-07:00",
    salesOpenAt: "2026-04-01T00:00:00-07:00",
    timezone: MENTORING_CIRCLE_TIMEZONE,
    durationMinutes: 90,
    priceCents: 2500,
    currency: "CAD",
    posterPath: "/images/mentoring-circle-april-26.png",
    zoomLink: "https://us02web.zoom.us/meeting/register/4mdPcnhtRTmneCxhp51-Fg",
    legacyEventKeys: ["mentoring-circle-april-26-2026"],
  },
  {
    eventId: "2026-05-31",
    eventKey: "2026-05-31",
    eventTitle: "Mentoring Circle: The Prime Law",
    eventStartAt: "2026-05-31T09:00:00-07:00",
    salesOpenAt: "2026-04-26T12:00:00-07:00",
    timezone: MENTORING_CIRCLE_TIMEZONE,
    durationMinutes: 90,
    priceCents: 2500,
    currency: "CAD",
    posterPath: "/images/mentoring-circle-april-26.png",
    zoomLink: process.env.MENTORING_CIRCLE_ZOOM_LINK_MAY?.trim()
      || "https://us02web.zoom.us/meeting/register/BA4QQLJyRtifARkT0kpk9g",
  },
].sort((left, right) => new Date(left.eventStartAt).getTime() - new Date(right.eventStartAt).getTime());

const CONFIRMED_BOOKING_STATUSES = new Set(["paid", "scheduled", "completed"]);

function getDefaultMentoringCircleEventId() {
  return MENTORING_CIRCLE_EVENTS[0]!.eventId;
}

export function getMentoringCircleEventOrThrow(eventId?: string | null): MentoringCircleEventDefinition {
  const normalizedEventId = typeof eventId === "string" && eventId.trim()
    ? eventId.trim()
    : getDefaultMentoringCircleEventId();
  const event = MENTORING_CIRCLE_EVENTS.find((candidate) =>
    candidate.eventId === normalizedEventId
    || candidate.eventKey === normalizedEventId
    || candidate.legacyEventKeys?.includes(normalizedEventId) === true,
  );
  if (!event) {
    throw createHttpError(404, "Mentoring Circle event not found");
  }
  return event;
}

function selectCurrentAndNextEvents(now = new Date()) {
  const currentIndex = MENTORING_CIRCLE_EVENTS.findIndex((event) => new Date(event.eventStartAt).getTime() > now.getTime());
  if (currentIndex === -1) {
    return { currentEvent: null, nextEvent: null };
  }

  return {
    currentEvent: MENTORING_CIRCLE_EVENTS[currentIndex] ?? null,
    nextEvent: MENTORING_CIRCLE_EVENTS[currentIndex + 1] ?? null,
  };
}

export function getActiveMentoringCirclePurchaseEvent(now = new Date()) {
  const { currentEvent, nextEvent } = selectCurrentAndNextEvents(now);
  if (nextEvent && now.getTime() >= new Date(nextEvent.salesOpenAt).getTime()) {
    return nextEvent;
  }
  return currentEvent;
}

function getMentoringCircleReminderOffsetMs(window: MentoringCircleReminderWindow) {
  return window === "24h" ? 24 * 60 * 60_000 : 60 * 60_000;
}

export function getDueMentoringCircleReminderTargets(now = new Date()): MentoringCircleReminderTarget[] {
  return MENTORING_CIRCLE_EVENTS.flatMap((event) => {
    return (["24h", "1h"] as const)
      .map((reminderWindow) => {
        const reminderAtDate = new Date(new Date(event.eventStartAt).getTime() - getMentoringCircleReminderOffsetMs(reminderWindow));
        return {
          eventId: event.eventId,
          eventKey: event.eventKey,
          reminderWindow,
          reminderAtDate,
        };
      })
      .filter(({ reminderAtDate }) => {
        const reminderAtMs = reminderAtDate.getTime();
        const nowMs = now.getTime();
        return nowMs >= reminderAtMs && nowMs < reminderAtMs + MENTORING_CIRCLE_REMINDER_GRACE_MS;
      })
      .map(({ reminderWindow, reminderAtDate }) => ({
        eventId: event.eventId,
        eventKey: event.eventKey,
        reminderWindow,
        reminderAt: reminderAtDate.toISOString(),
      }));
  });
}

export function buildMentoringCircleEventState(
  event: MentoringCircleEventDefinition,
  booking: MentoringCircleBookingAccessRow | null,
  registration: RegistrationRow | null,
  now = new Date(),
): MentoringCircleEventState {
  const confirmed = booking ? CONFIRMED_BOOKING_STATUSES.has(booking.status) : false;
  const pending = booking?.status === "pending_payment" || booking?.paymentStatus === "pending";
  const joinUrl = confirmed ? (registration?.join_url ?? booking?.joinUrl ?? event.zoomLink) : null;

  return {
    eventId: event.eventId,
    eventKey: event.eventKey,
    eventTitle: event.eventTitle,
    sessionDate: toUtcIsoString(new Date(event.eventStartAt)),
    salesOpenAt: toUtcIsoString(new Date(event.salesOpenAt)),
    salesOpen: now.getTime() >= new Date(event.salesOpenAt).getTime(),
    timezone: event.timezone,
    posterPath: event.posterPath,
    priceCents: event.priceCents,
    currency: event.currency,
    bookingId: booking?.bookingId ?? null,
    paymentId: booking?.paymentId ?? null,
    paymentStatus: booking?.paymentStatus ?? null,
    purchaseStatus: confirmed ? "confirmed" : pending ? "pending_payment" : "not_started",
    accessStatus: confirmed ? "confirmed" : pending ? "pending_payment" : "locked",
    joinEligible: confirmed,
    registered: confirmed,
    joinUrl,
  };
}

async function getExistingRegistration(db: Database, userId: string, eventKey: string) {
  const [row] = await db
    .select()
    .from(mentoringCircleRegistrations)
    .where(and(
      eq(mentoringCircleRegistrations.user_id, userId),
      eq(mentoringCircleRegistrations.event_key, eventKey),
    ))
    .limit(1);
  return row ?? null;
}

async function buildStateForEvent(
  db: Database,
  input: { userId: string; event: MentoringCircleEventDefinition; now?: Date },
): Promise<MentoringCircleEventState> {
  const booking = await getLatestBookingAccessRow(db, { userId: input.userId, eventKey: input.event.eventKey });
  let registration = await getExistingRegistration(db, input.userId, input.event.eventKey);
  if (booking && CONFIRMED_BOOKING_STATUSES.has(booking.status) && !registration) {
    registration = await upsertMentoringCircleRegistrationProjection(db, { bookingId: booking.bookingId });
  }

  return buildMentoringCircleEventState(input.event, booking, registration, input.now);
}

async function getLatestBookingAccessRow(
  db: Database,
  input: { userId: string; eventKey: string },
): Promise<MentoringCircleBookingAccessRow | null> {
  const [row] = await db
    .select({
      bookingId: bookings.id,
      eventKey: bookings.event_key,
      status: bookings.status,
      joinUrl: bookings.join_url,
      paymentId: payments.id,
      paymentStatus: payments.status,
    })
    .from(bookings)
    .leftJoin(payments, eq(payments.booking_id, bookings.id))
    .where(and(
      eq(bookings.user_id, input.userId),
      eq(bookings.event_key, input.eventKey),
    ))
    .orderBy(desc(bookings.created_at), desc(payments.created_at))
    .limit(1);

  return row ?? null;
}

export async function upsertMentoringCircleRegistrationProjection(
  db: Database,
  input: { bookingId: string },
): Promise<RegistrationRow> {
  const [booking] = await db
    .select({
      bookingId: bookings.id,
      userId: bookings.user_id,
      eventKey: bookings.event_key,
      status: bookings.status,
      joinUrl: bookings.join_url,
    })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);

  if (!booking) {
    throw createHttpError(404, "Mentoring Circle booking not found");
  }

  const event = getMentoringCircleEventOrThrow(booking.eventKey);
  if (!CONFIRMED_BOOKING_STATUSES.has(booking.status)) {
    throw createHttpError(400, "Mentoring Circle access is not confirmed");
  }

  const [upserted] = await db
    .insert(mentoringCircleRegistrations)
    .values({
      user_id: booking.userId,
      event_key: event.eventKey,
      event_title: event.eventTitle,
      event_start_at: new Date(event.eventStartAt),
      timezone: event.timezone,
      status: "registered",
      join_url: booking.joinUrl ?? event.zoomLink,
    })
    .onConflictDoUpdate({
      target: [mentoringCircleRegistrations.user_id, mentoringCircleRegistrations.event_key],
      set: {
        event_title: event.eventTitle,
        event_start_at: new Date(event.eventStartAt),
        timezone: event.timezone,
        status: "registered",
        join_url: booking.joinUrl ?? event.zoomLink,
        updated_at: new Date(),
      },
    })
    .returning();

  if (!upserted) {
    throw createHttpError(500, "Mentoring Circle projection could not be written");
  }

  return upserted;
}

export async function rebuildMentoringCircleRegistrationProjection(
  db: Database,
  input: { userId?: string; eventId?: string | null } = {},
) {
  const event = getMentoringCircleEventOrThrow(input.eventId);
  const conditions = [
    eq(bookings.event_key, event.eventKey),
    inArray(bookings.status, ["paid", "scheduled", "completed"]),
  ];
  if (input.userId) {
    conditions.push(eq(bookings.user_id, input.userId));
  }

  const rows = await db
    .select({ bookingId: bookings.id })
    .from(bookings)
    .where(and(...conditions));

  const results: RegistrationRow[] = [];
  for (const row of rows) {
    results.push(await upsertMentoringCircleRegistrationProjection(db, { bookingId: row.bookingId }));
  }
  return results;
}

export async function getMentoringCircleStateForUser(
  db: Database,
  userId: string,
  eventId?: string | null,
): Promise<MentoringCircleState> {
  const now = new Date();
  const { currentEvent, nextEvent } = selectCurrentAndNextEvents(now);
  const activeEvent = getActiveMentoringCirclePurchaseEvent(now);
  const requestedEvent = eventId ? getMentoringCircleEventOrThrow(eventId) : null;

  const [currentEventState, nextEventState, activeEventState, requestedEventState] = await Promise.all([
    currentEvent ? buildStateForEvent(db, { userId, event: currentEvent, now }) : Promise.resolve(null),
    nextEvent ? buildStateForEvent(db, { userId, event: nextEvent, now }) : Promise.resolve(null),
    activeEvent
      ? buildStateForEvent(db, { userId, event: activeEvent, now })
      : Promise.resolve(null),
    requestedEvent
      ? buildStateForEvent(db, { userId, event: requestedEvent, now })
      : Promise.resolve(null),
  ]);

  return {
    currentEvent: currentEventState,
    nextEvent: nextEventState,
    activeEventForPurchase: activeEventState,
    requestedEvent: requestedEventState,
  };
}

export async function runMentoringCircleReminderJob(
  db: Database,
  now = new Date(),
): Promise<MentoringCircleReminderJobResult> {
  const dueTargets = getDueMentoringCircleReminderTargets(now);
  if (dueTargets.length === 0) {
    return {
      processedEvents: [],
      recipientsTargeted: 0,
      notificationsAttempted: 0,
      notificationsFailed: 0,
    };
  }

  let recipientsTargeted = 0;
  let notificationsAttempted = 0;
  let notificationsFailed = 0;

  for (const target of dueTargets) {
    const event = getMentoringCircleEventOrThrow(target.eventId);
    const confirmedBookings = await db
      .select({
        bookingId: bookings.id,
        userId: bookings.user_id,
        joinUrl: bookings.join_url,
      })
      .from(bookings)
      .where(and(
        eq(bookings.event_key, event.eventKey),
        inArray(bookings.status, ["paid", "scheduled", "completed"]),
      ));

    recipientsTargeted += confirmedBookings.length;

    for (const booking of confirmedBookings) {
      notificationsAttempted += 1;
      try {
        await sendMentoringCircleReminderNotification(db, {
          entityId: `${booking.bookingId}:${target.reminderWindow}:${event.eventKey}`,
          bookingId: booking.bookingId,
          userId: booking.userId,
          bookingType: event.eventTitle,
          timezone: event.timezone,
          startTimeUtc: toUtcIsoString(new Date(event.eventStartAt)),
          eventId: event.eventId,
          eventTitle: event.eventTitle,
          joinUrl: booking.joinUrl ?? event.zoomLink,
          accessPagePath: "/mentoring-circle",
          reminderWindow: target.reminderWindow,
        });
      } catch (error) {
        notificationsFailed += 1;
        logger.error("mentoring_circle_reminder_notification_failed", {
          bookingId: booking.bookingId,
          userId: booking.userId,
          eventId: event.eventId,
          reminderWindow: target.reminderWindow,
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }

  return {
    processedEvents: dueTargets,
    recipientsTargeted,
    notificationsAttempted,
    notificationsFailed,
  };
}

export async function registerForMentoringCircle(
  db: Database,
  input: { userId: string; eventId?: string | null },
): Promise<MentoringCircleEventState> {
  const event = getMentoringCircleEventOrThrow(input.eventId);
  const state = await buildStateForEvent(db, { userId: input.userId, event });
  if (!state.joinEligible || !state.bookingId) {
    throw createHttpError(403, "Payment is required before registration");
  }

  await upsertMentoringCircleRegistrationProjection(db, { bookingId: state.bookingId });
  return buildStateForEvent(db, { userId: input.userId, event });
}
