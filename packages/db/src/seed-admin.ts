import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { users } from "./schema.js";

const email = process.argv[2] || process.env.ADMIN_EMAIL;

if (!email) {
  console.error("Usage: pnpm db:seed-admin <email>");
  console.error("  or set ADMIN_EMAIL environment variable");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(databaseUrl);
const db = drizzle(sql);

const [user] = await db
  .select()
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

if (!user) {
  console.error(`No user found with email: ${email}`);
  console.error("Make sure you've signed in via the web app first.");
  process.exit(1);
}

if (user.role === "admin") {
  console.log(`User ${email} is already an admin.`);
  process.exit(0);
}

await db
  .update(users)
  .set({ role: "admin" })
  .where(eq(users.email, email));

console.log(`Successfully set ${email} as admin.`);
