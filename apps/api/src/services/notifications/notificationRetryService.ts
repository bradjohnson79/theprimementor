import { desc, eq, inArray } from "drizzle-orm";
import {
  notificationEvents,
  type Database,
} from "@wisdom/db";
import type { NotificationEvent, NotificationPayloadMap } from "./events.js";
import { sendNotification } from "./notificationService.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function listNotificationActivity(db: Database, limit = 50) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  return db
    .select({
      id: notificationEvents.id,
      event_type: notificationEvents.event_type,
      entity_id: notificationEvents.entity_id,
      recipient: notificationEvents.recipient,
      recipient_type: notificationEvents.recipient_type,
      provider: notificationEvents.provider,
      provider_message_id: notificationEvents.provider_message_id,
      template_version: notificationEvents.template_version,
      status: notificationEvents.status,
      failure_reason: notificationEvents.failure_reason,
      sent_at: notificationEvents.sent_at,
      last_attempted_at: notificationEvents.last_attempted_at,
      created_at: notificationEvents.created_at,
      updated_at: notificationEvents.updated_at,
    })
    .from(notificationEvents)
    .orderBy(desc(notificationEvents.updated_at), desc(notificationEvents.created_at))
    .limit(safeLimit);
}

export async function retryFailedNotifications(
  db: Database,
  input: {
    ids?: string[];
    limit?: number;
  } = {},
) {
  const safeLimit = Math.min(Math.max(input.limit ?? 10, 1), 100);
  const whereClause = input.ids && input.ids.length > 0
    ? inArray(notificationEvents.id, input.ids)
    : eq(notificationEvents.status, "failed");

  const rows = await db
    .select({
      id: notificationEvents.id,
      event: notificationEvents.event_type,
      userId: notificationEvents.user_id,
      payload: notificationEvents.payload,
      status: notificationEvents.status,
    })
    .from(notificationEvents)
    .where(whereClause)
    .orderBy(desc(notificationEvents.updated_at))
    .limit(safeLimit);

  const retried = [];
  for (const row of rows) {
    if (row.status !== "failed") {
      continue;
    }

    if (!isRecord(row.payload)) {
      retried.push({
        id: row.id,
        success: false,
        error: "Stored notification payload is invalid.",
      });
      continue;
    }

    const result = await sendNotification(
      db,
      {
        event: row.event as NotificationEvent,
        userId: row.userId,
        payload: row.payload as NotificationPayloadMap[NotificationEvent],
      },
    );

    retried.push({
      id: row.id,
      success: result.success,
      skipped: result.skipped,
    });
  }

  return {
    total: retried.length,
    results: retried,
  };
}
