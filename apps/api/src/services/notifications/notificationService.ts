import { and, eq, sql } from "drizzle-orm";
import {
  notificationEvents,
  users,
  type Database,
} from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { getClerkIdentity } from "../clerkIdentityService.js";
import {
  applyNotificationDeliveryPolicy,
  getNotificationDeliveryPolicy,
} from "./deliveryPolicy.js";
import {
  getNotificationEntityId,
  getNotificationRecipientType,
  type NotificationRequest,
} from "./events.js";
import {
  getNotificationSettings,
  isNotificationEnabled,
} from "./notificationSettingsService.js";
import { sendResendEmail } from "./providers/resendProvider.js";
import { resolveNotificationTemplate } from "./templates/index.js";

type NotificationDbLike = Pick<Database, "select" | "insert" | "update" | "execute">;

interface ReservedNotificationRow {
  id: string;
  status: "pending" | "sent" | "failed" | "skipped_duplicate";
  sentAt: Date | null;
}

interface NotificationRecipients {
  recipientType: "user" | "admin";
  recipients: string[];
}

interface NotificationTestContext {
  source: "admin";
  requestedByUserId?: string | null;
}

export type SendNotificationInput<TEvent extends NotificationRequest["event"] = NotificationRequest["event"]> =
  NotificationRequest<TEvent> & {
    forceRecipients?: string[];
    dryRun?: boolean;
    testContext?: NotificationTestContext;
  };

async function withNotificationLock(db: NotificationDbLike, key: string) {
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('notification'), hashtext(${key}))`);
}

async function reserveNotificationRow(input: {
  db: Database;
  event: NotificationRequest["event"];
  entityId: string;
  userId: string | null;
  recipientType: "user" | "admin";
  recipient: string;
  provider: string;
  templateVersion: string;
  payload: Record<string, unknown>;
}) {
  return input.db.transaction(async (tx) => {
    const db = tx as unknown as NotificationDbLike;
    await withNotificationLock(db, `${input.event}:${input.entityId}:${input.recipientType}`);

    const [existing] = await db
      .select({
        id: notificationEvents.id,
        status: notificationEvents.status,
        sentAt: notificationEvents.sent_at,
      })
      .from(notificationEvents)
      .where(and(
        eq(notificationEvents.event_type, input.event),
        eq(notificationEvents.entity_id, input.entityId),
        eq(notificationEvents.recipient_type, input.recipientType),
      ))
      .limit(1);

    if (existing?.sentAt) {
      await db
        .update(notificationEvents)
        .set({
          status: "skipped_duplicate",
          recipient: input.recipient,
          provider: input.provider,
          payload: input.payload,
          template_version: input.templateVersion,
          failure_reason: null,
          last_attempted_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(notificationEvents.id, existing.id));

      return {
        kind: "duplicate" as const,
        row: existing,
      };
    }

    if (existing) {
      await db
        .update(notificationEvents)
        .set({
          user_id: input.userId,
          recipient: input.recipient,
          provider: input.provider,
          payload: input.payload,
          template_version: input.templateVersion,
          status: "pending",
          failure_reason: null,
          provider_message_id: null,
          last_attempted_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(notificationEvents.id, existing.id));

      return {
        kind: "reserved" as const,
        row: existing,
      };
    }

    const [created] = await db
      .insert(notificationEvents)
      .values({
        event_type: input.event,
        entity_id: input.entityId,
        user_id: input.userId,
        recipient_type: input.recipientType,
        recipient: input.recipient,
        provider: input.provider,
        template_version: input.templateVersion,
        status: "pending",
        payload: input.payload,
        last_attempted_at: new Date(),
      })
      .returning({
        id: notificationEvents.id,
        status: notificationEvents.status,
        sentAt: notificationEvents.sent_at,
      });

    return {
      kind: "reserved" as const,
      row: created,
    };
  });
}

async function markNotificationSent(
  db: NotificationDbLike,
  notificationId: string,
  provider: string,
  recipient: string,
  providerMessageId: string | null,
) {
  await db
    .update(notificationEvents)
    .set({
      status: "sent",
      provider,
      recipient,
      provider_message_id: providerMessageId,
      failure_reason: null,
      sent_at: new Date(),
      last_attempted_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(notificationEvents.id, notificationId));
}

async function markNotificationFailed(
  db: NotificationDbLike,
  notificationId: string,
  provider: string,
  recipient: string,
  reason: string,
) {
  await db
    .update(notificationEvents)
    .set({
      status: "failed",
      provider,
      recipient,
      failure_reason: reason,
      provider_message_id: null,
      last_attempted_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(notificationEvents.id, notificationId));
}

async function resolveUserRecipients(db: NotificationDbLike, userId: string): Promise<string[]> {
  const [user] = await db
    .select({
      clerkId: users.clerk_id,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.clerkId) {
    throw new Error(`User ${userId} is missing a Clerk identity.`);
  }

  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is not configured.");
  }

  const identity = await getClerkIdentity(secretKey, user.clerkId);
  return [identity.email.toLowerCase()];
}

async function resolveRecipients(
  db: Database,
  input: Pick<SendNotificationInput, "event" | "userId" | "forceRecipients">,
): Promise<NotificationRecipients> {
  const recipientType = getNotificationRecipientType(input.event);
  if (input.forceRecipients && input.forceRecipients.length > 0) {
    return {
      recipientType,
      recipients: input.forceRecipients,
    };
  }

  if (recipientType === "admin") {
    const settings = await getNotificationSettings(db);
    if (settings.effectiveAdminRecipients.length === 0) {
      throw new Error("Admin notification recipients are not configured.");
    }

    return {
      recipientType,
      recipients: settings.effectiveAdminRecipients,
    };
  }

  if (!input.userId) {
    throw new Error(`Event ${input.event} requires a userId.`);
  }

  return {
    recipientType,
    recipients: await resolveUserRecipients(db, input.userId),
  };
}

function logNotificationDelivery(input: {
  event: NotificationRequest["event"];
  entityId: string;
  recipient: string | null;
  recipientType: "user" | "admin";
  status: "sent" | "failed" | "skipped_duplicate";
  providerMessageId?: string | null;
  failureReason?: string | null;
  deliveryMode: string;
}) {
  logger.info("notification_delivery", {
    event: input.event,
    entityId: input.entityId,
    recipient: input.recipient,
    recipientType: input.recipientType,
    status: input.status,
    providerMessageId: input.providerMessageId ?? null,
    failureReason: input.failureReason ?? null,
    deliveryMode: input.deliveryMode,
  });
}

function logNotificationTestSend(input: {
  event: NotificationRequest["event"];
  recipients: string[];
  payload: Record<string, unknown>;
  dryRun: boolean;
  requestedByUserId?: string | null;
  deliveryMode: string;
}) {
  logger.info("notification_test_send", {
    event: input.event,
    recipients: input.recipients,
    payload: input.payload,
    dryRun: input.dryRun,
    requestedByUserId: input.requestedByUserId ?? null,
    deliveryMode: input.deliveryMode,
  });
}

export async function sendNotification<TEvent extends NotificationRequest["event"]>(
  db: Database,
  input: SendNotificationInput<TEvent>,
) {
  const entityId = getNotificationEntityId(input.event, input.payload);
  const notificationEnabled = await isNotificationEnabled(db, input.event);
  if (!notificationEnabled) {
    logger.info("notification_disabled", {
      event: input.event,
      entityId,
      recipientType: getNotificationRecipientType(input.event),
    });
    return { success: true, skipped: true };
  }

  const template = resolveNotificationTemplate(input.event, input.payload);
  const deliveryPolicy = getNotificationDeliveryPolicy();
  let recipients: NotificationRecipients;

  try {
    recipients = await resolveRecipients(db, input);
  } catch (error) {
    const recipientType = getNotificationRecipientType(input.event);
    const reserved = await reserveNotificationRow({
      db,
      event: input.event,
      entityId,
      userId: input.userId ?? null,
      recipientType,
      recipient: recipientType === "admin" ? "unresolved_admin_recipient" : "unresolved_user_recipient",
      provider: "resend",
      templateVersion: template.templateVersion,
      payload: input.payload as Record<string, unknown>,
    });

    if (reserved.kind === "reserved") {
      await markNotificationFailed(
        db,
        reserved.row.id,
        "resend",
        recipientType === "admin" ? "unresolved_admin_recipient" : "unresolved_user_recipient",
        error instanceof Error ? error.message : "Recipient resolution failed.",
      );
    }

    logNotificationDelivery({
      event: input.event,
      entityId,
      recipient: null,
      recipientType,
      status: "failed",
      failureReason: error instanceof Error ? error.message : "Recipient resolution failed.",
      deliveryMode: deliveryPolicy.mode,
    });
    return { success: false, skipped: false };
  }

  const appliedPolicy = applyNotificationDeliveryPolicy(recipients.recipients);
  const effectiveRecipients = appliedPolicy.suppressed
    ? recipients.recipients
    : appliedPolicy.resolvedRecipients;
  const recipientLabel = effectiveRecipients.join(", ");
  const providerName = appliedPolicy.suppressed ? "resend:suppressed" : "resend";

  if (input.testContext?.source === "admin") {
    logNotificationTestSend({
      event: input.event,
      recipients: effectiveRecipients,
      payload: input.payload as Record<string, unknown>,
      dryRun: Boolean(input.dryRun),
      requestedByUserId: input.testContext.requestedByUserId,
      deliveryMode: appliedPolicy.policy.mode,
    });
  }

  if (input.dryRun) {
    return {
      success: true,
      skipped: true,
      dryRun: true,
      recipients: effectiveRecipients,
      deliveryMode: appliedPolicy.policy.mode,
      preview: {
        subject: template.subject,
        html: template.html,
        templateVersion: template.templateVersion,
      },
    };
  }

  const reserved = await reserveNotificationRow({
    db,
    event: input.event,
    entityId,
    userId: input.userId ?? null,
    recipientType: recipients.recipientType,
    recipient: recipientLabel,
    provider: providerName,
    templateVersion: template.templateVersion,
    payload: input.payload as Record<string, unknown>,
  });

  if (reserved.kind === "duplicate") {
    logNotificationDelivery({
      event: input.event,
      entityId,
      recipient: recipientLabel,
      recipientType: recipients.recipientType,
      status: "skipped_duplicate",
      deliveryMode: appliedPolicy.policy.mode,
    });
    return { success: true, skipped: true };
  }

  if (appliedPolicy.suppressed) {
    await markNotificationSent(db, reserved.row.id, providerName, recipientLabel, null);
    logNotificationDelivery({
      event: input.event,
      entityId,
      recipient: recipientLabel,
      recipientType: recipients.recipientType,
      status: "sent",
      deliveryMode: appliedPolicy.policy.mode,
    });
    return { success: true, skipped: false };
  }

  const sendResult = await sendResendEmail({
    to: appliedPolicy.resolvedRecipients,
    subject: template.subject,
    html: template.html,
  });

  if (!sendResult.success) {
    await markNotificationFailed(
      db,
      reserved.row.id,
      providerName,
      recipientLabel,
      sendResult.error ?? "Notification delivery failed.",
    );
    logNotificationDelivery({
      event: input.event,
      entityId,
      recipient: recipientLabel,
      recipientType: recipients.recipientType,
      status: "failed",
      failureReason: sendResult.error ?? "Notification delivery failed.",
      deliveryMode: appliedPolicy.policy.mode,
    });
    return { success: false, skipped: false };
  }

  await markNotificationSent(
    db,
    reserved.row.id,
    providerName,
    recipientLabel,
    sendResult.messageId ?? null,
  );
  logNotificationDelivery({
    event: input.event,
    entityId,
    recipient: recipientLabel,
    recipientType: recipients.recipientType,
    status: "sent",
    providerMessageId: sendResult.messageId ?? null,
    deliveryMode: appliedPolicy.policy.mode,
  });
  return { success: true, skipped: false };
}
