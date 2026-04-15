import { useState } from "react";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import BlueprintGeneratorForm from "./BlueprintGeneratorForm";
import GuestModeForm from "./GuestModeForm";
import BlueprintSummaryCard from "./BlueprintSummaryCard";
import Card from "./Card";

interface Client {
  id: string;
  clientId: string | null;
  full_birth_name: string;
  email: string;
  label: string;
  value: string;
}

interface BlueprintRequest {
  clientId: string;
  email?: string;
}

export interface InterpretSuccessPayload {
  reportId: string;
  display_title?: string;
  interpretation_tier?: string;
  created_at?: string;
  full_markdown?: string;
}

interface GenerationTabProps {
  clients: Client[];
  onInterpretationSuccess?: (payload: InterpretSuccessPayload) => void;
}

interface GuestData {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthTime: string | null;
  birthLocation: string;
  timezone: string;
  timezoneSource: "user" | "suggested" | "fallback";
  coordinates?: {
    formattedAddress: string;
    latitude: number;
    longitude: number;
  };
  imageAssetId?: string;
}

type GenerationMode = "client" | "guest";
const DEFAULT_INTERPRETATION_TIER = "intro";

export default function GenerationTab({ clients, onInterpretationSuccess }: GenerationTabProps) {
  const { getToken } = useAuth();
  const [mode, setMode] = useState<GenerationMode>("client");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [blueprintData, setBlueprintData] = useState<Record<string, unknown> | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progressMessage = isGenerating
    ? "Generating your Soul Blueprint..."
    : isInterpreting
      ? "Interpreting your report and preparing the Reports view..."
      : null;

  async function handleGenerate(
    client: BlueprintRequest,
    systems: string[],
    timezone: string,
    timezoneSource: "user" | "suggested" | "fallback",
    imageAssetId?: string | null,
  ) {
    setError(null);
    setIsGenerating(true);
    setBlueprintData(null);
    setReportId(null);

    try {
      if (!client.clientId) {
        throw new Error("Client ID is required for blueprint generation");
      }
      const token = await getToken();
      const body: Record<string, unknown> = {
        mode: "client",
        tier: DEFAULT_INTERPRETATION_TIER,
        clientId: client.clientId,
        email: client.email,
        includeSystems: systems,
        timezone,
        timezoneSource,
      };
      if (imageAssetId) body.imageAssetId = imageAssetId;

      const result = await api.post("/blueprints/generate", body, token);
      setBlueprintData(result.blueprint);
      setReportId(result.reportId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blueprint generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGuestGenerate(guest: GuestData, systems: string[]) {
    setError(null);
    setIsGenerating(true);
    setBlueprintData(null);
    setReportId(null);

    try {
      const token = await getToken();
      const payload: Record<string, unknown> = {
        mode: "guest",
        tier: DEFAULT_INTERPRETATION_TIER,
        guest: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          birthDate: guest.birthDate,
          birthTime: guest.birthTime?.trim() || null,
          birthLocation: guest.birthLocation || null,
          timezone: guest.timezone,
          timezoneSource: guest.timezoneSource,
        },
        timezone: guest.timezone,
        timezoneSource: guest.timezoneSource,
        includeSystems: systems,
      };

      payload.coordinates = {
        latitude: guest.coordinates!.latitude,
        longitude: guest.coordinates!.longitude,
        formattedAddress: guest.coordinates!.formattedAddress,
      };

      if (guest.imageAssetId) {
        payload.imageAssetId = guest.imageAssetId;
      }

      const result = await api.post("/blueprints/generate", payload, token);
      setBlueprintData(result.blueprint);
      setReportId(result.reportId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blueprint generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleInterpret() {
    if (!blueprintData) {
      setError("No blueprint data found. Generate a blueprint first.");
      return;
    }
    if (!reportId) {
      setError("No report ID found. Generate a blueprint first.");
      return;
    }

    setError(null);
    setIsInterpreting(true);

    try {
      const token = await getToken();

      const result = (await api.post(
        `/blueprints/interpret/${reportId}`,
        { tier: DEFAULT_INTERPRETATION_TIER },
        token,
      )) as {
        reportId: string;
        status: string;
        report: Record<string, unknown>;
        full_markdown?: string;
        display_title?: string;
        interpretation_tier?: string;
        created_at?: string;
      };

      setReportId(result.reportId);
      onInterpretationSuccess?.({
        reportId: result.reportId,
        display_title: result.display_title,
        interpretation_tier: result.interpretation_tier,
        created_at: typeof result.created_at === "string" ? result.created_at : undefined,
        full_markdown: result.full_markdown,
      });
    } catch (err) {
      console.error("[handleInterpret] error:", err);
      setError("Report generation failed. Please try again.");
    } finally {
      setIsInterpreting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {progressMessage && (
        <Card>
          <div className="flex items-center gap-3 text-sm text-white/80">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-accent-violet" />
            {progressMessage}
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setMode("client")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            mode === "client"
              ? "bg-accent-cyan/20 text-accent-cyan"
              : "bg-glass text-white/60 hover:text-white/80"
          }`}
        >
          Client Mode
        </button>
        <button
          onClick={() => setMode("guest")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            mode === "guest"
              ? "bg-accent-cyan/20 text-accent-cyan"
              : "bg-glass text-white/60 hover:text-white/80"
          }`}
        >
          Guest Mode
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {mode === "client" ? (
            <BlueprintGeneratorForm
              clients={clients}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          ) : (
            <GuestModeForm
              onGenerate={handleGuestGenerate}
              isGenerating={isGenerating}
            />
          )}

          {blueprintData && (
            <Card>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80">Blueprint ready for interpretation</p>
                    {(blueprintData as { meta?: { systemsIncluded?: string[] } })?.meta?.systemsIncluded
                      ?.length ? (
                      <p className="text-xs text-white/40 mt-1">
                        Systems:{" "}
                        {(
                          (blueprintData as { meta: { systemsIncluded: string[] } }).meta
                            .systemsIncluded as string[]
                        ).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <button
                    onClick={handleInterpret}
                    disabled={isInterpreting || !blueprintData || !reportId}
                    className="rounded-lg bg-accent-violet/20 px-4 py-2 text-sm font-medium text-accent-violet transition-colors hover:bg-accent-violet/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isInterpreting ? "Interpreting..." : "Run interpretation"}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {blueprintData && (
            <BlueprintSummaryCard
              blueprint={blueprintData as unknown as Parameters<typeof BlueprintSummaryCard>[0]["blueprint"]}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
