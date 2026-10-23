import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bootstrapDir = dirname(fileURLToPath(import.meta.url));

// Guest-checkout local testing (opt-in only): if API_ENV_FILE is set, load ONLY that file
// (e.g. an env file outside the repo pointing at a local Postgres DB + stripe-mock) instead of
// the real apps/api/.env, which holds live Stripe keys, a real Resend key, and the production
// Neon DATABASE_URL. Default behavior (no API_ENV_FILE set) is unchanged.
const explicitEnvFile = process.env.API_ENV_FILE?.trim();
if (explicitEnvFile) {
  loadEnv({ path: resolve(explicitEnvFile), override: true });
} else {
  loadEnv({ path: resolve(bootstrapDir, "../.env"), override: true });
}

const { main } = await import("./server.js");

void main().catch((err) => {
  console.error("SERVER FAILED TO START:", err);
  process.exit(1);
});
