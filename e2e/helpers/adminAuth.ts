import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";
import { createDb, users } from "../../packages/db/src/index.ts";

const repoRoot = process.cwd();
loadEnv({ path: path.join(repoRoot, "apps/api/.env") });

export const ADMIN_STORAGE_STATE = "e2e/.auth/admin.json";
export const ADMIN_SKIP_REASON_PATH = "e2e/.auth/ADMIN_SKIP_REASON.txt";
export const DEFAULT_ADMIN_BASE = "http://127.0.0.1:5174";

function assertLocalhostDatabase(databaseUrl: string) {
  const host = new URL(databaseUrl.replace(/^postgresql:/, "http:")).host;
  if (host.includes("ep-weathered-forest-ak5x524w")) {
    throw new Error("Refusing Admin e2e auth against the production Neon branch.");
  }
}

export function adminBaseUrl() {
  return process.env.PLAYWRIGHT_ADMIN_BASE_URL?.trim() || DEFAULT_ADMIN_BASE;
}

export function adminAuthSkipReason() {
  if (process.env.CLERK_TEST_SESSION_TOKEN?.trim() || process.env.PLAYWRIGHT_CLERK_SESSION?.trim()) {
    return "";
  }
  if (existsSync(ADMIN_SKIP_REASON_PATH)) {
    const reason = readFileSync(ADMIN_SKIP_REASON_PATH, "utf8").trim();
    if (reason) return reason;
  }
  if (!existsSync(ADMIN_STORAGE_STATE)) {
    return "Admin Clerk storage state is required";
  }
  return "";
}

export async function findAdminE2EUser() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to locate an admin e2e user.");
  }
  assertLocalhostDatabase(databaseUrl);
  const db = createDb(databaseUrl);
  const requestedEmail = process.env.E2E_ADMIN_EMAIL?.trim();
  if (requestedEmail) {
    const [user] = await db.select().from(users).where(eq(users.email, requestedEmail)).limit(1);
    if (!user) {
      throw new Error("E2E_ADMIN_EMAIL is not present in the local users table.");
    }
    if (user.role !== "admin") {
      throw new Error("E2E_ADMIN_EMAIL is not an admin user.");
    }
    if (!user.clerk_id) {
      throw new Error("E2E_ADMIN_EMAIL is missing a Clerk id.");
    }
    return user;
  }
  const [user] = await db.select().from(users).where(eq(users.role, "admin")).limit(2);
  if (!user?.clerk_id) {
    throw new Error("No local admin user with a Clerk id was found.");
  }
  return user;
}
