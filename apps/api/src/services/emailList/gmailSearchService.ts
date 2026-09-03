import { createHttpError } from "../booking/errors.js";
import { buildCandidatesFromThreads, dedupeCandidatesByEmail } from "./candidateBuild.js";
import { dedupeStoredContacts } from "./contactService.js";
import { normalizeEmail } from "./emailNormalize.js";
import { isDuplicateKey } from "./exclusionService.js";
import type { EmailListStore } from "./emailListStore.js";
import { ownerAddresses, resolveGmailClient, type GmailClient, type GmailThreadMeta } from "./gmailClient.js";
import { getValidAccessToken } from "./gmailConnectionService.js";
import { buildGmailSearchQuery, parseSearchYear } from "./gmailSearchQuery.js";
import type { StoredGmailCandidate } from "./types.js";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const CANDIDATE_BATCH_SIZE = 1000;
const GMAIL_PAGE_SIZE = 500;
const GMAIL_PAGES_PER_BATCH = 30;
const THREAD_CONCURRENCY = 4;

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) || 1 }, () => worker()));
  return results;
}

export function rejectForgedCandidatePayload(body: Record<string, unknown>) {
  if ("email" in body || "emails" in body || "firstName" in body || "first_name" in body || "candidates" in body) {
    throw createHttpError(400, "Save accepts only searchSessionId and candidateIds");
  }
}

export async function listSearchProfiles(store: EmailListStore, userId: string) {
  return store.listProfiles(userId);
}

export async function createSearchProfile(store: EmailListStore, userId: string, input: { name?: string; query?: string }) {
  const name = input.name?.trim() ?? "";
  const query = input.query?.trim() ?? "";
  if (!name || !query) {
    throw createHttpError(400, "Profile name and query are required");
  }
  return store.createProfile(userId, name, query);
}

export async function updateSearchProfile(
  store: EmailListStore,
  userId: string,
  id: string,
  input: { name?: string; query?: string },
) {
  const updated = await store.updateProfile(userId, id, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.query !== undefined ? { query: input.query.trim() } : {}),
  });
  if (!updated) throw createHttpError(404, "Search profile not found");
  return updated;
}

export async function deleteSearchProfile(store: EmailListStore, userId: string, id: string) {
  const deleted = await store.deleteProfile(userId, id);
  if (!deleted) throw createHttpError(404, "Search profile not found");
  return { deleted: true };
}

export async function searchGmailCandidates(
  store: EmailListStore,
  userId: string,
  input: { query?: string; year?: unknown; pageToken?: string; searchSessionId?: string; profileId?: string; batchSize?: number },
  client: GmailClient = resolveGmailClient(),
) {
  const keyword = input.query?.trim() ?? "";
  if (!keyword) {
    throw createHttpError(400, "Search query is required");
  }
  const year = parseSearchYear(input.year);
  const target = Math.max(1, Math.min(5000, input.batchSize ?? CANDIDATE_BATCH_SIZE));

  let priorSession = input.searchSessionId ? await store.getSearchSession(userId, input.searchSessionId) : null;
  if (input.searchSessionId && !priorSession) {
    throw createHttpError(404, "Search session not found");
  }
  if (input.pageToken) {
    priorSession = priorSession ?? await store.findSearchSessionByPageToken(userId, input.pageToken);
    if (!priorSession || priorSession.gmail_page_token !== input.pageToken) {
      throw createHttpError(400, "Invalid or expired Gmail page token");
    }
  }
  const query = input.pageToken && priorSession
    ? priorSession.query
    : buildGmailSearchQuery(keyword, year);

  const { accessToken, gmailAddress } = await getValidAccessToken(store, userId, client);
  await dedupeStoredContacts(store);
  const existing = await store.existingNormalizedEmails();
  const suppressed = await store.existingSuppressedEmails();
  const exclusionRules = await store.listExclusions();
  const owners = ownerAddresses(gmailAddress);

  let accumulated = input.pageToken && priorSession ? [...priorSession.candidates] : [];
  let pageToken: string | null = input.pageToken ?? null;
  let pages = 0;
  let nextPageToken: string | null = null;
  let addedThisBatch = 0;

  while (pages < GMAIL_PAGES_PER_BATCH && addedThisBatch < target) {
    let listed: Awaited<ReturnType<GmailClient["listMessageIds"]>>;
    try {
      listed = await client.listMessageIds(accessToken, query, pageToken, GMAIL_PAGE_SIZE);
    } catch (error) {
      if (accumulated.length > 0) {
        nextPageToken = pageToken;
        break;
      }
      throw error;
    }
    pages += 1;
    const matchingMessageIds = new Set(listed.ids.map((item) => item.id));
    const threadIds = [...new Set(listed.ids.map((item) => item.threadId))];
    const threads: GmailThreadMeta[] = threadIds.length === 0
      ? []
      : (await mapPool(threadIds, THREAD_CONCURRENCY, async (threadId) => {
        try {
          return await client.getThreadMetadata(accessToken, threadId);
        } catch {
          return null;
        }
      })).filter((thread): thread is GmailThreadMeta => thread !== null);
    const pageCandidates = buildCandidatesFromThreads({
      threads,
      matchingMessageIds,
      query: keyword,
      profileId: input.profileId ?? priorSession?.profile_id ?? null,
      ownerAddresses: owners,
      existing: { has: (email) => existing.has(normalizeEmail(email)) },
      exclusionRules,
      suppressed: { has: (email) => suppressed.has(normalizeEmail(email)) },
    });
    const before = accumulated.length;
    accumulated = dedupeCandidatesByEmail([...accumulated, ...pageCandidates]);
    addedThisBatch += accumulated.length - before;
    nextPageToken = listed.nextPageToken;
    if (!nextPageToken || listed.ids.length === 0) break;
    pageToken = nextPageToken;
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = priorSession
    ? await store.updateSearchSession(userId, priorSession.id, {
      candidates: accumulated,
      gmail_page_token: nextPageToken,
      expires_at: expiresAt,
    }) ?? await store.insertSearchSession({
      user_id: userId,
      query,
      profile_id: input.profileId ?? priorSession.profile_id ?? null,
      gmail_page_token: nextPageToken,
      candidates: accumulated,
      expires_at: expiresAt,
    })
    : await store.insertSearchSession({
      user_id: userId,
      query,
      profile_id: input.profileId ?? null,
      gmail_page_token: nextPageToken,
      candidates: accumulated,
      expires_at: expiresAt,
    });

  return {
    searchSessionId: session.id,
    candidates: session.candidates,
    total: session.candidates.length,
    batchAdded: addedThisBatch,
    batchPages: pages,
    hasMore: Boolean(nextPageToken),
    nextPageToken,
  };
}

export async function saveGmailCandidates(
  store: EmailListStore,
  userId: string,
  body: Record<string, unknown>,
) {
  rejectForgedCandidatePayload(body);
  const searchSessionId = typeof body.searchSessionId === "string" ? body.searchSessionId : "";
  const candidateIds = Array.isArray(body.candidateIds) ? body.candidateIds.filter((id): id is string => typeof id === "string") : [];
  if (!searchSessionId || candidateIds.length === 0) {
    throw createHttpError(400, "searchSessionId and candidateIds are required");
  }

  const session = await store.getSearchSession(userId, searchSessionId, { allowExpired: true });
  if (!session) {
    throw createHttpError(404, "Search session not found");
  }

  const byId = new Map(session.candidates.map((candidate) => [candidate.id, candidate]));
  const selected: StoredGmailCandidate[] = [];
  for (const id of candidateIds) {
    const candidate = byId.get(id);
    if (!candidate) {
      throw createHttpError(404, "Candidate not found in this search session");
    }
    if (candidate.status === "invalid" || candidate.status === "suppressed") continue;
    selected.push(candidate);
  }

  const suppressed = await store.existingSuppressedEmails();
  const outcomes = await mapPool(selected, 6, async (candidate) => {
    if (suppressed.has(normalizeEmail(candidate.emailNormalized))) {
      return false;
    }
    let contact = await store.getContactByNormalized(candidate.emailNormalized);
    let added = false;
    if (!contact) {
      try {
        contact = await store.insertContact({
          first_name: candidate.firstName,
          email: candidate.email,
          email_normalized: normalizeEmail(candidate.emailNormalized),
          source: "gmail",
          source_reference: candidate.query,
          imported_by_user_id: userId,
        });
        added = true;
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        contact = await store.getContactByNormalized(candidate.emailNormalized);
      }
    } else if (!contact.first_name && candidate.firstName) {
      await store.updateContact(contact.id, { first_name: candidate.firstName });
    }
    if (contact) {
      await store.insertEvidence({
        contact_id: contact.id,
        search_profile_id: candidate.profileId,
        query: candidate.query,
        thread_ids: candidate.threadIds,
        message_ids: candidate.messageIds,
        first_matched_at: candidate.firstContact ? new Date(candidate.firstContact) : null,
        last_matched_at: candidate.lastContact ? new Date(candidate.lastContact) : null,
        match_count: candidate.messageCount,
        two_way: candidate.twoWay,
        imported_by_user_id: userId,
      });
    }
    return added;
  });

  await store.updateSearchSession(userId, session.id, {
    expires_at: new Date(Date.now() + SESSION_TTL_MS),
  });

  return {
    added: outcomes.filter(Boolean).length,
    existing: outcomes.filter((added) => !added).length,
    saved: selected.length,
  };
}

export async function persistEligibleCandidates(
  store: EmailListStore,
  userId: string,
  candidates: StoredGmailCandidate[],
) {
  let added = 0;
  let existing = 0;
  let filtered = 0;
  let invalid = 0;

  const suppressed = await store.existingSuppressedEmails();
  for (const candidate of candidates) {
    if (candidate.status === "invalid") {
      invalid += 1;
      continue;
    }
    if (candidate.status === "filtered" || candidate.status === "suppressed" || suppressed.has(normalizeEmail(candidate.emailNormalized))) {
      filtered += 1;
      continue;
    }
    if (candidate.status === "already_in_list") {
      existing += 1;
      continue;
    }

    let contact = await store.getContactByNormalized(candidate.emailNormalized);
    if (!contact) {
      try {
        contact = await store.insertContact({
          first_name: candidate.firstName,
          email: candidate.email,
          email_normalized: normalizeEmail(candidate.emailNormalized),
          source: "gmail",
          source_reference: candidate.query,
          imported_by_user_id: userId,
        });
        added += 1;
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        contact = await store.getContactByNormalized(candidate.emailNormalized);
        existing += 1;
      }
    } else {
      existing += 1;
      if (!contact.first_name && candidate.firstName) {
        await store.updateContact(contact.id, { first_name: candidate.firstName });
      }
    }
    if (!contact) continue;
    await store.insertEvidence({
      contact_id: contact.id,
      search_profile_id: candidate.profileId,
      query: candidate.query,
      thread_ids: candidate.threadIds,
      message_ids: candidate.messageIds,
      first_matched_at: candidate.firstContact ? new Date(candidate.firstContact) : null,
      last_matched_at: candidate.lastContact ? new Date(candidate.lastContact) : null,
      match_count: candidate.messageCount,
      two_way: candidate.twoWay,
      imported_by_user_id: userId,
    });
  }

  return { added, existing, filtered, invalid };
}

export async function importGmailMatches(
  store: EmailListStore,
  userId: string,
  input: { query?: string; year?: unknown; pageToken?: string; searchSessionId?: string },
  client: GmailClient = resolveGmailClient(),
) {
  const query = input.query?.trim() ?? "";
  if (!query) {
    throw createHttpError(400, "Search query is required");
  }

  const loaded = await searchGmailCandidates(store, userId, input, client);
  const persisted = await persistEligibleCandidates(store, userId, loaded.candidates);
  const known = await store.existingNormalizedEmails();
  const candidates = loaded.candidates.map((candidate) => (
    known.has(normalizeEmail(candidate.emailNormalized)) && candidate.status === "new"
      ? { ...candidate, status: "already_in_list" as const }
      : candidate
  ));
  await store.updateSearchSession(userId, loaded.searchSessionId, { candidates });
  return {
    query,
    ...persisted,
    searchSessionId: loaded.searchSessionId,
    candidates,
    pages: loaded.batchPages,
    hasMore: loaded.hasMore,
    nextPageToken: loaded.nextPageToken,
    total: candidates.length,
  };
}
