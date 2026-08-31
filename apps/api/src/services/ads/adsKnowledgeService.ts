import { adsDivin8KnowledgeEntries } from "@wisdom/db";
import type { Database } from "@wisdom/db";
import { desc } from "drizzle-orm";
import { getDivin8AdvertisingCatalog } from "./divin8AdsCatalog.js";

export async function getDivin8AdvertisingKnowledge(db: Database | null) {
  const catalog = getDivin8AdvertisingCatalog();
  if (!db) {
    return { catalog, customEntries: [] as Array<{
      id: string;
      title: string;
      body: string;
      category: string;
      updatedAt: string;
    }> };
  }
  const rows = await db
    .select()
    .from(adsDivin8KnowledgeEntries)
    .orderBy(desc(adsDivin8KnowledgeEntries.updated_at))
    .limit(50);
  return {
    catalog,
    customEntries: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      category: row.category,
      updatedAt: row.updated_at?.toISOString() ?? row.created_at.toISOString(),
    })),
  };
}
