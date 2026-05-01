#!/usr/bin/env node
/**
 * Schema Drift Detection
 * Compares Drizzle source schema with actual database schema
 * Run this before deployment or when debugging schema issues
 */

import "dotenv/config";
import { createDb } from "./src/index.js";
import { sql as rawSql } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const db = createDb(process.env.DATABASE_URL);

const REQUIRED_COLUMNS: Record<string, string[]> = {
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
    "stripe_invoice_id",
    "stripe_invoice_url",
    "stripe_invoice_status",
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
  reports: [
    "user_id",
    "member_status",
    "purchase_intake",
    "birth_place_name",
    "birth_lat",
    "birth_lng",
    "birth_timezone",
    "client_id",
    "blueprint_data",
    "generated_report",
    "full_markdown",
    "interpretation_tier",
    "display_title",
    "systems_used",
    "meta",
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

async function checkSchemaDrift() {
  console.log("=== SCHEMA DRIFT DETECTION ===\n");

  try {
    const columnsResult = await db.execute(rawSql`
      SELECT 
        table_name,
        column_name,
        is_nullable,
        data_type,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('booking_types', 'bookings', 'payments', 'invoices', 'orders', 'reports', 'report_tier_outputs', 'mentoring_circle_registrations', 'promo_codes', 'promo_code_usages', 'promo_code_changes_log');
    `);

    if (!columnsResult.rows || columnsResult.rows.length === 0) {
      console.error("❌ CRITICAL: required tables not found in database");
      process.exit(1);
    }

    const byTable = new Map<string, Array<{ column_name: string; is_nullable: string; data_type: string; column_default: string | null }>>();
    for (const row of columnsResult.rows as Array<any>) {
      const prev = byTable.get(row.table_name) ?? [];
      prev.push(row);
      byTable.set(row.table_name, prev);
    }

    console.log("📋 Database Schema:");
    for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
      const rows = byTable.get(tableName) ?? [];
      const existing = new Set(rows.map((row) => row.column_name));
      const missing = requiredColumns.filter((column) => !existing.has(column));
      console.log(`   ${tableName}: ${rows.length} columns found`);
      if (missing.length > 0) {
        console.error(`❌ DRIFT DETECTED: missing ${tableName} columns -> ${missing.join(", ")}`);
        process.exit(1);
      }
    }
    console.log();

    console.log("✅ ALL DRIFT CHECKS PASSED");
    console.log("   No schema mismatches detected");
    process.exit(0);
  } catch (error) {
    console.error("❌ Drift check failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

checkSchemaDrift();
