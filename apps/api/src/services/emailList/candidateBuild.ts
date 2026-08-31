import { randomUUID } from "node:crypto";
import { classifyAutomatedAddress } from "./automatedFilter.js";
import { matchExclusion, type ExclusionRule } from "./exclusionRules.js";
import { extractFirstName } from "./firstName.js";
import { headerMap, isOwnerAddress, parseAddressList } from "./headerParse.js";
import { isValidEmail, normalizeEmail } from "./emailNormalize.js";
import { detectTwoWay, messageDates, type ThreadMessageMeta } from "./twoWay.js";
import type { GmailMessageMeta, GmailThreadMeta } from "./gmailClient.js";
import type { StoredGmailCandidate } from "./types.js";

export interface ExistingContactLookup {
  has(emailNormalized: string): boolean;
}

function addressesFrom(headers: Record<string, string>, name: string) {
  return parseAddressList(headers[name] ?? headers[name.toLowerCase()]);
}

function toThreadMeta(messages: GmailMessageMeta[]): ThreadMessageMeta[] {
  return messages.map((message) => {
    const headers = headerMap(message.headers);
    return {
      from: addressesFrom(headers, "From").map((item) => item.email),
      to: addressesFrom(headers, "To").map((item) => item.email),
      cc: addressesFrom(headers, "Cc").map((item) => item.email),
      date: headers.Date ?? (message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null),
    };
  });
}

export function buildCandidatesFromThreads(input: {
  threads: GmailThreadMeta[];
  matchingMessageIds: Set<string>;
  query: string;
  profileId?: string | null;
  ownerAddresses: string[];
  existing: ExistingContactLookup;
  exclusionRules?: Array<Pick<ExclusionRule, "kind" | "value">>;
}): StoredGmailCandidate[] {
  const exclusionRules = input.exclusionRules ?? [];
  const byEmail = new Map<string, StoredGmailCandidate>();

  for (const thread of input.threads) {
    const threadMeta = toThreadMeta(thread.messages);
    const matchingMessages = thread.messages.filter((message) => input.matchingMessageIds.has(message.id));
    const seedMessages = matchingMessages.length > 0 ? matchingMessages : thread.messages;

    for (const message of seedMessages) {
      const headers = headerMap(message.headers);
      const from = addressesFrom(headers, "From");
      const to = addressesFrom(headers, "To");
      const cc = addressesFrom(headers, "Cc");
      const correspondents = [...from, ...to, ...cc];

      for (const person of correspondents) {
        if (isOwnerAddress(person.email, input.ownerAddresses)) continue;
        if (!isValidEmail(person.email)) {
          const invalidKey = normalizeEmail(person.email);
          if (byEmail.has(invalidKey)) continue;
          byEmail.set(invalidKey, {
            id: randomUUID(),
            email: person.email,
            emailNormalized: invalidKey,
            firstName: person.firstName,
            firstContact: null,
            lastContact: null,
            messageCount: 0,
            twoWay: false,
            sentCount: 0,
            receivedCount: 0,
            query: input.query,
            profileId: input.profileId ?? null,
            threadIds: [thread.id],
            messageIds: [message.id],
            evidenceSummary: "Invalid email address",
            status: "invalid",
            rejectionReason: "Invalid email address",
          });
          continue;
        }

        const filter = classifyAutomatedAddress({
          email: person.email,
          displayName: person.displayName,
          headers,
        });
        const exclusion = matchExclusion(person.email, exclusionRules);
        const rejected = filter.filtered || exclusion.filtered;
        const rejectionReason = filter.reason ?? exclusion.reason;
        const emailNormalized = normalizeEmail(person.email);
        const direction = detectTwoWay(threadMeta, emailNormalized, input.ownerAddresses);
        const dates = messageDates(threadMeta);
        const existing = byEmail.get(emailNormalized);
        const next: StoredGmailCandidate = existing ?? {
          id: randomUUID(),
          email: person.email,
          emailNormalized,
          firstName: person.firstName ?? extractFirstName(person.displayName, person.email),
          firstContact: dates.first?.toISOString() ?? null,
          lastContact: dates.last?.toISOString() ?? null,
          messageCount: 0,
          twoWay: false,
          sentCount: 0,
          receivedCount: 0,
          query: input.query,
          profileId: input.profileId ?? null,
          threadIds: [],
          messageIds: [],
          evidenceSummary: "",
          status: rejected ? "filtered" : input.existing.has(emailNormalized) ? "already_in_list" : "new",
          rejectionReason: rejected ? rejectionReason : null,
        };

        if (!next.threadIds.includes(thread.id)) next.threadIds.push(thread.id);
        if (!next.messageIds.includes(message.id)) next.messageIds.push(message.id);
        next.messageCount = next.messageIds.length;
        next.sentCount = Math.max(next.sentCount, direction.sent);
        next.receivedCount = Math.max(next.receivedCount, direction.received);
        next.twoWay = next.twoWay || direction.twoWay;
        next.firstContact = pickEarlier(next.firstContact, dates.first?.toISOString() ?? null);
        next.lastContact = pickLater(next.lastContact, dates.last?.toISOString() ?? null);
        if (!next.firstName) next.firstName = person.firstName;
        if (rejected && next.status === "new") {
          next.status = "filtered";
          next.rejectionReason = rejectionReason;
        }
        if (input.existing.has(emailNormalized) && next.status === "new") {
          next.status = "already_in_list";
        }
        next.evidenceSummary = buildEvidenceSummary(next);
        byEmail.set(emailNormalized, next);
      }
    }
  }

  return dedupeCandidatesByEmail([...byEmail.values()]);
}

export function dedupeCandidatesByEmail(candidates: StoredGmailCandidate[]): StoredGmailCandidate[] {
  const byEmail = new Map<string, StoredGmailCandidate>();
  for (const candidate of candidates) {
    const key = normalizeEmail(candidate.emailNormalized || candidate.email);
    const current = byEmail.get(key);
    if (!current) {
      byEmail.set(key, { ...candidate, emailNormalized: key, threadIds: [...candidate.threadIds], messageIds: [...candidate.messageIds] });
      continue;
    }
    const threadIds = [...current.threadIds];
    for (const id of candidate.threadIds) {
      if (!threadIds.includes(id)) threadIds.push(id);
    }
    const messageIds = [...current.messageIds];
    for (const id of candidate.messageIds) {
      if (!messageIds.includes(id)) messageIds.push(id);
    }
    const merged: StoredGmailCandidate = {
      ...current,
      emailNormalized: key,
      firstName: current.firstName || candidate.firstName,
      firstContact: pickEarlier(current.firstContact, candidate.firstContact),
      lastContact: pickLater(current.lastContact, candidate.lastContact),
      twoWay: current.twoWay || candidate.twoWay,
      sentCount: Math.max(current.sentCount, candidate.sentCount),
      receivedCount: Math.max(current.receivedCount, candidate.receivedCount),
      threadIds,
      messageIds,
      messageCount: messageIds.length,
      status: current.status === "filtered" || candidate.status === "filtered"
        ? "filtered"
        : current.status === "already_in_list" || candidate.status === "already_in_list"
          ? "already_in_list"
          : current.status === "invalid" || candidate.status === "invalid"
            ? "invalid"
            : "new",
      rejectionReason: current.rejectionReason ?? candidate.rejectionReason,
    };
    merged.evidenceSummary = buildEvidenceSummary(merged);
    byEmail.set(key, merged);
  }
  return [...byEmail.values()];
}

function pickEarlier(current: string | null, next: string | null): string | null {
  if (!current) return next;
  if (!next) return current;
  return new Date(next).getTime() < new Date(current).getTime() ? next : current;
}

function pickLater(current: string | null, next: string | null): string | null {
  if (!current) return next;
  if (!next) return current;
  return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}

export function buildEvidenceSummary(candidate: Pick<StoredGmailCandidate, "sentCount" | "receivedCount" | "query" | "lastContact" | "threadIds">): string {
  const parts = [
    `Sent ${candidate.sentCount} messages; received ${candidate.receivedCount} replies`,
    `Matched '${candidate.query}' in ${candidate.threadIds.length} thread${candidate.threadIds.length === 1 ? "" : "s"}`,
  ];
  if (candidate.lastContact) {
    const date = new Date(candidate.lastContact);
    parts.push(`Most recent correspondence: ${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
  }
  return parts.join(". ");
}
