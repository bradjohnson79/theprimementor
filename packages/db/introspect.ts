/**
 * Direct database introspection script
 * Queries actual live schema to verify structure
 */
import "dotenv/config";
import { createDb } from "./src/index.js";
import { sql as rawSql } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const db = createDb(process.env.DATABASE_URL);

async function introspectSchema() {
  console.log("=== INTROSPECTING ACTUAL DATABASE SCHEMA ===\n");

  // Get column information
  const columns = await db.execute(rawSql`
    SELECT 
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('booking_types', 'bookings', 'payments', 'reports', 'report_tier_outputs')
    ORDER BY table_name, ordinal_position;
  `);

  console.log("SCHEMA COLUMNS:");
  console.log(JSON.stringify(columns.rows, null, 2));

  // Get constraints
  const constraints = await db.execute(rawSql`
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name IN ('booking_types', 'bookings', 'payments', 'reports', 'report_tier_outputs');
  `);

  console.log("\nSCHEMA CONSTRAINTS:");
  console.log(JSON.stringify(constraints.rows, null, 2));

  // Get indexes
  const indexes = await db.execute(rawSql`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('booking_types', 'bookings', 'payments', 'reports', 'report_tier_outputs');
  `);

  console.log("\nSCHEMA INDEXES:");
  console.log(JSON.stringify(indexes.rows, null, 2));

  // Check migration history
  const migrations = await db.execute(rawSql`
    SELECT * FROM drizzle.__drizzle_migrations
    ORDER BY created_at;
  `);

  console.log("\nMIGRATION HISTORY:");
  console.log(JSON.stringify(migrations.rows, null, 2));

  console.log("\n=== INTROSPECTION COMPLETE ===");
}

introspectSchema()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Introspection failed:", err);
    process.exit(1);
  });
