import type { FastifyInstance } from "fastify";
import { desc, eq, sql } from "drizzle-orm";
import { clients, reports, users } from "@wisdom/db";
import {
  getReportTierDefinition,
  systemsConfigFromIncludeSystems,
  type BlueprintSystemName,
  type ReportTierId,
} from "@wisdom/utils";
import {
  assembleBlueprint,
  validateGenerateRequest,
  type BlueprintData,
  type ClientInput,
  type GuestInput,
  type LocationCoordinates,
  type SystemName,
} from "../blueprint/index.js";
import { normalizeBirthTimeToStorage } from "../blueprint/schemas.js";
import {
  bufferToDataUrl,
  mimeTypeForAssetId,
  readPhysiognomyImage,
} from "../physiognomyImageStorage.js";
import { resolveBirthLocationContext } from "./locationResolver.js";

export interface GenerateBlueprintResult {
  reportId: string;
  status: string;
  blueprint: BlueprintData;
}

export interface GenerateBlueprintParams {
  mode: "client" | "guest";
  tier?: ReportTierId;
  clientId?: string;
  email?: string;
  guest?: GuestInput;
  coordinates?: LocationCoordinates;
  includeSystems?: BlueprintSystemName[];
  timezone?: string;
  timezoneSource?: "user" | "suggested" | "fallback";
  imageAssetId?: string;
}

export interface BlueprintRequest {
  clientId: string;
  email?: string;
}

interface BlueprintClientRecord {
  id: string;
  user_id: string;
  email: string;
  full_birth_name: string;
  birth_date: string | null;
  birth_time: string | null;
  birth_location: string | null;
}

interface BlueprintClientResolverDeps {
  findByClientId: (clientId: string) => Promise<BlueprintClientRecord | null>;
  findByEmail: (email: string) => Promise<BlueprintClientRecord | null>;
}

function clarityGlyphCountForTier(tier: string | null | undefined): number {
  if (tier === "initiate") return 2;
  if (tier === "deep_dive") return 1;
  return 0;
}

function assertNoUndefinedDeep(value: unknown, path = "payload"): void {
  if (value === undefined) {
    throw new Error(`Undefined value detected at ${path}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUndefinedDeep(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      assertNoUndefinedDeep(nested, `${path}.${key}`);
    }
  }
}

function extractBirthPlaceLabel(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const candidateKeys = ["formattedAddress", "address", "name", "label", "description"];
  for (const key of candidateKeys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

export function normalizeBlueprintBirthPlace(birthPlace: string | null): string | null {
  if (typeof birthPlace !== "string" || !birthPlace.trim()) {
    return null;
  }
  const trimmed = birthPlace.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return trimmed;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string" && parsed.trim()) {
      return parsed.trim();
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const label = extractBirthPlaceLabel(item);
        if (label) return label;
      }
      return trimmed;
    }
    return extractBirthPlaceLabel(parsed) ?? trimmed;
  } catch {
    return trimmed;
  }
}

export async function resolveBlueprintClient(
  request: BlueprintRequest,
  deps: BlueprintClientResolverDeps,
): Promise<BlueprintClientRecord | null> {
  const clientId = request.clientId.trim();
  const email = request.email?.trim().toLowerCase() || undefined;
  let client: BlueprintClientRecord | null = null;
  if (clientId) {
    client = await deps.findByClientId(clientId);
  }
  if (!client && email) {
    client = await deps.findByEmail(email);
  }
  console.log("BLUEPRINT_CLIENT_DEBUG", {
    receivedClientId: clientId,
    email: email ?? null,
    resolvedClient: client?.id ?? null,
  });
  return client;
}

async function findBlueprintClientById(app: FastifyInstance, clientId: string): Promise<BlueprintClientRecord | null> {
  const [client] = await app.db
    .select({
      id: clients.id,
      user_id: clients.user_id,
      email: users.email,
      full_birth_name: clients.full_birth_name,
      birth_date: clients.birth_date,
      birth_time: clients.birth_time,
      birth_location: clients.birth_location,
    })
    .from(clients)
    .innerJoin(users, eq(clients.user_id, users.id))
    .where(eq(clients.id, clientId))
    .limit(1);
  return client ?? null;
}

async function findBlueprintClientByEmail(app: FastifyInstance, email: string): Promise<BlueprintClientRecord | null> {
  const [client] = await app.db
    .select({
      id: clients.id,
      user_id: clients.user_id,
      email: users.email,
      full_birth_name: clients.full_birth_name,
      birth_date: clients.birth_date,
      birth_time: clients.birth_time,
      birth_location: clients.birth_location,
    })
    .from(clients)
    .innerJoin(users, eq(clients.user_id, users.id))
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .orderBy(desc(clients.created_at))
    .limit(1);
  return client ?? null;
}

async function userExistsByEmail(app: FastifyInstance, email: string): Promise<boolean> {
  const [row] = await app.db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return !!row;
}

export async function generateBlueprintFromRequest(
  app: FastifyInstance,
  body: unknown,
): Promise<GenerateBlueprintResult> {
  const validation = validateGenerateRequest(body);
  if (!validation.valid) {
    const error = new Error(validation.error || "Invalid generate request");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }

  return generateBlueprint(app, {
    mode: validation.mode!,
    tier: validation.tier,
    clientId: validation.clientId,
    email: validation.email,
    guest: validation.guest,
    coordinates: validation.coordinates,
    includeSystems: validation.includeSystems as BlueprintSystemName[] | undefined,
    timezone: validation.timezone,
    timezoneSource: validation.timezoneSource,
    imageAssetId: validation.imageAssetId,
  });
}

export async function generateBlueprint(
  app: FastifyInstance,
  params: GenerateBlueprintParams,
): Promise<GenerateBlueprintResult> {
  const tier = params.tier ?? "intro";
  const tierDefinition = getReportTierDefinition(tier);
  const includeSystems = params.includeSystems?.length
    ? params.includeSystems
    : (tierDefinition.includeSystems as BlueprintSystemName[]);
  const systemsConfig = systemsConfigFromIncludeSystems(includeSystems);

  let input: ClientInput;
  let dbClientId: string | null = null;
  let dbUserId: string | null = null;

  if (params.mode === "client") {
    if (!params.clientId?.trim() && !params.email?.trim()) {
      const error = new Error("Client ID or email is required for blueprint generation");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const client = await resolveBlueprintClient(
      { clientId: params.clientId ?? "", email: params.email },
      {
        findByClientId: (clientId) => findBlueprintClientById(app, clientId),
        findByEmail: (email) => findBlueprintClientByEmail(app, email),
      },
    );

    if (!client) {
      const lookupEmail = params.email?.trim().toLowerCase();
      const userExists = lookupEmail ? await userExistsByEmail(app, lookupEmail) : false;
      const message = userExists
        ? "This client has no birth data on file. Please add their birth information under Clients, or use Guest Mode with their details."
        : "Client not found. Please reselect the client.";
      const error = new Error(message);
      (error as Error & { statusCode?: number }).statusCode = userExists ? 400 : 404;
      throw error;
    }

    if (!client.birth_date) {
      const error = new Error("Client has no birth date on record");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    input = {
      id: client.id,
      fullBirthName: client.full_birth_name,
      birthDate: client.birth_date,
      birthTime: normalizeBirthTimeToStorage(client.birth_time),
      birthLocation: normalizeBlueprintBirthPlace(client.birth_location),
    };
    dbClientId = client.id;
    dbUserId = client.user_id;
  } else {
    const guest = params.guest;
    if (!guest) {
      const error = new Error("Guest data is required");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    input = {
      id: "guest",
      fullBirthName: `${guest.firstName} ${guest.lastName}`,
      birthDate: guest.birthDate,
      birthTime: guest.birthTime,
      birthLocation: guest.birthLocation,
    };
  }

  let resolvedCoordinates = params.coordinates || undefined;
  let resolvedUtcOffsetMinutes: number | undefined;
  const explicitTimezone = params.timezone ?? params.guest?.timezone ?? null;
  const explicitTimezoneSource = params.timezoneSource ?? params.guest?.timezoneSource ?? "user";

  if (includeSystems.includes("astrology")) {
    if (!input.birthTime || !input.birthLocation) {
      const error = new Error("Astrology generation requires birth time and birth location.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    if (!resolvedCoordinates || resolvedUtcOffsetMinutes === undefined) {
      const fallbackResolved = await resolveBirthLocationContext({
        birthLocation: input.birthLocation,
        birthDate: input.birthDate,
        birthTime: input.birthTime,
        timezone: explicitTimezone,
        coordinates: resolvedCoordinates,
      });

      resolvedCoordinates = resolvedCoordinates ?? fallbackResolved.coordinates;
      resolvedUtcOffsetMinutes = resolvedUtcOffsetMinutes ?? fallbackResolved.utcOffsetMinutes;
    }
  }

  let physiognomyImage: { assetId: string; dataUrl: string } | undefined;
  if (params.imageAssetId) {
    const buf = await readPhysiognomyImage(params.imageAssetId);
    if (!buf) {
      const error = new Error("Invalid or missing image upload. Upload again.");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }
    const mime = mimeTypeForAssetId(params.imageAssetId);
    physiognomyImage = {
      assetId: params.imageAssetId,
      dataUrl: bufferToDataUrl(buf, mime),
    };
  }

  const blueprint = await assembleBlueprint(
    input,
    includeSystems as SystemName[],
    tier,
    systemsConfig,
    resolvedCoordinates,
    physiognomyImage,
    resolvedUtcOffsetMinutes,
  );
  assertNoUndefinedDeep(blueprint, "blueprint");

  const [report] = await app.db
    .insert(reports)
    .values({
      client_id: dbClientId,
        user_id: dbUserId,
      status: "draft",
      blueprint_data: blueprint,
      interpretation_tier: tier,
      systems_used: includeSystems,
      birth_place_name: resolvedCoordinates?.formattedAddress ?? input.birthLocation ?? null,
      birth_lat: resolvedCoordinates?.latitude ?? null,
      birth_lng: resolvedCoordinates?.longitude ?? null,
      birth_timezone: explicitTimezone,
      meta: {
        generatedFromMode: params.mode,
        clarityGlyphCount: clarityGlyphCountForTier(tier),
        timezone_source: explicitTimezone ? explicitTimezoneSource : null,
      },
    })
    .returning();

  return {
    reportId: report.id,
    status: report.status,
    blueprint,
  };
}
