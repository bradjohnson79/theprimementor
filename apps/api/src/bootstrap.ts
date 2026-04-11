import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bootstrapDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(bootstrapDir, "../.env"), override: true });

const { main } = await import("./server.js");

void main();
