/**
 * Direct database introspection script
 * Queries actual live schema to verify structure
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function introspectReportsTable() {
  console.log("=== INTROSPECTING ACTUAL DATABASE SCHEMA ===\n");

  // Get column information
  const columns = await sql`
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_name = 'reports'
    ORDER BY ordinal_position;
  `;

  console.log("REPORTS TABLE COLUMNS:");
  console.log(JSON.stringify(columns, null, 2));

  // Get constraints
  const constraints = await sql`
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
    WHERE tc.table_name = 'reports';
  `;

  console.log("\nREPORTS TABLE CONSTRAINTS:");
  console.log(JSON.stringify(constraints, null, 2));

  // Get indexes
  const indexes = await sql`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'reports';
  `;

  console.log("\nREPORTS TABLE INDEXES:");
  console.log(JSON.stringify(indexes, null, 2));

  // Check migration history
  const migrations = await sql`
    SELECT * FROM drizzle.__drizzle_migrations
    ORDER BY created_at;
  `;

  console.log("\nMIGRATION HISTORY:");
  console.log(JSON.stringify(migrations, null, 2));

  // Test a direct query to confirm client_id nullability
  try {
    const testInsert = await sql`
      INSERT INTO reports (client_id, status)
      VALUES (NULL, 'test')
      RETURNING *;
    `;
    console.log("\n✅ NULL client_id insert test: SUCCESS");
    console.log(testInsert);
    
    // Clean up test
    await sql`DELETE FROM reports WHERE status = 'test'`;
  } catch (err: any) {
    console.log("\n❌ NULL client_id insert test: FAILED");
    console.log(err.message);
  }
}

introspectReportsTable()
  .then(() => {
    console.log("\n=== INTROSPECTION COMPLETE ===");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Introspection failed:", err);
    process.exit(1);
  });
