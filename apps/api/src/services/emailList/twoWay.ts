import { emailsMatch } from "./emailNormalize.js";

export interface ThreadMessageMeta {
  from: string[];
  to: string[];
  cc?: string[];
  date?: string | null;
}

export function detectTwoWay(
  messages: ThreadMessageMeta[],
  candidateEmail: string,
  ownerAddresses: string[],
): { sent: number; received: number; twoWay: boolean } {
  let sent = 0;
  let received = 0;

  for (const message of messages) {
    const fromOwner = message.from.some((address) => ownerAddresses.some((owner) => emailsMatch(owner, address)));
    const fromCandidate = message.from.some((address) => emailsMatch(address, candidateEmail));
    const toCandidate = [...message.to, ...(message.cc ?? [])].some((address) => emailsMatch(address, candidateEmail));
    const toOwner = [...message.to, ...(message.cc ?? [])].some((address) => ownerAddresses.some((owner) => emailsMatch(owner, address)));

    if (fromOwner && toCandidate) sent += 1;
    if (fromCandidate && toOwner) received += 1;
  }

  return { sent, received, twoWay: sent > 0 && received > 0 };
}

export function messageDates(messages: ThreadMessageMeta[]): { first: Date | null; last: Date | null } {
  const dates = messages
    .map((message) => (message.date ? new Date(message.date) : null))
    .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
  return { first: dates[0] ?? null, last: dates[dates.length - 1] ?? null };
}
