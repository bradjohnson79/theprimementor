import "./types.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import rawBody from "fastify-raw-body";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { healthRoutes } from "./routes/health.js";
import { stripeRoutes } from "./routes/stripe.js";
import { clerkWebhookRoutes } from "./routes/clerk-webhook.js";
import { syncUserRoutes } from "./routes/sync-user.js";
import { meRoutes } from "./routes/me.js";
import { mentoringCircleRoutes } from "./routes/mentoring-circle.js";
import { membershipsRoutes } from "./routes/memberships.js";
import { reportsRoutes } from "./routes/reports.js";
import { clientRoutes } from "./routes/clients.js";
import { blueprintRoutes } from "./routes/blueprints.js";
import { bookingsRoutes } from "./routes/bookings.js";
import { paymentsRoutes } from "./routes/payments.js";
import { imageRoutes } from "./routes/images.js";
import { divin8Routes } from "./routes/divin8.js";
import { placesRoutes } from "./routes/places.js";
import { contactRoutes } from "./routes/contact.js";
import { zoomRoutes } from "./routes/zoom.js";
import { socialRoutes } from "./routes/social.js";
import { ordersRoutes } from "./routes/orders.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { mentorTrainingRoutes } from "./routes/mentor-training.js";
import { adminNotificationRoutes } from "./routes/admin-notifications.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { seoRoutes } from "./routes/seo.js";
import { promoCodesRoutes } from "./routes/promoCodes.js";
import { deleteStalePhysiognomyUploads } from "./services/physiognomyImageStorage.js";
import { initSwissEphemeris } from "./services/blueprint/swissEphemerisService.js";
import { assertMembershipStripeConfig } from "./config/membershipBilling.js";
import { assertMentorTrainingStripeConfig } from "./config/mentorTrainingPackages.js";
import { assertInternalApiEnvelope, fail, isApiResult, shouldBypassApiEnvelope, toLegacyPayload } from "./apiContract.js";
import {
  canRepairKnownSchemaGaps,
  ensureKnownDataRows,
  repairKnownSchemaGaps,
} from "./services/schemaRepairService.js";

logger.info("zoom_env_loaded", {
  hasAccountId: Boolean(process.env.ZOOM_ACCOUNT_ID?.trim()),
  hasClientId: Boolean(process.env.ZOOM_CLIENT_ID?.trim()),
  hasClientSecret: Boolean(process.env.ZOOM_CLIENT_SECRET?.trim()),
});

const PHYSIOGNOMY_UPLOAD_MAX_AGE_MS =
  Number(process.env.PHYSIOGNOMY_UPLOAD_MAX_AGE_MS) || 48 * 60 * 60 * 1000;
const PHYSIOGNOMY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const REQUIRED_SCHEMA: Record<string, readonly string[]> = {
  users: [
    "id",
    "clerk_id",
    "email",
    "role",
    "created_at",
    "updated_at",
  ],
  booking_types: [
    "id",
    "name",
    "session_type",
    "duration_minutes",
    "price_cents",
    "currency",
    "buffer_before_minutes",
    "buffer_after_minutes",
    "is_active",
    "created_at",
    "updated_at",
  ],
  bookings: [
    "id",
    "user_id",
    "booking_type_id",
    "session_type",
    "event_key",
    "start_time_utc",
    "end_time_utc",
    "timezone",
    "status",
    "full_name",
    "email",
    "phone",
    "birth_date",
    "birth_time",
    "birth_place",
    "birth_place_name",
    "birth_lat",
    "birth_lng",
    "birth_timezone",
    "consent_given",
    "intake",
    "join_url",
    "start_url",
    "notes",
    "created_at",
    "updated_at",
  ],
  payments: [
    "id",
    "user_id",
    "booking_id",
    "entity_type",
    "entity_id",
    "amount_cents",
    "currency",
    "status",
    "provider",
    "provider_payment_intent_id",
    "provider_customer_id",
    "metadata",
    "created_at",
    "updated_at",
  ],
  stripe_customers: [
    "id",
    "user_id",
    "stripe_customer_id",
    "created_at",
  ],
  subscriptions: [
    "id",
    "user_id",
    "stripe_subscription_id",
    "stripe_customer_id",
    "tier",
    "status",
    "cancel_at_period_end",
    "current_period_end",
    "metadata",
    "created_at",
    "updated_at",
  ],
  webhook_events: [
    "id",
    "provider",
    "stripe_event_id",
    "stripe_event_type",
    "payload",
    "processed_at",
    "created_at",
    "updated_at",
  ],
  notification_events: [
    "id",
    "event_type",
    "entity_id",
    "user_id",
    "recipient_type",
    "recipient",
    "provider",
    "provider_message_id",
    "template_version",
    "status",
    "payload",
    "failure_reason",
    "sent_at",
    "last_attempted_at",
    "created_at",
    "updated_at",
  ],
  notification_settings: [
    "id",
    "enabled_events",
    "admin_recipients",
    "created_at",
    "updated_at",
  ],
  invoices: [
    "id",
    "user_id",
    "client_id",
    "stripe_payment_link",
    "stripe_payment_link_id",
    "stripe_product_id",
    "stripe_price_id",
    "stripe_checkout_session_id",
    "stripe_payment_intent_id",
    "stripe_subscription_id",
    "product_type",
    "label",
    "amount",
    "currency",
    "billing_mode",
    "status",
    "consumed_at",
    "expires_at",
    "failure_code",
    "failure_message",
    "failure_message_normalized",
    "last_payment_attempt_at",
    "paid_at",
    "metadata",
    "created_at",
    "updated_at",
  ],
  orders: [
    "id",
    "user_id",
    "client_id",
    "invoice_id",
    "subscription_id",
    "type",
    "label",
    "amount",
    "currency",
    "status",
    "payment_reference",
    "stripe_payment_intent_id",
    "stripe_subscription_id",
    "refunded_at",
    "refund_reason",
    "refund_note",
    "failure_code",
    "failure_message",
    "failure_message_normalized",
    "recording_link",
    "recording_added_at",
    "metadata",
    "archived",
    "archived_at",
    "created_at",
    "updated_at",
  ],
  member_entitlements: [
    "id",
    "user_id",
    "stripe_subscription_id",
    "tier",
    "billing_interval",
    "current_period_start",
    "current_period_end",
    "last_synced_at",
    "created_at",
    "updated_at",
  ],
  member_usage: [
    "id",
    "user_id",
    "period_start",
    "period_end",
    "prompts_used",
    "created_at",
    "updated_at",
  ],
  member_usage_events: [
    "id",
    "user_id",
    "request_id",
    "thread_id",
    "message_id",
    "period_start",
    "period_end",
    "counted_at",
  ],
  reports: [
    "id",
    "status",
    "user_id",
    "member_status",
    "purchase_intake",
    "birth_place_name",
    "birth_lat",
    "birth_lng",
    "birth_timezone",
    "blueprint_data",
    "generated_report",
    "full_markdown",
    "interpretation_tier",
    "display_title",
    "systems_used",
    "meta",
    "created_at",
    "updated_at",
  ],
  mentor_training_orders: [
    "id",
    "user_id",
    "package_type",
    "status",
    "timezone",
    "location_input",
    "lat",
    "lng",
    "eligibility_verified_at",
    "archived",
    "archived_at",
    "created_at",
    "updated_at",
  ],
  report_tier_outputs: [
    "report_id",
    "tier",
    "status",
    "systems_config",
    "model_name",
    "reasoning_effort",
    "generated_report",
    "full_markdown",
    "display_title",
  ],
  mentoring_circle_registrations: [
    "id",
    "user_id",
    "event_key",
    "event_title",
    "event_start_at",
    "timezone",
    "status",
    "join_url",
    "created_at",
    "updated_at",
  ],
  conversation_threads: [
    "id",
    "user_id",
    "title",
    "is_archived",
    "summary",
    "search_text",
    "meta",
    "created_at",
    "updated_at",
  ],
  conversation_messages: [
    "id",
    "thread_id",
    "role",
    "content",
    "meta",
    "created_at",
  ],
  profiles: [
    "id",
    "user_id",
    "full_name",
    "tag",
    "birth_date",
    "birth_time",
    "birth_place",
    "lat",
    "lng",
    "timezone",
    "created_at",
  ],
  insights: [
    "id",
    "thread_id",
    "user_id",
    "content",
    "category",
    "confidence",
    "created_at",
  ],
  conversation_timeline_events: [
    "id",
    "thread_id",
    "user_id",
    "summary",
    "systems_used",
    "tags",
    "type",
    "created_at",
  ],
  conversation_memories: [
    "id",
    "conversation_id",
    "user_id",
    "type",
    "content",
    "relevance_score",
    "created_at",
    "updated_at",
  ],
  seo_settings: [
    "id",
    "page_key",
    "title",
    "meta_description",
    "keywords",
    "og_image",
    "robots_index",
    "created_at",
    "updated_at",
  ],
  seo_audits: [
    "id",
    "initiated_by",
    "scope",
    "mode",
    "status",
    "summary_json",
    "completed_at",
    "failure_reason",
    "created_at",
    "updated_at",
  ],
  seo_audit_items: [
    "id",
    "audit_id",
    "page_key",
    "issue_type",
    "severity",
    "description",
    "detected_value",
    "recommended_value",
    "created_at",
    "updated_at",
  ],
  seo_recommendations: [
    "audit_id",
    "id",
    "page_key",
    "type",
    "reason",
    "expected_outcome",
    "current_snapshot",
    "suggested_snapshot",
    "field",
    "current_value",
    "suggested_value",
    "edited_value",
    "reasoning",
    "expected_impact",
    "action",
    "impact",
    "admin_impact_override",
    "intent",
    "confidence",
    "confidence_score",
    "source",
    "status",
    "dedupe_hash",
    "model_name",
    "version",
    "reviewed_at",
    "reviewed_by",
    "resolved_at",
    "last_recommendation_at",
    "created_at",
    "updated_at",
  ],
  seo_recommendation_apply_history: [
    "id",
    "recommendation_id",
    "page_key",
    "previous_value",
    "new_value",
    "applied_at",
    "applied_by",
  ],
  seo_changes_log: [
    "id",
    "recommendation_id",
    "page_key",
    "field",
    "old_value",
    "new_value",
    "source",
    "applied_by",
    "applied_at",
  ],
  seo_reports: [
    "id",
    "audit_id",
    "report_json",
    "pdf_url",
    "created_at",
    "updated_at",
  ],
  promo_codes: [
    "id",
    "code",
    "discount_type",
    "discount_value",
    "active",
    "expires_at",
    "usage_limit",
    "times_used",
    "applies_to",
    "applies_to_billing",
    "min_amount_cents",
    "first_time_only",
    "campaign",
    "stripe_coupon_id",
    "stripe_promotion_code_id",
    "sync_status",
    "last_validated_at",
    "last_validation_ok",
    "last_validation_snapshot",
    "validation_failure_code",
    "validation_failure_message",
    "metadata",
    "archived_at",
    "created_at",
    "updated_at",
  ],
  promo_code_usages: [
    "id",
    "promo_code_id",
    "payment_id",
    "created_at",
  ],
  promo_code_changes_log: [
    "id",
    "promo_code_id",
    "field_changed",
    "old_value",
    "new_value",
    "changed_by",
    "changed_at",
  ],
};

async function getMissingSchemaEntries(db: Database) {
  const result = await db.execute(sql<{ table_name: string; column_name: string }>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'users',
        'booking_types',
        'bookings',
        'payments',
        'stripe_customers',
        'subscriptions',
        'webhook_events',
        'notification_events',
        'notification_settings',
        'invoices',
        'orders',
        'member_entitlements',
        'member_usage',
        'member_usage_events',
        'reports',
        'mentor_training_orders',
        'report_tier_outputs',
        'mentoring_circle_registrations',
        'conversation_threads',
        'conversation_messages',
        'profiles',
        'insights',
        'conversation_timeline_events',
        'conversation_memories',
        'seo_settings',
        'seo_audits',
        'seo_audit_items',
        'seo_recommendations',
        'seo_recommendation_apply_history',
        'seo_changes_log',
        'seo_reports',
        'promo_codes',
        'promo_code_usages',
        'promo_code_changes_log'
      )
  `);

  const columnsByTable = new Map<string, Set<string>>();
  for (const row of result.rows as Array<{ table_name: string; column_name: string }>) {
    const set = columnsByTable.get(row.table_name) ?? new Set<string>();
    set.add(row.column_name);
    columnsByTable.set(row.table_name, set);
  }

  const missingEntries = Object.entries(REQUIRED_SCHEMA).flatMap(([tableName, requiredColumns]) => {
    const existing = columnsByTable.get(tableName) ?? new Set<string>();
    const missingColumns = requiredColumns.filter((column) => !existing.has(column));
    return missingColumns.map((column) => `${tableName}.${column}`);
  });

  return missingEntries;
}

async function verifySchema(db: Database) {
  const missingEntries = await getMissingSchemaEntries(db);

  if (missingEntries.length > 0) {
    logger.error("database_schema_out_of_sync", {
      missingColumns: missingEntries,
    });
    throw new Error(`Database schema is out of sync. Missing columns: ${missingEntries.join(", ")}`);
  }
}

function buildAllowedOrigins() {
  return new Set(
    [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "http://127.0.0.1:5175",
      "https://theprimementor.com",
      "https://www.theprimementor.com",
      "https://admin.theprimementor.com",
      process.env.FRONTEND_URL?.trim(),
      process.env.APP_URL?.trim(),
      process.env.ADMIN_URL?.trim(),
      process.env.VITE_APP_URL?.trim(),
    ].filter((origin): origin is string => Boolean(origin)),
  );
}

function startPhysiognomyCleanupLoop() {
  deleteStalePhysiognomyUploads(PHYSIOGNOMY_UPLOAD_MAX_AGE_MS)
    .then((n) => {
      if (n > 0) logger.info("physiognomy_upload_cleanup_startup", { removed: n });
    })
    .catch((e) => logger.warn("physiognomy_upload_cleanup_failed", e));

  return setInterval(() => {
    deleteStalePhysiognomyUploads(PHYSIOGNOMY_UPLOAD_MAX_AGE_MS)
      .then((n) => {
        if (n > 0) logger.info("physiognomy_upload_cleanup", { removed: n });
      })
      .catch((e) => logger.warn("physiognomy_upload_cleanup_failed", e));
  }, PHYSIOGNOMY_CLEANUP_INTERVAL_MS);
}

export async function buildApp() {
  assertMembershipStripeConfig();
  assertMentorTrainingStripeConfig();
  await initSwissEphemeris();

  const app = Fastify({
    logger: true,
    // Enforce 2MB JSON body limit — images must use /api/images/upload (multipart)
    bodyLimit: 2 * 1024 * 1024,
  });

  const allowedOrigins = buildAllowedOrigins();

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Frame-Options", "SAMEORIGIN");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    return payload;
  });
  app.addHook("preSerialization", async (_request, reply, payload) => {
    const contentType = String(reply.getHeader("content-type") || "");
    if (shouldBypassApiEnvelope(payload, contentType)) {
      return payload;
    }

    assertInternalApiEnvelope(payload);

    if (!isApiResult(payload)) {
      return payload;
    }

    return toLegacyPayload(payload);
  });
  await app.register(rawBody, { global: false });
  // Multipart support for image uploads only — NOT registered globally
  await app.register(multipart, { attachFieldsToBody: false });
  await app.register(rateLimit, {
    max: process.env.NODE_ENV === "production" ? 100 : 1000,
    timeWindow: "1 minute",
    errorResponseBuilder: () => fail("Too many requests, please try again later"),
  });

  if (!process.env.DATABASE_URL) {
    logger.warn("DATABASE_URL not set -- DB features will be unavailable");
  }

  const db = process.env.DATABASE_URL
    ? createDb(process.env.DATABASE_URL)
    : (null as unknown as ReturnType<typeof createDb>);

  const skipSchemaVerify = process.env.SKIP_SCHEMA_VERIFY === "true";
  if (process.env.DATABASE_URL && !skipSchemaVerify) {
    const missingEntries = await getMissingSchemaEntries(db);
    if (missingEntries.length > 0 && canRepairKnownSchemaGaps(missingEntries)) {
      logger.warn("database_schema_repair_attempting", {
        missingColumns: missingEntries,
      });
      await repairKnownSchemaGaps(db);
    }
    await verifySchema(db);
    await ensureKnownDataRows(db);
  }

  app.decorate("db", db);
  app.decorate("routeInventory", []);
  app.addHook("onRoute", (routeOptions) => {
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method];
    for (const method of methods) {
      app.routeInventory.push({
        method: String(method).toUpperCase(),
        url: routeOptions.url,
      });
    }
  });

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode ?? 500;
    if (error.code && error.code.startsWith("DIVIN8_")) {
      reply.status(statusCode).send(fail(error.code, {
        message: error.message || "Divin8 is temporarily unavailable. Please try again.",
      }));
      return;
    }
    if (error.code === "LIMIT_REACHED" || error.code === "AUTH_EXPIRED") {
      reply.status(statusCode).send(fail(error.message || "Request could not be completed.", {
        code: error.code,
      }));
      return;
    }
    const message =
      statusCode === 429
        ? "Too many requests, please try again later"
        : error.message || "Internal Server Error";

    reply.status(statusCode).send(fail(message));
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send(fail("Route not found"));
  });

  await app.register(healthRoutes);
  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(syncUserRoutes, { prefix: "/api" });
  await app.register(meRoutes, { prefix: "/api" });
  await app.register(mentoringCircleRoutes, { prefix: "/api" });
  await app.register(membershipsRoutes, { prefix: "/api" });
  await app.register(reportsRoutes, { prefix: "/api" });
  await app.register(clientRoutes, { prefix: "/api" });
  await app.register(blueprintRoutes, { prefix: "/api" });
  await app.register(bookingsRoutes, { prefix: "/api" });
  await app.register(paymentsRoutes, { prefix: "/api" });
  await app.register(imageRoutes, { prefix: "/api" });
  await app.register(divin8Routes, { prefix: "/api" });
  await app.register(placesRoutes, { prefix: "/api" });
  await app.register(contactRoutes, { prefix: "/api" });
  await app.register(zoomRoutes, { prefix: "/api" });
  await app.register(socialRoutes, { prefix: "/api" });
  await app.register(dashboardRoutes, { prefix: "/api" });
  await app.register(mentorTrainingRoutes, { prefix: "/api" });
  await app.register(ordersRoutes, { prefix: "/api" });
  await app.register(adminNotificationRoutes, { prefix: "/api" });
  await app.register(analyticsRoutes, { prefix: "/api" });
  await app.register(seoRoutes, { prefix: "/api" });
  await app.register(promoCodesRoutes, { prefix: "/api" });
  await app.register(stripeRoutes, { prefix: "/api" });
  await app.register(clerkWebhookRoutes, { prefix: "/api" });

  return app;
}

export async function main() {
  try {
    console.log("PORT ENV:", process.env.PORT);
    const port = Number(process.env.PORT) || 3000;
    console.log("Starting server...");
    const app = await buildApp();
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Server running on port ${port}`);
    logger.info(`Server running on http://localhost:${port}`);
    startPhysiognomyCleanupLoop();
  } catch (err) {
    console.error("SERVER FAILED TO START:", err);
    process.exit(1);
  }
}
