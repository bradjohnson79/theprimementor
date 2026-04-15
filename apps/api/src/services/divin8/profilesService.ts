import { and, asc, eq, inArray } from "drizzle-orm";
import { profiles, type Database } from "@wisdom/db";
import {
  MAX_DIVIN8_PROFILES_PER_MESSAGE,
  extractDivin8ProfileTags,
  type Divin8ProfileCreateRequest,
  type Divin8ProfileResponse,
} from "@wisdom/utils";
import { normalizeBirthTimeToStorage } from "../blueprint/schemas.js";
import { createHttpError } from "../booking/errors.js";
import { assertValidDateString, assertValidTimeZone } from "../booking/timezoneService.js";
import { normalizeStructuredBirthplace } from "../intake/placeSelection.js";

type ProfileRow = typeof profiles.$inferSelect;

export interface ResolvedDivin8Profile {
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

function titleCaseSegment(segment: string) {
  if (!segment) {
    return "";
  }

  const lower = segment.toLocaleLowerCase();
  return `${lower.charAt(0).toLocaleUpperCase()}${lower.slice(1)}`;
}

export function generateDivin8ProfileTag(fullName: string) {
  const segments = fullName.match(/[\p{L}\p{N}]+/gu) ?? [];
  const normalized = segments.map(titleCaseSegment).join("");
  if (!normalized) {
    throw createHttpError(400, "Full name is required to generate a profile tag.");
  }
  return `@${normalized}`;
}

function normalizeProfileRow(row: ProfileRow): ResolvedDivin8Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    tag: row.tag,
    birthDate: String(row.birth_date),
    birthTime: row.birth_time,
    birthPlace: row.birth_place,
    lat: row.lat,
    lng: row.lng,
    timezone: row.timezone,
    createdAt: row.created_at.toISOString(),
  };
}

function validateProfileCreateInput(input: Divin8ProfileCreateRequest) {
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  if (!fullName) {
    throw createHttpError(400, "Full name is required.");
  }

  const birthDate = assertValidDateString(typeof input.birthDate === "string" ? input.birthDate.trim() : "");
  const birthTime = normalizeBirthTimeToStorage(typeof input.birthTime === "string" ? input.birthTime.trim() : "");
  if (!birthTime) {
    throw createHttpError(400, "Birth time is required.");
  }

  const birthplace = normalizeStructuredBirthplace({
    birthPlaceName: input.birthPlace,
    birthLat: input.lat,
    birthLng: input.lng,
    birthTimezone: input.timezone,
  });

  return {
    fullName,
    tag: generateDivin8ProfileTag(fullName),
    birthDate,
    birthTime,
    birthPlace: birthplace.name,
    lat: birthplace.lat,
    lng: birthplace.lng,
    timezone: assertValidTimeZone(birthplace.timezone ?? input.timezone),
  };
}

export async function listDivin8Profiles(db: Database, userId: string) {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.user_id, userId))
    .orderBy(asc(profiles.created_at));

  return {
    profiles: rows.map(normalizeProfileRow),
  };
}

export async function createDivin8Profile(db: Database, userId: string, input: Divin8ProfileCreateRequest) {
  const validated = validateProfileCreateInput(input);

  try {
    const [created] = await db
      .insert(profiles)
      .values({
        user_id: userId,
        full_name: validated.fullName,
        tag: validated.tag,
        birth_date: validated.birthDate,
        birth_time: validated.birthTime,
        birth_place: validated.birthPlace,
        lat: validated.lat,
        lng: validated.lng,
        timezone: validated.timezone,
      })
      .returning();

    return normalizeProfileRow(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("profiles_user_tag_uidx")) {
      throw createHttpError(409, `A profile with the tag ${validated.tag} already exists.`);
    }
    throw error;
  }
}

export async function deleteDivin8Profile(db: Database, userId: string, profileId: string) {
  const [deleted] = await db
    .delete(profiles)
    .where(and(
      eq(profiles.id, profileId),
      eq(profiles.user_id, userId),
    ))
    .returning({ id: profiles.id });

  if (!deleted) {
    throw createHttpError(404, "Profile not found.");
  }

  return {
    id: deleted.id,
    deleted: true as const,
  };
}

export async function resolveDivin8ProfilesForMessage(db: Database, userId: string, message: string, explicitTags?: string[]) {
  const parsedTags = extractDivin8ProfileTags(message);
  const mergedTags = [...new Set([...(explicitTags ?? []), ...parsedTags])];

  if (mergedTags.length > MAX_DIVIN8_PROFILES_PER_MESSAGE) {
    throw createHttpError(400, `Maximum of ${MAX_DIVIN8_PROFILES_PER_MESSAGE} profiles allowed per reading.`);
  }

  if (mergedTags.length === 0) {
    return {
      tags: [] as string[],
      profiles: [] as ResolvedDivin8Profile[],
    };
  }

  const rows = await db
    .select()
    .from(profiles)
    .where(and(
      eq(profiles.user_id, userId),
      inArray(profiles.tag, mergedTags),
    ));

  const mapped = rows.map(normalizeProfileRow);
  const byTag = new Map(mapped.map((profile) => [profile.tag, profile]));
  const orderedProfiles = mergedTags
    .map((tag) => byTag.get(tag))
    .filter((profile): profile is ResolvedDivin8Profile => Boolean(profile));

  if (orderedProfiles.length !== mergedTags.length) {
    const missing = mergedTags.filter((tag) => !byTag.has(tag));
    throw createHttpError(404, `Unknown profile tag${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }

  return {
    tags: mergedTags,
    profiles: orderedProfiles,
  };
}
