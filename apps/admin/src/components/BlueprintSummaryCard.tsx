import Card from "./Card";
import { formatPacificTime, getReportTierDefinition, isReportTierId, type ReportTierId } from "@wisdom/utils";

// ─── Types (matching v2 blueprint shape) ─────────────────────────────────────

interface NumerologyData {
  birthDay: number;
  lifePath: number;
  soulUrge: number;
  destiny: number;
  personality: number;
  pinnacles: number[];
  maturityNumber?: number;
  challenges?: number[];
  planetaryCorrelation?: { dominantPlanet: string; supportingPlanets: string[] };
  energyCenters?: Record<string, string>;
}

interface VedicPlanet {
  planet: string;
  sign: string;
  degree: number;
  minute: number;
  house: number;
  nakshatra: string;
  nakshatraPada: number;
  isRetrograde: boolean;
}

interface VedicAscendant {
  sign: string;
  degree: number;
  minute: number;
  nakshatra: string;
  nakshatraPada: number;
}

interface LagnaLord {
  planet: string;
  placement: { sign: string; house: number; degree: number; minute: number };
}

interface AscendantAspect {
  planet: string;
  fromHouse: number;
  aspectType: string;
}

interface AscendantStrength {
  score: number;
  factors: string[];
}

interface VedicAstrologyData {
  system: string;
  ayanamsa: string;
  ayanamsaValue: number;
  confidence: "full" | "reduced";
  ascendant: VedicAscendant | null;
  lagnaLord: LagnaLord | null;
  houses: Array<{ number: number; sign: string; lord: string }> | null;
  firstHousePlanets: string[];
  ascendantAspects: AscendantAspect[];
  ascendantStrength: AscendantStrength | null;
  planets: VedicPlanet[];
  nodes: { rahu: VedicPlanet; ketu: VedicPlanet };
  retrogrades: string[];
  doshas: Array<{ name: string; present: boolean; severity?: string; description?: string }>;
}

interface ChineseData {
  zodiacAnimal: string;
  element: string;
  yinYang: string;
  pillars: Record<string, { heavenlyStem: string; earthlyBranch: string; element: string; yinYang: string }>;
  compatibility: string[];
  challenges: string[];
}

interface HumanDesignData {
  type: string;
  authority: string;
  profile: string;
  definition: string;
  strategy: string;
  notSelf: string;
  channels: string[];
  gates: number[];
  centers: Record<string, string>;
}

interface KabbalahData {
  dominantSephira: { name: string; meaning: string; quality: string };
  soulCorrectionThemes: string[];
}

interface RuneData {
  primaryRune: { name: string; meaning: string };
  supportingRunes: Array<{ name: string; meaning: string }>;
  interpretation: string;
}

interface BlueprintData {
  client?: {
    fullBirthName: string;
    birthDate: string;
    birthTime?: string | null;
    birthLocation?: string | null;
  };
  core?: {
    birthData: {
      fullBirthName: string;
      birthDate: string;
      birthTime?: string | null;
      birthLocation?: string | null;
    };
  };
  numerology: NumerologyData | null;
  astrology: VedicAstrologyData | null;
  chinese?: ChineseData | null;
  humanDesign?: HumanDesignData | null;
  kabbalah?: KabbalahData | null;
  rune?: RuneData;
  meta: { generatedAt: string; systemsIncluded: string[]; reportTier?: ReportTierId };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ label, color = "text-accent-cyan" }: { label: string; color?: string }) {
  return (
    <h4 className={`mb-3 text-xs font-medium uppercase tracking-wider ${color}`}>
      {label}
    </h4>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg bg-glass p-3 text-center">
      <p className="text-2xl font-bold text-white leading-tight">{value}</p>
      {sub && <p className="text-xs font-medium text-white/60 leading-tight">{sub}</p>}
      <p className="mt-1 text-xs text-white/40">{label}</p>
    </div>
  );
}

function InfoBox({ label, value, sub, badge }: { label: string; value: string; sub?: string; badge?: string }) {
  return (
    <div className="rounded-lg bg-glass p-3">
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs text-white/40 leading-tight">{label}</p>
        {badge && (
          <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-accent-cyan/15 text-accent-cyan shrink-0">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm font-medium text-white leading-snug">{value}</p>
      {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Numerology ───────────────────────────────────────────────────────────────

function NumerologySummary({ data }: { data: NumerologyData }) {
  const core = [
    { label: "Life Path", value: data.lifePath },
    { label: "Birthday", value: data.birthDay },
    { label: "Soul Urge", value: data.soulUrge },
    { label: "Destiny", value: data.destiny },
    { label: "Personality", value: data.personality },
    ...(data.maturityNumber != null ? [{ label: "Maturity", value: data.maturityNumber }] : []),
  ];

  return (
    <div>
      <SectionHeader label="Numerology" color="text-accent-violet" />
      <div className="grid grid-cols-3 gap-3">
        {core.map((e) => <StatBox key={e.label} label={e.label} value={e.value} />)}
        <div className="rounded-lg bg-glass p-3 text-center">
          <p className="text-sm font-bold text-white">{data.pinnacles.join(" · ")}</p>
          <p className="mt-1 text-xs text-white/40">Pinnacles</p>
        </div>
        {data.planetaryCorrelation && (
          <div className="col-span-2 rounded-lg bg-glass p-3">
            <p className="text-xs text-white/40">Dominant Planet</p>
            <p className="text-sm font-medium text-white">
              {data.planetaryCorrelation.dominantPlanet}
              {data.planetaryCorrelation.supportingPlanets?.length > 0 && (
                <span className="text-white/40 text-xs"> · {data.planetaryCorrelation.supportingPlanets.join(", ")}</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Vedic Astrology — Lagna block + planets ──────────────────────────────────

function LagnaSummary({ data }: { data: VedicAstrologyData }) {
  const asc = data.ascendant;

  if (!asc) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/50">
        Ascendant (Lagna) — not available. Provide birth time for full Lagna calculation.
      </div>
    );
  }

  const strengthScore = data.ascendantStrength?.score ?? 0;
  const strengthBar = Array.from({ length: 10 }, (_, i) => i < strengthScore);

  return (
    <div className="space-y-3">
      {/* Ascendant headline */}
      <div className="rounded-xl border border-accent-cyan/25 bg-accent-cyan/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-accent-cyan/70 mb-0.5">Ascendant (Lagna)</p>
            <p className="text-xl font-bold text-white">
              {asc.sign} {asc.degree}°{asc.minute}′
            </p>
            <p className="text-sm text-white/60 mt-0.5">
              {asc.nakshatra} · Pada {asc.nakshatraPada}
            </p>
          </div>

          {data.lagnaLord && (
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-accent-cyan/70 mb-0.5">Lagna Lord</p>
              <p className="text-base font-semibold text-white">{data.lagnaLord.planet}</p>
              <p className="text-xs text-white/50">
                {data.lagnaLord.placement.sign} · House {data.lagnaLord.placement.house}
              </p>
            </div>
          )}
        </div>

        {/* Strength bar */}
        {data.ascendantStrength && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-3">
              <p className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">Lagna Strength</p>
              <div className="flex gap-0.5 flex-1">
                {strengthBar.map((on, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${on ? "bg-accent-cyan" : "bg-white/10"}`}
                  />
                ))}
              </div>
              <p className="text-xs font-medium text-accent-cyan shrink-0">{strengthScore}/10</p>
            </div>
            {data.ascendantStrength.factors.length > 0 && (
              <p className="text-[11px] text-white/40 mt-1.5">{data.ascendantStrength.factors[0]}</p>
            )}
          </div>
        )}
      </div>

      {/* First house planets + aspects row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-glass p-3">
          <p className="text-xs text-white/40 mb-1">Planets in 1st House</p>
          <p className="text-sm font-medium text-white">
            {data.firstHousePlanets?.length > 0 ? data.firstHousePlanets.join(", ") : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-glass p-3">
          <p className="text-xs text-white/40 mb-1">Aspecting Ascendant</p>
          <p className="text-sm font-medium text-white">
            {data.ascendantAspects?.length > 0
              ? data.ascendantAspects.map(a => `${a.planet} (H${a.fromHouse})`).join(", ")
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function AstrologySummary({ data }: { data: VedicAstrologyData }) {
  // data.planets already includes Rahu & Ketu — nodes is just a convenience accessor
  const allPlanets = data.planets ?? [];

  const activeDoshas = data.doshas?.filter(d => d.present) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader label="Vedic Astrology" color="text-accent-cyan" />
        <div className="flex items-center gap-2 -mt-3">
          <span className="text-[10px] text-white/30">Lahiri {data.ayanamsaValue?.toFixed(2)}°</span>
          {data.confidence === "reduced" && (
            <span className="rounded px-1.5 py-0.5 text-[10px] bg-amber-500/15 text-amber-400">No birth time</span>
          )}
        </div>
      </div>

      {/* Lagna block */}
      <div className="mb-4">
        <LagnaSummary data={data} />
      </div>

      {/* Planet grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {allPlanets.map((p, idx) => (
          <InfoBox
            key={`planet-${p.planet}-${idx}`}
            label={p.planet}
            value={`${p.sign} ${p.degree}°${p.minute}′`}
            sub={`H${p.house} · ${p.nakshatra}`}
            badge={p.isRetrograde ? "℞" : undefined}
          />
        ))}
      </div>

      {/* Doshas */}
      {activeDoshas.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Active Doshas</p>
          {activeDoshas.map(d => (
            <p key={d.name} className="text-xs text-white/70">
              <span className="font-medium text-amber-300">{d.name}</span>
              {d.severity && <span className="text-white/40"> · {d.severity}</span>}
              {d.description && d.description !== "Not present" && (
                <span className="text-white/40"> — {d.description}</span>
              )}
            </p>
          ))}
        </div>
      )}

      {/* Retrogrades */}
      {data.retrogrades?.length > 0 && (
        <p className="mt-2 text-xs text-white/30">
          Retrograde: {data.retrogrades.join(", ")}
        </p>
      )}
    </div>
  );
}

// ─── Chinese BaZi ─────────────────────────────────────────────────────────────

function ChineseSummary({ data }: { data: ChineseData }) {
  const pillars = ["year", "month", "day", "hour"] as const;
  return (
    <div>
      <SectionHeader label="Chinese BaZi" color="text-red-400" />
      <div className="grid grid-cols-3 gap-3 mb-3">
        <StatBox label="Zodiac Animal" value={data.zodiacAnimal} />
        <StatBox label="Element" value={data.element} />
        <StatBox label="Polarity" value={data.yinYang} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {pillars.map(p => {
          const pillar = data.pillars?.[p];
          return pillar ? (
            <div key={p} className="rounded-lg bg-glass p-2 text-center">
              <p className="text-[10px] uppercase text-white/30 mb-1">{p}</p>
              <p className="text-xs font-medium text-white">{pillar.heavenlyStem}</p>
              <p className="text-xs text-white/50">{pillar.earthlyBranch}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{pillar.element}</p>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}

// ─── Human Design ─────────────────────────────────────────────────────────────

function HumanDesignSummary({ data }: { data: HumanDesignData }) {
  const definedCenters = Object.entries(data.centers ?? {})
    .filter(([, v]) => v === "defined")
    .map(([k]) => k);
  return (
    <div>
      <SectionHeader label="Human Design" color="text-purple-400" />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <InfoBox label="Type" value={data.type} sub={`Strategy: ${data.strategy}`} />
        <InfoBox label="Authority" value={data.authority} sub={`Not-Self: ${data.notSelf}`} />
        <InfoBox label="Profile" value={data.profile} />
        <InfoBox label="Definition" value={data.definition} />
      </div>
      {definedCenters.length > 0 && (
        <div className="rounded-lg bg-glass p-3">
          <p className="text-xs text-white/40 mb-1">Defined Centers</p>
          <p className="text-sm text-white">{definedCenters.join(" · ")}</p>
        </div>
      )}
      {data.channels?.length > 0 && (
        <div className="mt-2 rounded-lg bg-glass p-3">
          <p className="text-xs text-white/40 mb-1">Active Channels</p>
          <p className="text-sm text-white">{data.channels.join(", ")}</p>
        </div>
      )}
    </div>
  );
}

// ─── Kabbalah ─────────────────────────────────────────────────────────────────

function KabbalahSummary({ data }: { data: KabbalahData }) {
  return (
    <div>
      <SectionHeader label="Kabbalah" color="text-yellow-400" />
      <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
        <p className="text-[10px] uppercase tracking-widest text-yellow-400/70 mb-0.5">Dominant Sephira</p>
        <p className="text-lg font-bold text-white">{data.dominantSephira.name}</p>
        <p className="text-sm text-white/50">{data.dominantSephira.meaning} — {data.dominantSephira.quality}</p>
      </div>
      {data.soulCorrectionThemes?.length > 0 && (
        <div className="mt-2 rounded-lg bg-glass p-3">
          <p className="text-xs text-white/40 mb-1">Soul Correction</p>
          <p className="text-sm text-white/80">{data.soulCorrectionThemes[0]}</p>
        </div>
      )}
    </div>
  );
}

// ─── Rune ─────────────────────────────────────────────────────────────────────

function RuneSummary({ data }: { data: RuneData }) {
  return (
    <div>
      <SectionHeader label="Rune Oracle" color="text-orange-400" />
      <div className="rounded-xl border border-orange-400/20 bg-orange-400/5 p-4 mb-3">
        <p className="text-[10px] uppercase tracking-widest text-orange-400/70 mb-0.5">Primary Rune</p>
        <p className="text-lg font-bold text-white">{data.primaryRune.name}</p>
        <p className="text-sm text-white/50">{data.primaryRune.meaning}</p>
      </div>
      {data.supportingRunes?.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {data.supportingRunes.map(r => (
            <InfoBox key={r.name} label="Supporting Rune" value={r.name} sub={r.meaning} />
          ))}
        </div>
      )}
      {data.interpretation && (
        <div className="rounded-lg bg-glass p-3">
          <p className="text-xs text-white/40 mb-1">Oracle Reading</p>
          <p className="text-xs text-white/70 leading-relaxed line-clamp-4">{data.interpretation}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

function formatBirthTimeDisplay(t: string | null | undefined): string {
  if (!t?.trim()) return "Not provided";
  const s = t.trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return s;
  const h = parseInt(m[1], 10);
  const min = m[2];
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${ap}`;
}

interface BlueprintSummaryCardProps {
  blueprint: BlueprintData;
}

export default function BlueprintSummaryCard({ blueprint }: BlueprintSummaryCardProps) {
  const reportTier: ReportTierId = isReportTierId(blueprint.meta?.reportTier)
    ? blueprint.meta.reportTier
    : "intro";
  const tierSystems = getReportTierDefinition(reportTier).systems;

  const bd = blueprint.core?.birthData ?? blueprint.client;

  const name =
    blueprint.core?.birthData?.fullBirthName ??
    blueprint.client?.fullBirthName ??
    "Unknown";

  const birthDate = bd?.birthDate ?? "";
  const birthTimeRaw = bd?.birthTime ?? null;
  const birthLocation = bd?.birthLocation ?? null;

  const generatedAt = blueprint.meta?.generatedAt
    ? formatPacificTime(blueprint.meta.generatedAt)
    : "";

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wider text-white/50">
          Blueprint Summary
        </h3>
        <span className="text-xs text-white/30">{generatedAt}</span>
      </div>

      <p className="mb-4 text-lg font-semibold text-white">{name}</p>

      <div className="mb-6 grid gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-white/40">Birth date</span>
          <span className="text-white/85 text-right">{birthDate || "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/40">Birth time</span>
          <span className="text-white/85 text-right">{formatBirthTimeDisplay(birthTimeRaw)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/40">Birth location</span>
          <span className="text-white/85 text-right">{birthLocation?.trim() || "—"}</span>
        </div>
      </div>

      <div className="space-y-8">
        {blueprint.numerology && <NumerologySummary data={blueprint.numerology} />}
        {blueprint.astrology && <AstrologySummary data={blueprint.astrology} />}
        {tierSystems.rune && blueprint.rune ? <RuneSummary data={blueprint.rune} /> : null}
        {tierSystems.chinese && blueprint.chinese ? <ChineseSummary data={blueprint.chinese} /> : null}
        {tierSystems.humanDesign && blueprint.humanDesign ? (
          <HumanDesignSummary data={blueprint.humanDesign} />
        ) : null}
        {tierSystems.kabbalah && blueprint.kabbalah ? <KabbalahSummary data={blueprint.kabbalah} /> : null}
      </div>
    </Card>
  );
}
