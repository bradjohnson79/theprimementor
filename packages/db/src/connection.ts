import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema.js";
import * as relations from "./relations.js";

neonConfig.webSocketConstructor = ws;

export function createDb(databaseUrl: string) {
  const client = new Pool({ connectionString: databaseUrl });
  return drizzle({ client, schema: { ...schema, ...relations } });
}

export type Database = ReturnType<typeof createDb>;
