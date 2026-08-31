import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdsAgent } from "../../context/AdsAgentProvider";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { api } from "../../lib/api";
import { unwrapData, type AdsAgentHealth, type GoogleAdsStatus } from "./adsApi";
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

  const loadStatus = useCallback(async () => {
    const token = await getToken();
    const next = unwrapData<GoogleAdsStatus>(await api.get("/admin/ads/status", token));
    setStatus(next);
  }, [getToken]);

  useEffect(() => {
    void loadStatus().catch(() => setStatus(null));
  }, [loadStatus]);

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
    </div>
  );
}
