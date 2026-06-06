export const MAX_DIVIN8_PROFILES_PER_MESSAGE = 2;

export interface Divin8ProfileResponse {
  id: string;
  fullName: string;
  tag: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  lat: number;
  lng: number;
  timezone: string;
  createdAt: string;
}

export interface Divin8ProfilesResponse {
  profiles: Divin8ProfileResponse[];
}

export interface Divin8ProfileCreateRequest {
  fullName: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  lat: number;
  lng: number;
  timezone: string;
}

const PROFILE_TAG_REGEX = /\B@[A-Za-z0-9]+\b/g;
const PROFILE_TAG_VALUE_REGEX = /^@[A-Za-z0-9]+$/;

export function extractDivin8ProfileTags(message: string) {
  const matches = message.match(PROFILE_TAG_REGEX) ?? [];
  return [...new Set(matches)];
}

// TODO(profile-memory): detect natural-language profile override/clear phrases
// such as "ignore @Name", "just use @Name", "switch to @Name", or "clear profiles".
export function mergeDivin8ActiveProfileTags(
  conversationActiveTags?: string[],
  explicitTags?: string[],
  messageParsedTags?: string[],
) {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const source of [conversationActiveTags, explicitTags, messageParsedTags]) {
    for (const rawTag of source ?? []) {
      const tag = typeof rawTag === "string" ? rawTag.trim() : "";
      if (!PROFILE_TAG_VALUE_REGEX.test(tag) || seen.has(tag)) {
        continue;
      }
      seen.add(tag);
      merged.push(tag);
    }
  }

  return merged;
}
