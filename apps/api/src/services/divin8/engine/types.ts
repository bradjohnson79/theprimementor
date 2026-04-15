import type { LocationCoordinates, SystemName } from "../../blueprint/types.js";
import type { VedicAstrologyResult } from "../../blueprint/vedicAstrologyService.js";
import type { NormalizedEngineInterpretationContext } from "../normalizeEngineResultForInterpretation.js";
import type { Divin8DeterministicSystem } from "../systemRouting.js";

export type Divin8RouteType = "ASTROLOGY" | "GENERAL";
export type Divin8EngineRunStatus = "SKIPPED" | "SUCCESS" | "FAIL";

export interface Divin8RouteDecision {
  type: Divin8RouteType;
  requiresEngine: boolean;
  strict: boolean;
  confidence: number;
  requestedSystems: SystemName[];
  matchedSignals: string[];
  systemLabel: string;
  engineLabel: string;
}

export interface Divin8CoreSystemProfile {
  fullName: string | null;
  birthDate: string | null;
  birthTime: string | null;
  birthLocation: string | null;
  timezone: string | null;
}

export interface Divin8ResolvedBirthContext {
  coordinates: LocationCoordinates;
  timezone: string | null;
  utcOffsetMinutes: number;
}

export interface ParsedAstrologyChart {
  summary: string;
  keyInsights: string[];
  highlights: {
    ascendantSign: string | null;
    moonSign: string | null;
    sunSign: string | null;
    lagnaLord: string | null;
    firstHousePlanets: string[];
    ascendantStrength: number | null;
    doshas: Array<{ name: string; present: boolean; severity?: string }>;
    confidence: VedicAstrologyResult["confidence"];
    ayanamsa: number;
    chart: VedicAstrologyResult;
  };
}

export interface Divin8CoreSystemInput {
  threadId: string;
  userId: string;
  message: string;
  system: Divin8DeterministicSystem;
  profile: Divin8CoreSystemProfile;
  route: Divin8RouteDecision;
  requestIntent: string;
  focusAreas: string[];
  comparisonRequested: boolean;
  timingPeriod: string | null;
  resolvedBirthContext?: Divin8ResolvedBirthContext | null;
}

export type Divin8CoreSystemSuccess =
  | {
      status: "success";
      route: Divin8RouteDecision;
      engineRun: "SUCCESS";
      data: {
        type: "ENGINE";
        system: Divin8DeterministicSystem;
        interpretation: NormalizedEngineInterpretationContext;
        resolvedBirthContext: Divin8ResolvedBirthContext | null;
      };
    }
  | {
      status: "success";
      route: Divin8RouteDecision;
      engineRun: "SKIPPED";
      data: {
        type: "GENERAL";
        interpretation: null;
      };
    };

export interface Divin8CoreSystemFailure {
  status: "error";
  route: Divin8RouteDecision;
  engineRun: "FAIL";
  errorCode:
    | "MISSING_BIRTH_DATA"
    | "INVALID_BIRTH_DATA"
    | "LOCATION_RESOLUTION_FAILED"
    | "UNSUPPORTED_SYSTEM"
    | "STRICT_ENGINE_FAILED";
  error: string;
  userMessage: string;
}

export type Divin8CoreSystemResult = Divin8CoreSystemSuccess | Divin8CoreSystemFailure;
