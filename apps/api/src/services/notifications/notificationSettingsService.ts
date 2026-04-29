import { eq } from "drizzle-orm";
import { notificationSettings, type Database } from "@wisdom/db";
import {
  CONFIGURABLE_NOTIFICATION_EVENTS,
  type ConfigurableNotificationEvent,
  isNotificationConfigurable,
  type NotificationEvent,
} from "./events.js";
import { resolveAdminNotificationEmails } from "../contactService.js";

const NOTIFICATION_SETTINGS_ID = "default";

export type NotificationSettingsMap = Record<ConfigurableNotificationEvent, boolean>;

export interface NotificationSettingsState {
  enabledEvents: NotificationSettingsMap;
  adminRecipientsOverride: string[];
  effectiveAdminRecipients: string[];
}

const DEFAULT_ENABLED_EVENTS: NotificationSettingsMap = {
  "payment.succeeded": true,
  "payment.failed": true,
  "booking.created": true,
  "booking.confirmed": true,
  "mentoring_circle.confirmed": true,
  "mentoring_circle.reminder_24h": true,
  "mentoring_circle.reminder_1h": true,
  "report.generated": true,
  "admin.new.booking": true,
  "admin.new.user": true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEmailList(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      input
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry)),
    ),
  );
}

function normalizeEnabledEvents(input: unknown): NotificationSettingsMap {
  const enabled = isRecord(input) ? input : {};
  return CONFIGURABLE_NOTIFICATION_EVENTS.reduce((acc, event) => {
    acc[event] = typeof enabled[event] === "boolean" ? enabled[event] : DEFAULT_ENABLED_EVENTS[event];
    return acc;
  }, {} as NotificationSettingsMap);
}

async function ensureNotificationSettingsRow(db: Database) {
  await db
    .insert(notificationSettings)
    .values({
      id: NOTIFICATION_SETTINGS_ID,
      enabled_events: DEFAULT_ENABLED_EVENTS,
      admin_recipients: [],
    })
    .onConflictDoNothing({
      target: notificationSettings.id,
    });
}

async function getStoredNotificationSettings(db: Database) {
  await ensureNotificationSettingsRow(db);
  const [row] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.id, NOTIFICATION_SETTINGS_ID))
    .limit(1);

  if (!row) {
    throw new Error("Notification settings could not be loaded.");
  }

  return row;
}

export async function getNotificationSettings(db: Database): Promise<NotificationSettingsState> {
  const row = await getStoredNotificationSettings(db);
  const adminRecipientsOverride = normalizeEmailList(row.admin_recipients);
  const effectiveAdminRecipients = adminRecipientsOverride.length > 0
    ? adminRecipientsOverride
    : await resolveAdminNotificationEmails(db);

  return {
    enabledEvents: normalizeEnabledEvents(row.enabled_events),
    adminRecipientsOverride,
    effectiveAdminRecipients,
  };
}

export async function updateNotificationSettings(
  db: Database,
  input: {
    enabledEvents?: Partial<NotificationSettingsMap>;
    adminRecipientsOverride?: string[];
  },
): Promise<NotificationSettingsState> {
  const current = await getNotificationSettings(db);
  const nextEnabledEvents: NotificationSettingsMap = {
    ...current.enabledEvents,
    ...(input.enabledEvents ?? {}),
  };
  const nextAdminRecipientsOverride = input.adminRecipientsOverride
    ? normalizeEmailList(input.adminRecipientsOverride)
    : current.adminRecipientsOverride;

  await db
    .update(notificationSettings)
    .set({
      enabled_events: nextEnabledEvents,
      admin_recipients: nextAdminRecipientsOverride,
      updated_at: new Date(),
    })
    .where(eq(notificationSettings.id, NOTIFICATION_SETTINGS_ID));

  return getNotificationSettings(db);
}

export async function isNotificationEnabled(
  db: Database,
  event: NotificationEvent,
): Promise<boolean> {
  if (!isNotificationConfigurable(event)) {
    return true;
  }

  const settings = await getNotificationSettings(db);
  return settings.enabledEvents[event as ConfigurableNotificationEvent];
}
