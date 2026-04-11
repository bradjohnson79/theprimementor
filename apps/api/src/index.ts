import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const entryDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(entryDir, "../.env"), override: true });

console.log("ENTRY FILE EXECUTED");

const { main } = await import("./server.js");

void main().catch((err) => {
  console.error("SERVER FAILED TO START:", err);
  process.exit(1);
});
