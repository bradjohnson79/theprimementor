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

export function extractDivin8ProfileTags(message: string) {
  const matches = message.match(PROFILE_TAG_REGEX) ?? [];
  return [...new Set(matches)];
}
