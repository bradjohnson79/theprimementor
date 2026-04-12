import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import {
  ALL_NOTIFICATION_EVENTS,
  CONFIGURABLE_NOTIFICATION_EVENTS,
  type NotificationEvent,
} from "../services/notifications/events.js";
import { previewNotification } from "../services/notifications/notificationPreview.js";
import { retryFailedNotifications, listNotificationActivity } from "../services/notifications/notificationRetryService.js";
import { getNotificationSettings, updateNotificationSettings } from "../services/notifications/notificationSettingsService.js";
import { sendNotification } from "../services/notifications/notificationService.js";
import { getNotificationDeliveryPolicy } from "../services/notifications/deliveryPolicy.js";

interface NotificationsQuerystring {
  limit?: string;
}

interface PreviewBody {
  event?: NotificationEvent;
  payload?: Record<string, unknown>;
}

interface TestBody {
  message?: string;
}

interface RetryBody {
  ids?: string[];
  limit?: number;
}

interface NotificationSettingsBody {
  enabledEvents?: Record<string, boolean>;
  adminRecipientsOverride?: string[];
}

function isNotificationEvent(value: unknown): value is NotificationEvent {
  return ALL_NOTIFICATION_EVENTS.includes(value as NotificationEvent);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAdminRecipientsOverride(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("adminRecipientsOverride must be an array of email addresses.");
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase());
}

export async function adminNotificationRoutes(app: FastifyInstance) {
  app.get<{ Querystring: NotificationsQuerystring }>(
    "/admin/notifications",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);
      const limit = Number(request.query.limit ?? "50");

      return ok({
        settings: await getNotificationSettings(db),
        deliveryPolicy: getNotificationDeliveryPolicy(),
        activity: await listNotificationActivity(db, Number.isFinite(limit) ? limit : 50),
        configurableEvents: CONFIGURABLE_NOTIFICATION_EVENTS,
      });
    },
  );

  app.post<{ Body: TestBody }>("/admin/notifications/test", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    const db = requireDatabase(app.db);
    const entityId = `admin-test-${Date.now()}`;
    const result = await sendNotification(db, {
      event: "admin.test",
      userId: request.dbUser?.id ?? null,
      payload: {
        entityId,
        message: request.body?.message ?? null,
        initiatedByUserId: request.dbUser?.id ?? null,
      },
    });

    return ok({
      entityId,
      result,
    });
  });

  app.post<{ Body: PreviewBody }>("/admin/notifications/preview", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const event = request.body?.event;
    if (!isNotificationEvent(event)) {
      return sendApiError(reply, 400, "A valid notification event is required.");
    }

    if (!isRecord(request.body?.payload)) {
      return sendApiError(reply, 400, "payload must be an object.");
    }

    return ok({
      ...previewNotification({
        event,
        payload: request.body.payload as never,
      }),
    });
  });

  app.post<{ Body: RetryBody }>("/admin/notifications/retry", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    const db = requireDatabase(app.db);
    return ok({
      ...(await retryFailedNotifications(db, {
        ids: Array.isArray(request.body?.ids) ? request.body.ids : undefined,
        limit: typeof request.body?.limit === "number" ? request.body.limit : undefined,
      })),
    });
  });

  app.patch<{ Body: NotificationSettingsBody }>(
    "/admin/notifications/settings",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      try {
        const enabledEventsPatch = isRecord(request.body?.enabledEvents)
          ? Object.fromEntries(
              Object.entries(request.body.enabledEvents).filter(
                ([event, value]) =>
                  CONFIGURABLE_NOTIFICATION_EVENTS.includes(event as typeof CONFIGURABLE_NOTIFICATION_EVENTS[number])
                  && typeof value === "boolean",
              ),
            )
          : undefined;

        return ok({
          ...(await updateNotificationSettings(db, {
            enabledEvents: enabledEventsPatch,
            adminRecipientsOverride: normalizeAdminRecipientsOverride(request.body?.adminRecipientsOverride),
          })),
        });
      } catch (error) {
        return sendApiError(reply, 400, error instanceof Error ? error.message : "Invalid notification settings.");
      }
    },
  );
}
