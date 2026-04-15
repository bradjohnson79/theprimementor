import { useMemo, useState } from "react";
import type { ReportTierDefinition } from "@wisdom/utils";
import TimezoneSelect from "@wisdom/ui/timezone-select";
import Card from "./Card";
import ImageUpload from "./ImageUpload";

interface Client {
  id: string;
  clientId: string | null;
  full_birth_name: string;
  email: string;
  label: string;
  value: string;
}

interface SelectedBlueprintClient {
  clientId: string;
  email: string;
}

interface BlueprintGeneratorFormProps {
  clients: Client[];
  tierDefinition?: ReportTierDefinition;
  onGenerate: (
    client: SelectedBlueprintClient,
    systems: string[],
    timezone: string,
    timezoneSource: "user" | "suggested" | "fallback",
    imageAssetId?: string | null,
  ) => void;
  isGenerating: boolean;
}

const AVAILABLE_SYSTEMS = [
  { id: "numerology", label: "Numerology", description: "Life path, destiny, soul urge + chakra correlations" },
  { id: "astrology", label: "Vedic Astrology", description: "Sidereal planets, nakshatras, doshas (Lahiri ayanamsa)" },
  { id: "chinese", label: "Chinese BaZi", description: "Four Pillars — zodiac animal, element, Yin/Yang" },
  { id: "humanDesign", label: "Human Design", description: "Type, authority, profile, gates & channels" },
  { id: "kabbalah", label: "Kabbalah", description: "Tree of Life mapping, soul correction themes" },
  { id: "rune", label: "Rune Oracle", description: "Elder Futhark draw seeded from your chart" },
  { id: "iching", label: "I Ching", description: "Hexagram and interpretive layer" },
  { id: "bodymap", label: "Body Map", description: "Numerology energy centers" },
  { id: "physiognomy", label: "Physiognomy", description: "Face reading (requires image)" },
] as const;

export default function BlueprintGeneratorForm({
  clients,
  tierDefinition,
  onGenerate,
  isGenerating,
}: BlueprintGeneratorFormProps) {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState("");
  const [timezoneSource, setTimezoneSource] = useState<"user" | "suggested" | "fallback">("user");
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [selectedSystems, setSelectedSystems] = useState<string[]>(
    tierDefinition ? [...tierDefinition.includeSystems] : ["numerology", "astrology"],
  );
  const isLocked = Boolean(tierDefinition);
  const requiresTimezone = useMemo(() => selectedSystems.includes("astrology"), [selectedSystems]);
  const clientOptions = useMemo(
    () => clients.filter((client) => Boolean(client.value.trim())),
    [clients],
  );

  function toggleSystem(id: string) {
    if (isLocked) return;
    setSelectedSystems((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const selectedClient = clientOptions.find((client) => client.value === selectedClientId);
    if (!selectedClient?.clientId && !selectedClient?.email) {
      alert("A client identifier is required for blueprint generation");
      return;
    }
    if (requiresTimezone && !selectedTimezone) {
      alert("Select a timezone before generating this blueprint.");
      return;
    }
    if (selectedSystems.includes("physiognomy") && !imageAssetId) {
      alert("Physiognomy requires an image upload. Please upload and wait for it to finish.");
      return;
    }
    onGenerate(
      { clientId: selectedClient.clientId ?? "", email: selectedClient.email },
      selectedSystems,
      selectedTimezone,
      timezoneSource,
      imageAssetId,
    );
  }

  return (
    <Card>
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/50">
        Generate Blueprint
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-white">{tierDefinition ? tierDefinition.label : "Mentorship Mode"}</p>
          <p className="mt-1 text-xs text-white/50">
            {tierDefinition
              ? tierDefinition.description
              : "Flexible generation for mentoring sessions. Choose exactly which systems to run."}
          </p>
          <p className="mt-3 text-[11px] uppercase tracking-wider text-white/35">
            {tierDefinition ? "Locked systems" : "Selected systems"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedSystems.map((system) => (
              <span
                key={system}
                className="rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-2.5 py-1 text-xs text-accent-cyan"
              >
                {system}
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-white/40">Client</label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-white/90 outline-none focus:border-accent-cyan/50"
          >
            <option value="">{clientOptions.length > 0 ? "Select a client..." : "No client records available"}</option>
            {clientOptions.map((client) => (
              <option key={client.clientId} value={client.value}>
                {client.label}
              </option>
            ))}
          </select>
        </div>

        {requiresTimezone ? (
          <div>
            <label className="mb-1.5 block text-xs text-white/40">Birth Timezone *</label>
            <TimezoneSelect
              value={selectedTimezone}
              onChange={(value) => {
                setSelectedTimezone(value);
                setTimezoneSource("user");
              }}
              required
              className="w-full rounded-lg border border-glass-border bg-[#0f1117] px-3 py-2 text-sm text-white/90 outline-none focus:border-accent-cyan/50"
            />
            <p className="mt-1 text-xs text-white/30">
              Use the client&apos;s exact IANA birth timezone before running astrology.
            </p>
          </div>
        ) : null}

        {!isLocked && (
          <div>
            <label className="mb-1.5 block text-xs text-white/40">Systems</label>
            <div className="grid gap-2">
              {AVAILABLE_SYSTEMS.map((sys) => (
                <button
                  key={sys.id}
                  type="button"
                  onClick={() => toggleSystem(sys.id)}
                  className={`rounded-lg border px-4 py-2.5 text-left transition-all ${
                    selectedSystems.includes(sys.id)
                      ? "border-accent-cyan/50 bg-accent-cyan/10"
                      : "border-glass-border bg-glass hover:border-accent-cyan/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div
                        className={`text-sm font-medium ${
                          selectedSystems.includes(sys.id) ? "text-accent-cyan" : "text-white/70"
                        }`}
                      >
                        {sys.label}
                      </div>
                      <div className="mt-0.5 text-xs text-white/40">{sys.description}</div>
                    </div>
                    {selectedSystems.includes(sys.id) && <div className="text-lg text-accent-cyan">✓</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSystems.includes("physiognomy") && (
          <ImageUpload onImageAssetId={setImageAssetId} label="Face Photo (for Symbolic Interpretation)" />
        )}

        <button
          type="submit"
          disabled={!selectedClientId || (requiresTimezone && !selectedTimezone) || isGenerating}
          className="w-full rounded-lg bg-accent-cyan/20 px-4 py-2.5 text-sm font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? "Generating..." : "Generate Blueprint"}
        </button>
      </form>
    </Card>
  );
}
