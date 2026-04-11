import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const entryDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(entryDir, "../.env"), override: true });

const { main } = await import("./server.js");

void main();
