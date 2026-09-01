import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdsAgent } from "../../context/AdsAgentProvider";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { api } from "../../lib/api";
import { adsAgentUserError, unwrapData, type AdsAgentHealth, type AdsMemoryRecord, type GoogleAdsStatus } from "./adsApi";
import { adsCardClass, adsMutedClass, adsTitleClass } from "./adsTheme";

function flagLabel(value: boolean) {
  return value ? "Configured" : "Not configured";
}

function connectionLabel(health: AdsAgentHealth | null) {
  if (!health) return "Initializing";
  if (health.status === "connected") return "Connected";
  if (health.status === "not_configured") return "Not configured";
  if (health.status === "auth_error") return "Authentication failed";
  if (health.status === "model_missing") return "Model unavailable";
  return "Unavailable";
}

function googleAdsHeadline(status: GoogleAdsStatus | null) {
  if (status?.mode === "READ_ONLY") return "Connected — Read Only";
  return "Not Connected";
}

export default function AdsSettings() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const agent = useAdsAgent();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GoogleAdsStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memories, setMemories] = useState<AdsMemoryRecord[]>([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);

  const loadStatus = useCallback(async () => {
    const token = await getToken();
    const next = unwrapData<GoogleAdsStatus>(await api.get("/admin/ads/status", token));
    setStatus(next);
  }, [getToken]);

  const loadMemory = useCallback(async (q = "") => {
    try {
      const token = await getToken();
      const next = unwrapData<{ enabled: boolean; count: number; memories: AdsMemoryRecord[] }>(
        await api.get(`/admin/ads/agent/memory${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`, token),
      );
      setMemories(next.memories);
      setMemoryCount(next.count);
    } catch (loadError) {
      setError(adsAgentUserError(loadError));
    }
  }, [getToken]);

  useEffect(() => {
    void loadStatus().catch(() => setStatus(null));
  }, [loadStatus]);

  useEffect(() => {
    void loadMemory("").catch(() => undefined);
  }, [loadMemory]);

  useEffect(() => {
    const ads = searchParams.get("ads");
    if (!ads) return;
    if (ads === "connected") setMessage("Google Ads connected.");
    if (ads === "denied") setError("Google Ads authorization was denied.");
    if (ads === "invalid_state") setError("Google Ads authorization state was invalid or expired.");
    if (ads === "error") setError("Google Ads authorization did not complete.");
    setSearchParams({}, { replace: true });
    void loadStatus();
  }, [loadStatus, searchParams, setSearchParams]);

  async function testConnection() {
    setError(null);
    setMessage(null);
    const health = await agent.refreshHealth(true);
    if (!health) {
      setError("The Ads Agent could not reach OpenRouter.");
      return;
    }
    setMessage(health.message || `Status: ${health.status}`);
  }

  async function validateGoogleAds() {
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      const next = unwrapData<GoogleAdsStatus>(await api.post("/admin/ads/google/validate", {}, token));
      setStatus(next);
      if (next.mode === "READ_ONLY") {
        setMessage("Google Ads API access is validated. Command Center can load live metrics.");
        return;
      }
      setError(next.lastError || "Google Ads API validation did not complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Ads API validation failed.");
      await loadStatus();
    }
  }

  async function connectGoogleAds() {
    setError(null);
    try {
      const token = await getToken();
      const response = unwrapData<{ url: string }>(await api.get("/admin/ads/google/oauth/start", token));
      if (!response.url) {
        setError("Google Ads authorization could not be started.");
        return;
      }
      window.location.assign(response.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Ads authorization could not be started.");
    }
  }

  async function disconnectGoogleAds() {
    if (!window.confirm("Disconnect Google Ads from Prime Mentor Admin? Static account IDs stay configured.")) return;
    setError(null);
    const token = await getToken();
    const response = unwrapData<{ warning?: string }>(await api.post("/admin/ads/google/disconnect", {}, token));
    setMessage(response.warning ?? "Google Ads disconnected.");
    await loadStatus();
  }

  const health: AdsAgentHealth | null = agent.health;
  const connected = status?.mode === "READ_ONLY";
  const authorized = Boolean(status?.authorizationConnected);

  return (
    <div data-ads-settings className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">Ads</p>
        <h1 className={`mt-2 text-3xl font-semibold ${adsTitleClass(isLightTheme)}`}>Settings</h1>
      </div>

      <section className={adsCardClass(isLightTheme)}>
        <h2 className={`text-xl font-semibold ${adsTitleClass(isLightTheme)}`}>Google Ads</h2>
        <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
          Secrets stay on the API. The browser never receives tokens.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className={adsMutedClass(isLightTheme)}>Status</dt>
            <dd className={adsTitleClass(isLightTheme)}>{googleAdsHeadline(status)}</dd>
          </div>
          <div>
            <dt className={adsMutedClass(isLightTheme)}>Advertising Account</dt>
            <dd className={adsTitleClass(isLightTheme)}>{status?.customerIdDisplay || "Not configured"}</dd>
          </div>
          <div>
            <dt className={adsMutedClass(isLightTheme)}>Manager Account</dt>
            <dd className={adsTitleClass(isLightTheme)}>{status?.loginCustomerIdDisplay || "Not configured"}</dd>
          </div>
          <div>
            <dt className={adsMutedClass(isLightTheme)}>Developer Token</dt>
            <dd className={adsTitleClass(isLightTheme)}>{flagLabel(Boolean(status?.hasDeveloperToken))}</dd>
          </div>
          <div>
            <dt className={adsMutedClass(isLightTheme)}>OAuth Client</dt>
            <dd className={adsTitleClass(isLightTheme)}>{flagLabel(Boolean(status?.oauthClientConfigured ?? status?.oauthConfigured))}</dd>
          </div>
          <div>
            <dt className={adsMutedClass(isLightTheme)}>Authorization</dt>
            <dd className={adsTitleClass(isLightTheme)}>{status?.authorizationConnected ? "Connected" : "Not connected"}</dd>
          </div>
          <div>
            <dt className={adsMutedClass(isLightTheme)}>API Access</dt>
            <dd className={adsTitleClass(isLightTheme)}>{status?.apiAccessValidated ? "Validated" : "Not validated"}</dd>
          </div>
          <div>
            <dt className={adsMutedClass(isLightTheme)}>Mode</dt>
            <dd className={adsTitleClass(isLightTheme)}>{status?.mode === "READ_ONLY" ? "READ ONLY" : status?.mode || "DISCONNECTED"}</dd>
          </div>
        </dl>
        {status?.lastError ? <p className="mt-3 text-sm text-rose-400">{status.lastError}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {authorized && !connected ? (
            <button type="button" onClick={() => void validateGoogleAds()} className="rounded-lg border border-accent-cyan/30 px-4 py-2 text-sm text-accent-cyan">
              Validate API access
            </button>
          ) : null}
          <button type="button" onClick={() => void connectGoogleAds()} className="rounded-lg border border-accent-cyan/30 px-4 py-2 text-sm text-accent-cyan">
            {connected ? "Reconnect Google Ads" : "Connect Google Ads"}
          </button>
          {authorized ? (
            <button type="button" onClick={() => void disconnectGoogleAds()} className="rounded-lg border border-white/20 px-4 py-2 text-sm">
              Disconnect
            </button>
          ) : null}
        </div>
      </section>

      <section className={adsCardClass(isLightTheme)}>
        <h2 className={`text-xl font-semibold ${adsTitleClass(isLightTheme)}`}>Ads Agent — OpenRouter</h2>
        <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
          Inference is server-side only. The browser never calls OpenRouter.
        </p>
        <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>{agent.healthLabel}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className={adsMutedClass(isLightTheme)}>Provider</dt>
            <dd className={adsTitleClass(isLightTheme)}>OpenRouter</dd>
          </div>
          <div>
            <dt className={adsMutedClass(isLightTheme)}>Model</dt>
            <dd className={adsTitleClass(isLightTheme)}>GLM 5.3 Flash</dd>
          </div>
          <div>
            <dt className={adsMutedClass(isLightTheme)}>API Key</dt>
            <dd className={adsTitleClass(isLightTheme)}>{flagLabel(Boolean(health?.apiKeyConfigured))}</dd>
          </div>
          <div>
            <dt className={adsMutedClass(isLightTheme)}>Connection</dt>
            <dd className={adsTitleClass(isLightTheme)}>{connectionLabel(health)}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <button type="button" onClick={() => void testConnection()} className="rounded-lg border border-accent-cyan/30 px-4 py-2 text-sm text-accent-cyan">
            Test Connection
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-accent-cyan">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      </section>

      <section data-ads-memory className={adsCardClass(isLightTheme)}>
        <h2 className={`text-xl font-semibold ${adsTitleClass(isLightTheme)}`}>Ads Agent Memory</h2>
        <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
          Persistent Prime Mentor Ads memory survives new conversations. Chat transcripts stay conversation-local.
        </p>
        <p className={`mt-3 text-sm ${adsTitleClass(isLightTheme)}`}>Memory status: On · {memoryCount} stored facts</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setMemoryOpen((open) => !open);
              if (!memoryOpen) void loadMemory();
            }}
            className="rounded-lg border border-accent-cyan/30 px-4 py-2 text-sm text-accent-cyan"
          >
            View Ads Memory
          </button>
          <button
            type="button"
            onClick={() => void agent.clearConversation()}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm"
          >
            Clear current conversation
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Clear Ads workspace memory? Owner decisions stay unless you delete them individually.")) return;
              const token = await getToken();
              await api.post("/admin/ads/agent/memory/clear-workspace", {}, token);
              await loadMemory("");
            }}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm"
          >
            Clear workspace memory
          </button>
        </div>
        {memoryOpen ? (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <input
                value={memoryQuery}
                onChange={(event) => setMemoryQuery(event.target.value)}
                placeholder="Search memory"
                className={`w-full rounded-lg border px-3 py-2 text-sm ${
                  isLightTheme ? "border-slate-200 bg-white text-slate-900" : "border-white/10 bg-white/5 text-white"
                }`}
              />
              <button type="button" onClick={() => void loadMemory(memoryQuery)} className="rounded-lg border border-accent-cyan/30 px-3 py-2 text-sm text-accent-cyan">
                Search
              </button>
            </div>
            {selectedMemoryIds.length ? (
              <button
                type="button"
                onClick={async () => {
                  const token = await getToken();
                  await Promise.all(selectedMemoryIds.map((id) => api.delete(`/admin/ads/agent/memory/${id}`, token)));
                  setSelectedMemoryIds([]);
                  await loadMemory();
                }}
                className="rounded-lg border border-rose-400/40 px-3 py-1.5 text-sm text-rose-300"
              >
                Delete selected memory
              </button>
            ) : null}
            <ul className="space-y-2">
              {memories.length === 0 ? (
                <li className={adsMutedClass(isLightTheme)}>No Ads memory stored yet.</li>
              ) : memories.map((item) => (
                <li key={item.id} className={`rounded-xl border px-3 py-2 text-sm ${isLightTheme ? "border-slate-200" : "border-white/10"}`}>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedMemoryIds.includes(item.id)}
                      onChange={(event) => {
                        setSelectedMemoryIds((current) => (
                          event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)
                        ));
                      }}
                    />
                    <span>
                      <span className="uppercase tracking-wide text-[11px] text-accent-cyan">{item.layer}{item.category ? ` / ${item.category}` : ""}</span>
                      <span className={`mt-1 block ${adsTitleClass(isLightTheme)}`}>{item.content}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
