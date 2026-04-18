import type { ReportTierId, ReportTierSystemsConfig } from "@wisdom/utils";

export interface ClientInput {
  id: string;
  fullBirthName: string;
  birthDate: string;
  birthTime: string | null;
  birthLocation: string | null;
}

export interface NumerologyResult {
  birthDay: number;
  lifePath: number;
  soulUrge: number;
  destiny: number;
  personality: number;
  pinnacles: [number, number, number, number];
}

export interface VedicPlanetPosition {
  planet: string;
  longitude: number;
  sign: string;
  degree: number;
  minute: number;
  house: number;
  nakshatra: string;
  nakshatraPada: number;
  isRetrograde: boolean;
}

export interface VedicHouse {
  number: number;
  sign: string;
  lord: string;
  cusp: number;
}

export interface VedicAspect {
  from: string;
  to: string;
  type: string;
  strength: number;
}

export interface Dosha {
  name: string;
  present: boolean;
  severity?: "low" | "medium" | "high";
  description?: string;
}

export interface LagnaLord {
  planet: string;
  placement: { sign: string; house: number; degree: number; minute: number };
}

export interface AscendantAspect {
  planet: string;
  fromHouse: number;
  aspectType: string;
}

export interface AscendantStrength {
  score: number;
  factors: string[];
}

export interface VedicAstrologyResult {
  system: "vedic_sidereal";
  ayanamsa: "lahiri";
  ayanamsaValue: number;
  julianDay: number;
  confidence: "full" | "reduced";

  ascendant: {
    longitude: number;
    sign: string;
    degree: number;
    minute: number;
    nakshatra: string;
    nakshatraPada: number;
  } | null;

  lagnaLord: LagnaLord | null;
  houses: VedicHouse[] | null;
  firstHousePlanets: string[];
  ascendantAspects: AscendantAspect[];
  ascendantStrength: AscendantStrength | null;

  planets: VedicPlanetPosition[];
  nodes: { rahu: VedicPlanetPosition; ketu: VedicPlanetPosition };
  nakshatras: Array<{ planet: string; nakshatra: string; pada: number; lord: string }>;
  aspects: VedicAspect[];
  doshas: Dosha[];
  retrogrades: string[];
}

export interface PlanetPosition {
  planet: string;
  longitude: number;
  sign: string;
  degree: number;
  minute: number;
}

export interface AstrologyResult {
  sunSign: PlanetPosition;
  moonSign: PlanetPosition;
  planets: PlanetPosition[];
  julianDay: number;
}

export interface DerivedThemes {
  coreIdentity: string[];
  strengths: string[];
  challenges: string[];
  lifeDirection: string[];
  relationshipPatterns: string[];
  environmentalFactors: string[];
  karmicThemes: string[];
}

export interface BlueprintMeta {
  generatedAt: string;
  systemsIncluded: string[];
  reportTier: ReportTierId;
  systems: ReportTierSystemsConfig;
  version: string;
  /** Local upload filename (basename) for temporary physiognomy image; deleted after interpretation */
  physiognomyImageAssetId?: string;
}

export interface AstronomicalSnapshot {
  julianDay: number;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number;
  birthMinute: number;
  coordinates: {
    tropical: { latitude: number; longitude: number } | null;
    sidereal: { latitude: number; longitude: number; ayanamsa: number } | null;
  };
}

export interface BlueprintCore {
  birthData: {
    id: string | null;
    fullBirthName: string;
    birthDate: string;
    birthTime: string | null;
    birthLocation: string | null;
  };
  astronomicalSnapshot: AstronomicalSnapshot;
}

export interface BlueprintData {
  core: BlueprintCore;
  // Legacy fields preserved for backward compatibility
  client: {
    id: string | null;
    fullBirthName: string;
    birthDate: string;
    birthTime: string | null;
    birthLocation: string | null;
  };
  coordinates: LocationCoordinates | null;
  numerology: NumerologyResult | null;
  astrology: VedicAstrologyResult | null;
  iching?: {
    hexagram: number;
    lines: number[];
    description: string;
  };
  bodymap?: {
    profile: string;
    centers: Record<string, string>;
  };
  /** Explicit `null` when face-reading was not used — avoids a ghost section in downstream UIs */
  physiognomy?: {
    interpretation: string;
    features: Record<string, string>;
    disclaimer: string;
    confidence: "symbolic";
  } | null;
  /** `null` when Chinese BaZi is not part of this report — never omit as `undefined` (persistence validators). */
  chinese?: {
    zodiacAnimal: string;
    element: string;
    yinYang: string;
    pillars: Record<string, { heavenlyStem: string; earthlyBranch: string; element: string; yinYang: string }>;
    compatibility: string[];
    challenges: string[];
  } | null;
  humanDesign?: {
    type: string;
    authority: string;
    profile: string;
    definition: string;
    centers: Record<string, string>;
    channels: string[];
    gates: number[];
    strategy: string;
    notSelf: string;
  } | null;
  kabbalah?: {
    sephirotMapping: Array<{ sephira: { name: string; meaning: string; quality: string }; planet: string; sign: string; influence: string }>;
    planetaryTreeOverlay: string[];
    pathInfluences: string[];
    soulCorrectionThemes: string[];
    dominantSephira: { name: string; meaning: string; quality: string };
  } | null;
  rune?: {
    seed: { birthDate: string; lifePath: number; dominantPlanet: string; nakshatra: string };
    primaryRune: { name: string; meaning: string };
    supportingRunes: Array<{ name: string; meaning: string }>;
    interpretation: string;
  };
  systems: ReportTierSystemsConfig;
  derivedThemes: DerivedThemes;
  meta: BlueprintMeta;
}

export interface InterpretationReport {
  overview: string;
  coreIdentity: string;
  strengths: string;
  challenges: string;
  lifeDirection: string;
  relationships: string;
  closingGuidance: string;
  practices: string;
  forecast: string;
}

export interface InterpretationSectionChunk {
  key: keyof InterpretationReport;
  title: string;
  content: string;
}

export interface ReportClientInfoBlock {
  clientName: string;
  birthDate: string;
  birthDateLabel: string;
  birthTime: string | null;
  birthTimeLabel: string;
  birthLocation: string | null;
  birthLocationLabel: string;
  birthTimezone: string | null;
}

export interface SwissEphemerisPlanetRow {
  body: string;
  longitude: number;
  position: string;
  sign: string;
  house: string;
  notes: string;
}

export interface SwissEphemerisAspectRow {
  aspect: string;
  planets: string;
  orb: string;
  orbDegrees: number;
}

export interface ReportStructuredData {
  reportDateIso: string;
  reportDateLabel: string;
  clientInfo: ReportClientInfoBlock;
  astronomicalCalculations: {
    title: string;
    subtitle: string;
    planets: SwissEphemerisPlanetRow[];
    aspects: SwissEphemerisAspectRow[];
  };
}

export interface StoredGeneratedReport {
  sections: InterpretationReport;
  ordered_sections?: InterpretationSectionChunk[];
  structured_data?: ReportStructuredData | null;
}

export type ReportStatus = "draft" | "interpreting" | "interpreted" | "failed" | "reviewed" | "finalized" | "final";

export type SystemName =
  | "numerology"
  | "astrology"
  | "iching"
  | "bodymap"
  | "physiognomy"
  | "chinese"
  | "humanDesign"
  | "kabbalah"
  | "rune";

export interface GuestInput {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthTime: string | null;
  birthLocation: string | null;
  timezone?: string | null;
  timezoneSource?: "user" | "suggested" | "fallback";
  latitude?: number;
  longitude?: number;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}
