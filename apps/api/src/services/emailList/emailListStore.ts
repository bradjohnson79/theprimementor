import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  emailContactGmailEvidence,
  emailContacts,
  emailCsvImportSessions,
  emailDeliveryEvents,
  emailExclusionRules,
  emailHealthChecks,
  emailHealthJobs,
  emailSuppressions,
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
import type {
  DeliveryEventKind,
  HealthJobScope,
  HealthJobStatus,
  HealthStatus,
  SuppressionReason,
  SuppressionSource,
} from "./emailHealthTypes.js";

export type ContactSource = "gmail" | "csv" | "manual";

export interface ContactRow {
  id: string;
  first_name: string | null;
  email: string;
  email_normalized: string;
  source: ContactSource;
  source_reference: string | null;
  imported_by_user_id: string | null;
  health_status: HealthStatus;
  health_checked_at: Date | null;
  health_source: string | null;
  health_reason: string | null;
  last_bounce_at: Date | null;
  bounce_count: number;
  soft_bounce_count: number;
  last_soft_bounce_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
}

export type ContactInsert = {
  first_name: string | null;
  email: string;
  email_normalized: string;
  source: ContactSource;
  source_reference: string | null;
  imported_by_user_id: string | null;
};

export type ContactPatch = {
  first_name?: string | null;
  email?: string;
  email_normalized?: string;
  health_status?: HealthStatus;
  health_checked_at?: Date | null;
  health_source?: string | null;
  health_reason?: string | null;
  last_bounce_at?: Date | null;
  bounce_count?: number;
  soft_bounce_count?: number;
  last_soft_bounce_at?: Date | null;
};

export interface SuppressionRow {
  id: string;
  email_normalized: string;
  reason: SuppressionReason;
  source: SuppressionSource;
  provider_event_id: string | null;
  suppressed_at: Date;
  created_by_user_id: string | null;
  created_at: Date;
}

export interface HealthCheckRow {
  id: string;
  contact_id: string | null;
  email_normalized: string;
  previous_status: string | null;
  new_status: string;
  source: string;
  reason: string | null;
  checked_at: Date;
}

export interface DeliveryEventRow {
  id: string;
  provider: string;
  provider_event_id: string;
  email_normalized: string;
  kind: DeliveryEventKind;
  received_at: Date;
}

export type HealthJobCounts = Record<string, number>;

export interface HealthJobRow {
  id: string;
  user_id: string;
  scope: HealthJobScope;
  status: HealthJobStatus;
  total: number;
  completed: number;
  counts: HealthJobCounts;
  error: string | null;
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
  healthStatus?: HealthStatus | "";
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
  existingSuppressedEmails(): Promise<Set<string>>;
  insertContact(row: ContactInsert): Promise<ContactRow>;
  updateContact(id: string, patch: ContactPatch): Promise<ContactRow | null>;
  deleteContact(id: string): Promise<boolean>;
  deleteContacts(ids: string[]): Promise<number>;
  insertEvidence(row: EvidenceInsert): Promise<void>;
  insertCsvSession(row: Omit<CsvSessionRow, "id">): Promise<CsvSessionRow>;
  getCsvSession(userId: string, id: string): Promise<CsvSessionRow | null>;
  listExclusions(): Promise<ExclusionRow[]>;
  insertExclusion(row: { kind: ExclusionKind; value: string; pattern: string; created_by_user_id: string }): Promise<ExclusionRow>;
  deleteExclusion(id: string): Promise<boolean>;
  getSuppressionByNormalized(emailNormalized: string): Promise<SuppressionRow | null>;
  getSuppressionById(id: string): Promise<SuppressionRow | null>;
  listSuppressions(): Promise<SuppressionRow[]>;
  insertSuppression(row: {
    email_normalized: string;
    reason: SuppressionReason;
    source: SuppressionSource;
    provider_event_id?: string | null;
    created_by_user_id?: string | null;
  }): Promise<SuppressionRow>;
  deleteSuppression(id: string): Promise<boolean>;
  insertHealthCheck(row: {
    contact_id?: string | null;
    email_normalized: string;
    previous_status?: string | null;
    new_status: string;
    source: string;
    reason?: string | null;
  }): Promise<HealthCheckRow>;
  insertDeliveryEvent(row: {
    provider: string;
    provider_event_id: string;
    email_normalized: string;
    kind: DeliveryEventKind;
  }): Promise<{ row: DeliveryEventRow; created: boolean }>;
  listContactsForHealthScope(input: {
    scope: HealthJobScope;
    ids?: string[];
    staleBefore?: Date;
    force?: boolean;
  }): Promise<ContactRow[]>;
  createHealthJob(row: {
    user_id: string;
    scope: HealthJobScope;
    total?: number;
    counts?: HealthJobCounts;
  }): Promise<HealthJobRow>;
  getHealthJob(id: string): Promise<HealthJobRow | null>;
  updateHealthJob(id: string, patch: {
    status?: HealthJobStatus;
    total?: number;
    completed?: number;
    counts?: HealthJobCounts;
    error?: string | null;
  }): Promise<HealthJobRow | null>;
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

function asHealthStatus(value: string | null | undefined): HealthStatus {
  switch (value) {
    case "checking":
    case "deliverable":
    case "likely_deliverable":
    case "risky":
    case "catch_all":
    case "soft_bounce":
    case "hard_bounce":
    case "invalid":
    case "blocked":
    case "unknown":
      return value;
    default:
      return "unchecked";
  }
}

function asSuppressionReason(value: string): SuppressionReason {
  if (value === "invalid" || value === "provider_permanent_rejection") return value;
  return "hard_bounce";
}

function asSuppressionSource(value: string): SuppressionSource {
  if (value === "brevo" || value === "manual") return value;
  return "verifier";
}

function asDeliveryKind(value: string): DeliveryEventKind {
  switch (value) {
    case "hard_bounce":
    case "soft_bounce":
    case "blocked":
    case "spam":
    case "unsubscribed":
      return value;
    default:
      return "delivered";
  }
}

function asJobScope(value: string): HealthJobScope {
  if (value === "ids" || value === "unchecked" || value === "stale") return value;
  return "all_active";
}

function asJobStatus(value: string): HealthJobStatus {
  if (value === "running" || value === "completed" || value === "failed") return value;
  return "queued";
}

function defaultHealth(): Pick<
  ContactRow,
  | "health_status"
  | "health_checked_at"
  | "health_source"
  | "health_reason"
  | "last_bounce_at"
  | "bounce_count"
  | "soft_bounce_count"
  | "last_soft_bounce_at"
> {
  return {
    health_status: "unchecked",
    health_checked_at: null,
    health_source: null,
    health_reason: null,
    last_bounce_at: null,
    bounce_count: 0,
    soft_bounce_count: 0,
    last_soft_bounce_at: null,
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
    health_status: asHealthStatus(row.health_status),
    health_checked_at: row.health_checked_at,
    health_source: row.health_source,
    health_reason: row.health_reason,
    last_bounce_at: row.last_bounce_at,
    bounce_count: row.bounce_count ?? 0,
    soft_bounce_count: row.soft_bounce_count ?? 0,
    last_soft_bounce_at: row.last_soft_bounce_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function suppressionFromRow(row: typeof emailSuppressions.$inferSelect): SuppressionRow {
  return {
    id: row.id,
    email_normalized: row.email_normalized,
    reason: asSuppressionReason(row.reason),
    source: asSuppressionSource(row.source),
    provider_event_id: row.provider_event_id,
    suppressed_at: row.suppressed_at,
    created_by_user_id: row.created_by_user_id,
    created_at: row.created_at,
  };
}

export function filterContactsForHealthScope(
  rows: ContactRow[],
  input: { scope: HealthJobScope; ids?: string[]; staleBefore?: Date; force?: boolean },
): ContactRow[] {
  const staleBefore = input.staleBefore ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let selected = [...rows];
  if (input.scope === "ids") {
    const ids = new Set(input.ids ?? []);
    selected = selected.filter((row) => ids.has(row.id));
  } else if (input.scope === "unchecked") {
    selected = selected.filter((row) => row.health_status === "unchecked" || !row.health_checked_at);
  } else if (input.scope === "stale") {
    selected = selected.filter((row) => !row.health_checked_at || row.health_checked_at.getTime() < staleBefore.getTime());
  }
  if (!input.force && input.scope !== "unchecked" && input.scope !== "ids") {
    selected = selected.filter((row) => (
      !row.health_checked_at || row.health_checked_at.getTime() < staleBefore.getTime()
    ));
  }
  return selected;
}

function jobFromRow(row: typeof emailHealthJobs.$inferSelect): HealthJobRow {
  return {
    id: row.id,
    user_id: row.user_id,
    scope: asJobScope(row.scope),
    status: asJobStatus(row.status),
    total: row.total,
    completed: row.completed,
    counts: (row.counts ?? {}) as HealthJobCounts,
    error: row.error,
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
      if (query.healthStatus) filters.push(eq(emailContacts.health_status, query.healthStatus));
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
        .where(eq(emailContacts.email_normalized, key))
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

    async existingSuppressedEmails() {
      const rows = await db.select({ email_normalized: emailSuppressions.email_normalized }).from(emailSuppressions);
      return new Set(rows.map((row) => normalizeEmail(row.email_normalized)));
    },

    async getSuppressionByNormalized(emailNormalized) {
      const key = normalizeEmail(emailNormalized);
      const [row] = await db
        .select()
        .from(emailSuppressions)
        .where(eq(emailSuppressions.email_normalized, key))
        .limit(1);
      return row ? suppressionFromRow(row) : null;
    },

    async getSuppressionById(id) {
      const [row] = await db.select().from(emailSuppressions).where(eq(emailSuppressions.id, id)).limit(1);
      return row ? suppressionFromRow(row) : null;
    },

    async listSuppressions() {
      const rows = await db.select().from(emailSuppressions).orderBy(desc(emailSuppressions.suppressed_at));
      return rows.map(suppressionFromRow);
    },

    async insertSuppression(row) {
      try {
        const [created] = await db
          .insert(emailSuppressions)
          .values({
            email_normalized: normalizeEmail(row.email_normalized),
            reason: row.reason,
            source: row.source,
            provider_event_id: row.provider_event_id ?? null,
            created_by_user_id: row.created_by_user_id ?? null,
          })
          .returning();
        return suppressionFromRow(created);
      } catch (error) {
        const existing = await this.getSuppressionByNormalized(row.email_normalized);
        if (existing) return existing;
        throw error;
      }
    },

    async deleteSuppression(id) {
      const deleted = await db.delete(emailSuppressions).where(eq(emailSuppressions.id, id)).returning({ id: emailSuppressions.id });
      return deleted.length > 0;
    },

    async insertHealthCheck(row) {
      const [created] = await db
        .insert(emailHealthChecks)
        .values({
          contact_id: row.contact_id ?? null,
          email_normalized: normalizeEmail(row.email_normalized),
          previous_status: row.previous_status ?? null,
          new_status: row.new_status,
          source: row.source,
          reason: row.reason ?? null,
        })
        .returning();
      return {
        id: created.id,
        contact_id: created.contact_id,
        email_normalized: created.email_normalized,
        previous_status: created.previous_status,
        new_status: created.new_status,
        source: created.source,
        reason: created.reason,
        checked_at: created.checked_at,
      };
    },

    async insertDeliveryEvent(row) {
      const existing = await db
        .select()
        .from(emailDeliveryEvents)
        .where(and(
          eq(emailDeliveryEvents.provider, row.provider),
          eq(emailDeliveryEvents.provider_event_id, row.provider_event_id),
        ))
        .limit(1);
      if (existing[0]) {
        return {
          row: {
            id: existing[0].id,
            provider: existing[0].provider,
            provider_event_id: existing[0].provider_event_id,
            email_normalized: existing[0].email_normalized,
            kind: asDeliveryKind(existing[0].kind),
            received_at: existing[0].received_at,
          },
          created: false,
        };
      }
      try {
        const [created] = await db
          .insert(emailDeliveryEvents)
          .values({
            provider: row.provider,
            provider_event_id: row.provider_event_id,
            email_normalized: normalizeEmail(row.email_normalized),
            kind: row.kind,
          })
          .returning();
        return {
          row: {
            id: created.id,
            provider: created.provider,
            provider_event_id: created.provider_event_id,
            email_normalized: created.email_normalized,
            kind: asDeliveryKind(created.kind),
            received_at: created.received_at,
          },
          created: true,
        };
      } catch (error) {
        const [again] = await db
          .select()
          .from(emailDeliveryEvents)
          .where(and(
            eq(emailDeliveryEvents.provider, row.provider),
            eq(emailDeliveryEvents.provider_event_id, row.provider_event_id),
          ))
          .limit(1);
        if (again) {
          return {
            row: {
              id: again.id,
              provider: again.provider,
              provider_event_id: again.provider_event_id,
              email_normalized: again.email_normalized,
              kind: asDeliveryKind(again.kind),
              received_at: again.received_at,
            },
            created: false,
          };
        }
        throw error;
      }
    },

    async listContactsForHealthScope(input) {
      const rows = await db.select().from(emailContacts);
      return filterContactsForHealthScope(rows.map(contactFromRow), input);
    },

    async createHealthJob(row) {
      const [created] = await db
        .insert(emailHealthJobs)
        .values({
          user_id: row.user_id,
          scope: row.scope,
          total: row.total ?? 0,
          counts: row.counts ?? {},
        })
        .returning();
      return jobFromRow(created);
    },

    async getHealthJob(id) {
      const [row] = await db.select().from(emailHealthJobs).where(eq(emailHealthJobs.id, id)).limit(1);
      return row ? jobFromRow(row) : null;
    },

    async updateHealthJob(id, patch) {
      const [row] = await db
        .update(emailHealthJobs)
        .set({
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.total !== undefined ? { total: patch.total } : {}),
          ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
          ...(patch.counts !== undefined ? { counts: patch.counts } : {}),
          ...(patch.error !== undefined ? { error: patch.error } : {}),
          updated_at: new Date(),
        })
        .where(eq(emailHealthJobs.id, id))
        .returning();
      return row ? jobFromRow(row) : null;
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
  suppressions: SuppressionRow[];
  healthChecks: HealthCheckRow[];
  deliveryEvents: DeliveryEventRow[];
  healthJobs: HealthJobRow[];
} {
  const connections: ConnectionRow[] = [];
  const contacts: ContactRow[] = [];
  const evidence: EvidenceInsert[] = [];
  const searchSessions: SearchSessionRow[] = [];
  const csvSessions: CsvSessionRow[] = [];
  const profiles: SearchProfileRow[] = [];
  const oauthStates: OauthStateRow[] = [];
  const exclusions: ExclusionRow[] = [];
  const suppressions: SuppressionRow[] = [];
  const healthChecks: HealthCheckRow[] = [];
  const deliveryEvents: DeliveryEventRow[] = [];
  const healthJobs: HealthJobRow[] = [];

  return {
    connections,
    contacts,
    evidence,
    searchSessions,
    csvSessions,
    profiles,
    oauthStates,
    exclusions,
    suppressions,
    healthChecks,
    deliveryEvents,
    healthJobs,
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
      if (query.healthStatus) rows = rows.filter((row) => row.health_status === query.healthStatus);
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
        ...defaultHealth(),
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
    async existingSuppressedEmails() {
      return new Set(suppressions.map((row) => normalizeEmail(row.email_normalized)));
    },
    async getSuppressionByNormalized(emailNormalized) {
      const key = normalizeEmail(emailNormalized);
      return suppressions.find((row) => normalizeEmail(row.email_normalized) === key) ?? null;
    },
    async getSuppressionById(id) {
      return suppressions.find((row) => row.id === id) ?? null;
    },
    async listSuppressions() {
      return [...suppressions].sort((left, right) => right.suppressed_at.getTime() - left.suppressed_at.getTime());
    },
    async insertSuppression(row) {
      const emailNormalized = normalizeEmail(row.email_normalized);
      const existing = suppressions.find((item) => normalizeEmail(item.email_normalized) === emailNormalized);
      if (existing) return existing;
      const created: SuppressionRow = {
        id: randomUUID(),
        email_normalized: emailNormalized,
        reason: row.reason,
        source: row.source,
        provider_event_id: row.provider_event_id ?? null,
        suppressed_at: new Date(),
        created_by_user_id: row.created_by_user_id ?? null,
        created_at: new Date(),
      };
      suppressions.push(created);
      return created;
    },
    async deleteSuppression(id) {
      const index = suppressions.findIndex((row) => row.id === id);
      if (index < 0) return false;
      suppressions.splice(index, 1);
      return true;
    },
    async insertHealthCheck(row) {
      const created: HealthCheckRow = {
        id: randomUUID(),
        contact_id: row.contact_id ?? null,
        email_normalized: normalizeEmail(row.email_normalized),
        previous_status: row.previous_status ?? null,
        new_status: row.new_status,
        source: row.source,
        reason: row.reason ?? null,
        checked_at: new Date(),
      };
      healthChecks.push(created);
      return created;
    },
    async insertDeliveryEvent(row) {
      const existing = deliveryEvents.find((item) => (
        item.provider === row.provider && item.provider_event_id === row.provider_event_id
      ));
      if (existing) return { row: existing, created: false };
      const created: DeliveryEventRow = {
        id: randomUUID(),
        provider: row.provider,
        provider_event_id: row.provider_event_id,
        email_normalized: normalizeEmail(row.email_normalized),
        kind: row.kind,
        received_at: new Date(),
      };
      deliveryEvents.push(created);
      return { row: created, created: true };
    },
    async listContactsForHealthScope(input) {
      return filterContactsForHealthScope(contacts, input);
    },
    async createHealthJob(row) {
      const created: HealthJobRow = {
        id: randomUUID(),
        user_id: row.user_id,
        scope: row.scope,
        status: "queued",
        total: row.total ?? 0,
        completed: 0,
        counts: { ...(row.counts ?? {}) },
        error: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      healthJobs.push(created);
      return { ...created, counts: { ...created.counts } };
    },
    async getHealthJob(id) {
      const row = healthJobs.find((item) => item.id === id);
      return row ? { ...row, counts: { ...row.counts } } : null;
    },
    async updateHealthJob(id, patch) {
      const row = healthJobs.find((item) => item.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updated_at: new Date() });
      return { ...row, counts: { ...row.counts } };
    },
  };
}
