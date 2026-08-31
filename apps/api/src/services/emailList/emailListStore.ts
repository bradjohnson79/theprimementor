import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  emailContactGmailEvidence,
  emailContacts,
  emailCsvImportSessions,
  emailExclusionRules,
  gmailConnections,
  gmailOauthStates,
  gmailSearchProfiles,
  gmailSearchSessions,
  type Database,
} from "@wisdom/db";
import type { CsvColumnMap, CsvPreviewRow } from "./csv.js";
import { normalizeEmail } from "./emailNormalize.js";
import type { ExclusionKind } from "./exclusionRules.js";
import type { StoredGmailCandidate } from "./types.js";

export type ContactSource = "gmail" | "csv" | "manual";

export interface ContactRow {
  id: string;
  first_name: string | null;
  email: string;
  email_normalized: string;
  source: ContactSource;
  source_reference: string | null;
  imported_by_user_id: string | null;
  created_at: Date;
  updated_at: Date | null;
}

export interface ConnectionRow {
  id: string;
  user_id: string;
  gmail_address: string;
  encrypted_tokens: string;
  token_expires_at: Date | null;
  granted_scope: string;
  status: "connected" | "expired" | "error";
  connected_at: Date;
}

export interface OauthStateRow {
  state: string;
  user_id: string;
  code_verifier: string;
  expires_at: Date;
}

export interface SearchProfileRow {
  id: string;
  user_id: string;
  name: string;
  query: string;
  created_at: Date;
  updated_at: Date | null;
}

export interface SearchSessionRow {
  id: string;
  user_id: string;
  query: string;
  profile_id: string | null;
  gmail_page_token: string | null;
  candidates: StoredGmailCandidate[];
  expires_at: Date;
}

export interface ExclusionRow {
  id: string;
  kind: ExclusionKind;
  value: string;
  pattern: string;
  created_by_user_id: string | null;
  created_at: Date;
}

export interface CsvSessionRow {
  id: string;
  user_id: string;
  column_map: CsvColumnMap;
  rows: CsvPreviewRow[];
  expires_at: Date;
}

export interface EvidenceInsert {
  contact_id: string;
  search_profile_id: string | null;
  query: string;
  thread_ids: string[];
  message_ids: string[];
  first_matched_at: Date | null;
  last_matched_at: Date | null;
  match_count: number;
  two_way: boolean;
  imported_by_user_id: string;
}

export interface ListContactsQuery {
  search?: string;
  source?: ContactSource | "";
  sort?: "newest" | "oldest" | "email" | "name";
  page?: number;
  pageSize?: number;
}

export interface EmailListStore {
  getConnection(userId: string): Promise<ConnectionRow | null>;
  upsertConnection(row: Omit<ConnectionRow, "id" | "connected_at"> & { connected_at?: Date }): Promise<ConnectionRow>;
  deleteConnection(userId: string): Promise<void>;
  insertOauthState(row: OauthStateRow): Promise<void>;
  consumeOauthState(state: string): Promise<OauthStateRow | null>;
  listProfiles(userId: string): Promise<SearchProfileRow[]>;
  getProfile(userId: string, id: string): Promise<SearchProfileRow | null>;
  createProfile(userId: string, name: string, query: string): Promise<SearchProfileRow>;
  updateProfile(userId: string, id: string, patch: { name?: string; query?: string }): Promise<SearchProfileRow | null>;
  deleteProfile(userId: string, id: string): Promise<boolean>;
  insertSearchSession(row: Omit<SearchSessionRow, "id">): Promise<SearchSessionRow>;
  getSearchSession(userId: string, id: string, options?: { allowExpired?: boolean }): Promise<SearchSessionRow | null>;
  findSearchSessionByPageToken(userId: string, pageToken: string): Promise<SearchSessionRow | null>;
  updateSearchSession(userId: string, id: string, patch: Partial<Pick<SearchSessionRow, "candidates" | "gmail_page_token" | "query" | "profile_id" | "expires_at">>): Promise<SearchSessionRow | null>;
  listContacts(query: ListContactsQuery): Promise<{ rows: ContactRow[]; total: number }>;
  listAllContacts(): Promise<ContactRow[]>;
  getContactById(id: string): Promise<ContactRow | null>;
  getContactByNormalized(emailNormalized: string): Promise<ContactRow | null>;
  existingNormalizedEmails(): Promise<Set<string>>;
  insertContact(row: Omit<ContactRow, "id" | "created_at" | "updated_at">): Promise<ContactRow>;
  updateContact(id: string, patch: { first_name?: string | null; email?: string; email_normalized?: string }): Promise<ContactRow | null>;
  deleteContact(id: string): Promise<boolean>;
  deleteContacts(ids: string[]): Promise<number>;
  insertEvidence(row: EvidenceInsert): Promise<void>;
  insertCsvSession(row: Omit<CsvSessionRow, "id">): Promise<CsvSessionRow>;
  getCsvSession(userId: string, id: string): Promise<CsvSessionRow | null>;
  listExclusions(): Promise<ExclusionRow[]>;
  insertExclusion(row: { kind: ExclusionKind; value: string; pattern: string; created_by_user_id: string }): Promise<ExclusionRow>;
  deleteExclusion(id: string): Promise<boolean>;
}

function asSource(value: string): ContactSource {
  if (value === "gmail" || value === "csv" || value === "manual") return value;
  return "manual";
}

function asStatus(value: string): ConnectionRow["status"] {
  if (value === "expired" || value === "error") return value;
  return "connected";
}

function sessionFromRow(row: typeof gmailSearchSessions.$inferSelect): SearchSessionRow {
  return {
    id: row.id,
    user_id: row.user_id,
    query: row.query,
    profile_id: row.profile_id,
    gmail_page_token: row.gmail_page_token,
    candidates: ((row.candidates ?? []) as unknown as StoredGmailCandidate[]),
    expires_at: row.expires_at,
  };
}

function contactFromRow(row: typeof emailContacts.$inferSelect): ContactRow {
  return {
    id: row.id,
    first_name: row.first_name,
    email: row.email,
    email_normalized: row.email_normalized,
    source: asSource(row.source),
    source_reference: row.source_reference,
    imported_by_user_id: row.imported_by_user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createDrizzleEmailListStore(db: Database): EmailListStore {
  return {
    async getConnection(userId) {
      const [row] = await db.select().from(gmailConnections).where(eq(gmailConnections.user_id, userId)).limit(1);
      if (!row) return null;
      return {
        id: row.id,
        user_id: row.user_id,
        gmail_address: row.gmail_address,
        encrypted_tokens: row.encrypted_tokens,
        token_expires_at: row.token_expires_at,
        granted_scope: row.granted_scope,
        status: asStatus(row.status),
        connected_at: row.connected_at,
      };
    },

    async upsertConnection(row) {
      const existing = await this.getConnection(row.user_id);
      if (existing) {
        const [updated] = await db
          .update(gmailConnections)
          .set({
            gmail_address: row.gmail_address,
            encrypted_tokens: row.encrypted_tokens,
            token_expires_at: row.token_expires_at,
            granted_scope: row.granted_scope,
            status: row.status,
            updated_at: new Date(),
          })
          .where(eq(gmailConnections.user_id, row.user_id))
          .returning();
        return {
          ...existing,
          ...row,
          id: updated?.id ?? existing.id,
          connected_at: existing.connected_at,
        };
      }
      const [created] = await db
        .insert(gmailConnections)
        .values({
          user_id: row.user_id,
          gmail_address: row.gmail_address,
          encrypted_tokens: row.encrypted_tokens,
          token_expires_at: row.token_expires_at,
          granted_scope: row.granted_scope,
          status: row.status,
        })
        .returning();
      return {
        id: created.id,
        user_id: created.user_id,
        gmail_address: created.gmail_address,
        encrypted_tokens: created.encrypted_tokens,
        token_expires_at: created.token_expires_at,
        granted_scope: created.granted_scope,
        status: asStatus(created.status),
        connected_at: created.connected_at,
      };
    },

    async deleteConnection(userId) {
      await db.delete(gmailConnections).where(eq(gmailConnections.user_id, userId));
    },

    async insertOauthState(row) {
      await db.insert(gmailOauthStates).values(row);
    },

    async consumeOauthState(state) {
      const [row] = await db.select().from(gmailOauthStates).where(eq(gmailOauthStates.state, state)).limit(1);
      if (!row) return null;
      await db.delete(gmailOauthStates).where(eq(gmailOauthStates.state, state));
      return {
        state: row.state,
        user_id: row.user_id,
        code_verifier: row.code_verifier,
        expires_at: row.expires_at,
      };
    },

    async listProfiles(userId) {
      const rows = await db
        .select()
        .from(gmailSearchProfiles)
        .where(eq(gmailSearchProfiles.user_id, userId))
        .orderBy(desc(gmailSearchProfiles.created_at));
      return rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        query: row.query,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    },

    async getProfile(userId, id) {
      const [row] = await db
        .select()
        .from(gmailSearchProfiles)
        .where(and(eq(gmailSearchProfiles.id, id), eq(gmailSearchProfiles.user_id, userId)))
        .limit(1);
      return row
        ? {
            id: row.id,
            user_id: row.user_id,
            name: row.name,
            query: row.query,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }
        : null;
    },

    async createProfile(userId, name, query) {
      const [row] = await db
        .insert(gmailSearchProfiles)
        .values({ user_id: userId, name, query })
        .returning();
      return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        query: row.query,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    },

    async updateProfile(userId, id, patch) {
      const [row] = await db
        .update(gmailSearchProfiles)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.query !== undefined ? { query: patch.query } : {}),
          updated_at: new Date(),
        })
        .where(and(eq(gmailSearchProfiles.id, id), eq(gmailSearchProfiles.user_id, userId)))
        .returning();
      return row
        ? {
            id: row.id,
            user_id: row.user_id,
            name: row.name,
            query: row.query,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }
        : null;
    },

    async deleteProfile(userId, id) {
      const deleted = await db
        .delete(gmailSearchProfiles)
        .where(and(eq(gmailSearchProfiles.id, id), eq(gmailSearchProfiles.user_id, userId)))
        .returning({ id: gmailSearchProfiles.id });
      return deleted.length > 0;
    },

    async insertSearchSession(row) {
      const [created] = await db
        .insert(gmailSearchSessions)
        .values({
          user_id: row.user_id,
          query: row.query,
          profile_id: row.profile_id,
          gmail_page_token: row.gmail_page_token,
          candidates: row.candidates as unknown as Record<string, unknown>[],
          expires_at: row.expires_at,
        })
        .returning();
      return sessionFromRow(created);
    },

    async getSearchSession(userId, id, options) {
      const [row] = await db
        .select()
        .from(gmailSearchSessions)
        .where(and(eq(gmailSearchSessions.id, id), eq(gmailSearchSessions.user_id, userId)))
        .limit(1);
      if (!row) return null;
      if (!options?.allowExpired && row.expires_at.getTime() < Date.now()) return null;
      return sessionFromRow(row);
    },

    async findSearchSessionByPageToken(userId, pageToken) {
      const [row] = await db
        .select()
        .from(gmailSearchSessions)
        .where(and(eq(gmailSearchSessions.user_id, userId), eq(gmailSearchSessions.gmail_page_token, pageToken)))
        .limit(1);
      if (!row || row.expires_at.getTime() < Date.now()) return null;
      return sessionFromRow(row);
    },

    async updateSearchSession(userId, id, patch) {
      const [row] = await db
        .update(gmailSearchSessions)
        .set({
          ...(patch.candidates ? { candidates: patch.candidates as unknown as Record<string, unknown>[] } : {}),
          ...(patch.gmail_page_token !== undefined ? { gmail_page_token: patch.gmail_page_token } : {}),
          ...(patch.query !== undefined ? { query: patch.query } : {}),
          ...(patch.profile_id !== undefined ? { profile_id: patch.profile_id } : {}),
          ...(patch.expires_at ? { expires_at: patch.expires_at } : {}),
          updated_at: new Date(),
        })
        .where(and(eq(gmailSearchSessions.id, id), eq(gmailSearchSessions.user_id, userId)))
        .returning();
      return row ? sessionFromRow(row) : null;
    },

    async listContacts(query) {
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const page = Math.max(1, query.page ?? 1);
      const offset = (page - 1) * pageSize;
      const filters = [];
      if (query.source) filters.push(eq(emailContacts.source, query.source));
      if (query.search?.trim()) {
        const term = `%${query.search.trim()}%`;
        filters.push(or(
          ilike(emailContacts.email, term),
          ilike(emailContacts.email_normalized, term),
          ilike(emailContacts.first_name, term),
        ));
      }
      const where = filters.length > 0 ? and(...filters) : undefined;
      const order =
        query.sort === "oldest"
          ? asc(emailContacts.created_at)
          : query.sort === "email"
            ? asc(emailContacts.email_normalized)
            : query.sort === "name"
              ? asc(emailContacts.first_name)
              : desc(emailContacts.created_at);
      const rows = await db
        .select()
        .from(emailContacts)
        .where(where)
        .orderBy(order)
        .limit(pageSize)
        .offset(offset);
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(emailContacts)
        .where(where);
      return {
        rows: rows.map(contactFromRow),
        total: Number(countRow?.count ?? 0),
      };
    },

    async listAllContacts() {
      const rows = await db.select().from(emailContacts).orderBy(asc(emailContacts.email_normalized));
      return rows.map(contactFromRow);
    },

    async getContactById(id) {
      const [row] = await db.select().from(emailContacts).where(eq(emailContacts.id, id)).limit(1);
      return row ? contactFromRow(row) : null;
    },

    async getContactByNormalized(emailNormalized) {
      const key = normalizeEmail(emailNormalized);
      const [row] = await db
        .select()
        .from(emailContacts)
        .where(sql`lower(${emailContacts.email_normalized}) = ${key}`)
        .limit(1);
      return row ? contactFromRow(row) : null;
    },

    async existingNormalizedEmails() {
      const rows = await db.select({ email_normalized: emailContacts.email_normalized }).from(emailContacts);
      return new Set(rows.map((row) => normalizeEmail(row.email_normalized)));
    },

    async insertContact(row) {
      const [created] = await db
        .insert(emailContacts)
        .values({
          first_name: row.first_name,
          email: row.email,
          email_normalized: normalizeEmail(row.email_normalized),
          source: row.source,
          source_reference: row.source_reference,
          imported_by_user_id: row.imported_by_user_id,
        })
        .returning();
      return contactFromRow(created);
    },

    async updateContact(id, patch) {
      const [row] = await db
        .update(emailContacts)
        .set({
          ...patch,
          updated_at: new Date(),
        })
        .where(eq(emailContacts.id, id))
        .returning();
      return row ? contactFromRow(row) : null;
    },

    async deleteContact(id) {
      const deleted = await db.delete(emailContacts).where(eq(emailContacts.id, id)).returning({ id: emailContacts.id });
      return deleted.length > 0;
    },

    async deleteContacts(ids) {
      if (ids.length === 0) return 0;
      const deleted = await db.delete(emailContacts).where(inArray(emailContacts.id, ids)).returning({ id: emailContacts.id });
      return deleted.length;
    },

    async insertEvidence(row) {
      await db.insert(emailContactGmailEvidence).values(row);
    },

    async insertCsvSession(row) {
      const [created] = await db
        .insert(emailCsvImportSessions)
        .values({
          user_id: row.user_id,
          column_map: row.column_map as unknown as Record<string, string>,
          rows: row.rows as unknown as Record<string, unknown>[],
          expires_at: row.expires_at,
        })
        .returning();
      return {
        id: created.id,
        user_id: created.user_id,
        column_map: created.column_map as unknown as CsvColumnMap,
        rows: created.rows as unknown as CsvPreviewRow[],
        expires_at: created.expires_at,
      };
    },

    async getCsvSession(userId, id) {
      const [row] = await db
        .select()
        .from(emailCsvImportSessions)
        .where(and(eq(emailCsvImportSessions.id, id), eq(emailCsvImportSessions.user_id, userId)))
        .limit(1);
      if (!row || row.expires_at.getTime() < Date.now()) return null;
      return {
        id: row.id,
        user_id: row.user_id,
        column_map: row.column_map as unknown as CsvColumnMap,
        rows: row.rows as unknown as CsvPreviewRow[],
        expires_at: row.expires_at,
      };
    },

    async listExclusions() {
      const rows = await db.select().from(emailExclusionRules).orderBy(asc(emailExclusionRules.kind), asc(emailExclusionRules.value));
      return rows.map((row) => ({
        id: row.id,
        kind: row.kind === "email" ? "email" : "domain",
        value: row.value,
        pattern: row.pattern,
        created_by_user_id: row.created_by_user_id,
        created_at: row.created_at,
      }));
    },

    async insertExclusion(row) {
      const [created] = await db.insert(emailExclusionRules).values(row).returning();
      return {
        id: created.id,
        kind: created.kind === "email" ? "email" : "domain",
        value: created.value,
        pattern: created.pattern,
        created_by_user_id: created.created_by_user_id,
        created_at: created.created_at,
      };
    },

    async deleteExclusion(id) {
      const deleted = await db.delete(emailExclusionRules).where(eq(emailExclusionRules.id, id)).returning({ id: emailExclusionRules.id });
      return deleted.length > 0;
    },
  };
}

export function createMemoryEmailListStore(): EmailListStore & {
  connections: ConnectionRow[];
  contacts: ContactRow[];
  evidence: EvidenceInsert[];
  searchSessions: SearchSessionRow[];
  csvSessions: CsvSessionRow[];
  profiles: SearchProfileRow[];
  oauthStates: OauthStateRow[];
  exclusions: ExclusionRow[];
} {
  const connections: ConnectionRow[] = [];
  const contacts: ContactRow[] = [];
  const evidence: EvidenceInsert[] = [];
  const searchSessions: SearchSessionRow[] = [];
  const csvSessions: CsvSessionRow[] = [];
  const profiles: SearchProfileRow[] = [];
  const oauthStates: OauthStateRow[] = [];
  const exclusions: ExclusionRow[] = [];

  return {
    connections,
    contacts,
    evidence,
    searchSessions,
    csvSessions,
    profiles,
    oauthStates,
    exclusions,
    async getConnection(userId) {
      return connections.find((row) => row.user_id === userId) ?? null;
    },
    async upsertConnection(row) {
      const existing = connections.find((item) => item.user_id === row.user_id);
      if (existing) {
        Object.assign(existing, row);
        return existing;
      }
      const created: ConnectionRow = {
        id: randomUUID(),
        connected_at: row.connected_at ?? new Date(),
        ...row,
      };
      connections.push(created);
      return created;
    },
    async deleteConnection(userId) {
      const index = connections.findIndex((row) => row.user_id === userId);
      if (index >= 0) connections.splice(index, 1);
    },
    async insertOauthState(row) {
      oauthStates.push({ ...row });
    },
    async consumeOauthState(state) {
      const index = oauthStates.findIndex((row) => row.state === state);
      if (index < 0) return null;
      const [row] = oauthStates.splice(index, 1);
      return row;
    },
    async listProfiles(userId) {
      return profiles.filter((row) => row.user_id === userId);
    },
    async getProfile(userId, id) {
      return profiles.find((row) => row.user_id === userId && row.id === id) ?? null;
    },
    async createProfile(userId, name, query) {
      const row: SearchProfileRow = {
        id: randomUUID(),
        user_id: userId,
        name,
        query,
        created_at: new Date(),
        updated_at: new Date(),
      };
      profiles.push(row);
      return row;
    },
    async updateProfile(userId, id, patch) {
      const row = profiles.find((item) => item.user_id === userId && item.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updated_at: new Date() });
      return row;
    },
    async deleteProfile(userId, id) {
      const index = profiles.findIndex((row) => row.user_id === userId && row.id === id);
      if (index < 0) return false;
      profiles.splice(index, 1);
      return true;
    },
    async insertSearchSession(row) {
      const created: SearchSessionRow = { id: randomUUID(), ...row, candidates: [...row.candidates] };
      searchSessions.push(created);
      return created;
    },
    async getSearchSession(userId, id, options) {
      const row = searchSessions.find((item) => item.user_id === userId && item.id === id);
      if (!row) return null;
      if (!options?.allowExpired && row.expires_at.getTime() < Date.now()) return null;
      return { ...row, candidates: [...row.candidates] };
    },
    async findSearchSessionByPageToken(userId, pageToken) {
      const row = searchSessions.find((item) => item.user_id === userId && item.gmail_page_token === pageToken);
      if (!row || row.expires_at.getTime() < Date.now()) return null;
      return { ...row, candidates: [...row.candidates] };
    },
    async updateSearchSession(userId, id, patch) {
      const row = searchSessions.find((item) => item.user_id === userId && item.id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return { ...row, candidates: [...row.candidates] };
    },
    async listContacts(query) {
      let rows = [...contacts];
      if (query.source) rows = rows.filter((row) => row.source === query.source);
      if (query.search?.trim()) {
        const term = query.search.trim().toLowerCase();
        rows = rows.filter((row) =>
          row.email.toLowerCase().includes(term)
          || row.email_normalized.toLowerCase().includes(term)
          || (row.first_name ?? "").toLowerCase().includes(term)
        );
      }
      rows.sort((left, right) => {
        if (query.sort === "oldest") return left.created_at.getTime() - right.created_at.getTime();
        if (query.sort === "email") return left.email_normalized.localeCompare(right.email_normalized);
        if (query.sort === "name") return (left.first_name ?? "").localeCompare(right.first_name ?? "");
        return right.created_at.getTime() - left.created_at.getTime();
      });
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const page = Math.max(1, query.page ?? 1);
      const start = (page - 1) * pageSize;
      return { rows: rows.slice(start, start + pageSize), total: rows.length };
    },
    async listAllContacts() {
      return [...contacts].sort((left, right) => left.email_normalized.localeCompare(right.email_normalized));
    },

    async getContactById(id) {
      return contacts.find((row) => row.id === id) ?? null;
    },
    async getContactByNormalized(emailNormalized) {
      const key = normalizeEmail(emailNormalized);
      return contacts.find((row) => normalizeEmail(row.email_normalized) === key) ?? null;
    },
    async existingNormalizedEmails() {
      return new Set(contacts.map((row) => normalizeEmail(row.email_normalized)));
    },
    async insertContact(row) {
      const emailNormalized = normalizeEmail(row.email_normalized);
      if (contacts.some((item) => normalizeEmail(item.email_normalized) === emailNormalized)) {
        const error = new Error("duplicate") as Error & { code: string };
        error.code = "23505";
        throw error;
      }
      const created: ContactRow = {
        id: randomUUID(),
        created_at: new Date(),
        updated_at: new Date(),
        ...row,
        email_normalized: emailNormalized,
      };
      contacts.push(created);
      return created;
    },
    async updateContact(id, patch) {
      const row = contacts.find((item) => item.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updated_at: new Date() });
      return row;
    },
    async deleteContact(id) {
      const index = contacts.findIndex((row) => row.id === id);
      if (index < 0) return false;
      contacts.splice(index, 1);
      return true;
    },
    async deleteContacts(ids) {
      let count = 0;
      for (const id of ids) {
        if (await this.deleteContact(id)) count += 1;
      }
      return count;
    },
    async insertEvidence(row) {
      evidence.push({ ...row });
    },
    async insertCsvSession(row) {
      const created: CsvSessionRow = { id: randomUUID(), ...row, rows: [...row.rows] };
      csvSessions.push(created);
      return created;
    },
    async getCsvSession(userId, id) {
      const row = csvSessions.find((item) => item.user_id === userId && item.id === id);
      if (!row || row.expires_at.getTime() < Date.now()) return null;
      return { ...row, rows: [...row.rows] };
    },
    async listExclusions() {
      return [...exclusions];
    },
    async insertExclusion(row) {
      if (exclusions.some((item) => item.kind === row.kind && item.value === row.value)) {
        const error = new Error("duplicate") as Error & { code: string };
        error.code = "23505";
        throw error;
      }
      const created: ExclusionRow = {
        id: randomUUID(),
        created_at: new Date(),
        ...row,
      };
      exclusions.push(created);
      return created;
    },
    async deleteExclusion(id) {
      const index = exclusions.findIndex((row) => row.id === id);
      if (index < 0) return false;
      exclusions.splice(index, 1);
      return true;
    },
  };
}
