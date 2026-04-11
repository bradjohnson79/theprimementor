import { useCallback, useMemo, useState } from "react";
import type { ReportTierDefinition } from "@wisdom/utils";
import { getSuggestedTimezone } from "@wisdom/utils";
import TimezoneSelect from "@wisdom/ui/timezone-select";
import Card from "./Card";
import ImageUpload from "./ImageUpload";
import { useGooglePlaces, type PlaceResult } from "../hooks/useGooglePlaces";

interface GuestData {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthTime: string | null;
  birthLocation: string;
  timezone: string;
  timezoneSource: "user" | "suggested" | "fallback";
  coordinates?: PlaceResult;
  imageAssetId?: string;
}

interface GuestModeFormProps {
  tierDefinition?: ReportTierDefinition;
  onGenerate: (guest: GuestData, systems: string[]) => void;
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

export default function GuestModeForm({ tierDefinition, onGenerate, isGenerating }: GuestModeFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState("");
  const [timezoneSource, setTimezoneSource] = useState<"user" | "suggested" | "fallback">("user");
  const [birthLocation, setBirthLocation] = useState("");
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [selectedSystems, setSelectedSystems] = useState<string[]>(
    tierDefinition ? [...tierDefinition.includeSystems] : ["numerology", "astrology"],
  );
  const isLocked = Boolean(tierDefinition);

  const handlePlaceSelected = useCallback((place: PlaceResult) => {
    setBirthLocation(place.formattedAddress);
  }, []);

  const {
    error: placesError,
    selectedPlace,
    setSelectedPlace,
    suggestions: placeSuggestions,
    isSearching: searchingPlaces,
    isResolving: resolvingPlace,
    selectSuggestion,
  } = useGooglePlaces(
    birthLocation,
    handlePlaceSelected,
  );

  const isPlaceSelected = Boolean(
    selectedPlace
      && selectedPlace.formattedAddress.trim() === birthLocation.trim()
      && Number.isFinite(selectedPlace.latitude)
      && Number.isFinite(selectedPlace.longitude),
  );
  const requiresTimezone = selectedSystems.includes("astrology");
  const suggestedTimezone = useMemo(
    () =>
      getSuggestedTimezone({
        latitude: selectedPlace?.latitude,
        longitude: selectedPlace?.longitude,
        timezone: selectedPlace?.timezone,
      }),
    [selectedPlace?.latitude, selectedPlace?.longitude, selectedPlace?.timezone],
  );

  function toggleSystem(id: string) {
    if (isLocked) return;
    setSelectedSystems((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!firstName || !lastName || !birthDate || selectedSystems.length === 0) {
      return;
    }

    if (selectedSystems.includes("physiognomy") && !imageAssetId) {
      alert("Physiognomy requires an image upload. Please upload and wait for it to finish.");
      return;
    }

    if (!isPlaceSelected || !selectedPlace) {
      alert("Select your birth location from the Google Places suggestions so coordinates are included.");
      return;
    }

    if (requiresTimezone && !selectedTimezone) {
      alert("Select a timezone before generating this blueprint.");
      return;
    }

    const guestData: GuestData = {
      firstName,
      lastName,
      birthDate,
      birthTime: birthTime.trim() || null,
      birthLocation: selectedPlace.formattedAddress,
      timezone: selectedTimezone,
      timezoneSource,
      coordinates: selectedPlace,
      imageAssetId: imageAssetId || undefined,
    };

    onGenerate(guestData, selectedSystems);
  }

  return (
    <Card>
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/50">
        Guest Blueprint
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

        {/* Name Fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs text-white/40">First Name *</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-white/90 outline-none focus:border-accent-cyan/50"
              placeholder="Jane"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-white/40">Last Name *</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-white/90 outline-none focus:border-accent-cyan/50"
              placeholder="Doe"
            />
          </div>
        </div>

        {/* Birth Date & Time */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs text-white/40">Birth Date *</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
              className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-white/90 outline-none focus:border-accent-cyan/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-white/40">Birth Time (optional)</label>
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-white/90 outline-none focus:border-accent-cyan/50"
            />
          </div>
        </div>

        {requiresTimezone && (
          <div>
            <label className="mb-1.5 block text-xs text-white/40">
              Birth Timezone *
            </label>
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
              Select the exact IANA timezone used at birth. Place lookup can suggest one, but it will never be applied automatically.
            </p>
            {suggestedTimezone ? (
              <p className="mt-1 text-xs text-white/45">
                Suggested timezone: <span className="text-white/75">{suggestedTimezone}</span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTimezone(suggestedTimezone);
                    setTimezoneSource("suggested");
                  }}
                  className="text-accent-cyan transition hover:text-accent-cyan/80"
                >
                  Use this
                </button>
              </p>
            ) : null}
          </div>
        )}

        {/* Birth Location */}
        <div>
          <label className="mb-1.5 block text-xs text-white/40">
            Birth location *
            {isPlaceSelected ? (
              <span className="ml-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                Coordinates confirmed: {selectedPlace!.latitude.toFixed(4)}, {selectedPlace!.longitude.toFixed(4)}
              </span>
            ) : null}
          </label>
          <input
            type="text"
            value={birthLocation}
            onChange={(e) => {
              const nextValue = e.target.value;
              setBirthLocation(nextValue);
              if (!nextValue || (selectedPlace && nextValue !== selectedPlace.formattedAddress)) {
                setSelectedPlace(null);
              }
            }}
            className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-white/90 outline-none focus:border-accent-cyan/50"
            placeholder="Start typing city name (e.g., San Francisco)"
            autoComplete="off"
          />
          {placeSuggestions.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-glass-border bg-[#0f1117]">
              {placeSuggestions.map((suggestion) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void selectSuggestion(suggestion)}
                  className="block w-full border-b border-white/5 px-3 py-2.5 text-left text-sm text-white/80 transition last:border-b-0 hover:bg-white/5 hover:text-white"
                >
                  <span className="block font-medium text-white">{suggestion.primaryText}</span>
                  {suggestion.secondaryText ? (
                    <span className="mt-1 block text-xs text-white/45">{suggestion.secondaryText}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          {searchingPlaces && (
            <div className="mt-1 text-xs text-white/40">
              Searching places...
            </div>
          )}
          {resolvingPlace && (
            <div className="mt-1 text-xs text-white/40">
              Loading place details...
            </div>
          )}
          {placesError && (
            <div className="mt-1 text-xs text-yellow-400">
              ⚠️ {placesError}
            </div>
          )}
          {isPlaceSelected ? (
            <p className="mt-1 text-xs text-emerald-200/90">
              Confirmed for Swiss Ephemeris: latitude {selectedPlace!.latitude.toFixed(4)}, longitude {selectedPlace!.longitude.toFixed(4)}.
            </p>
          ) : null}
          <p className="mt-1 text-xs text-white/35">
            Start typing and choose a suggestion — the server loads latitude and longitude from Google Place Details.
          </p>
        </div>

        {!isLocked && (
          <div>
            <label className="mb-1.5 block text-xs text-white/40">Systems *</label>
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
          disabled={
            !firstName
            || !lastName
            || !birthDate
            || selectedSystems.length === 0
            || !isPlaceSelected
            || (requiresTimezone && !selectedTimezone)
            || isGenerating
          }
          className="w-full rounded-lg bg-accent-cyan/20 px-4 py-2.5 text-sm font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? "Generating..." : "Generate Guest Blueprint"}
        </button>
      </form>
    </Card>
  );
}
