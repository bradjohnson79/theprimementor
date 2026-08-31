import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdsAgent } from "../../context/AdsAgentProvider";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { adsCardClass, adsMutedClass, adsTitleClass } from "./adsTheme";
import {
  formatAdsNumber,
  unwrapData,
  type AdsAccountSummary,
  type GoogleAdsStatus,
  type ReportingEnvelope,
} from "./adsApi";
import { api } from "../../lib/api";

const PLACEHOLDER_METRICS = [
  { key: "spend", label: "Spend", kind: "money" as const },
  { key: "impressions", label: "Impressions", kind: "count" as const },
  { key: "clicks", label: "Clicks", kind: "count" as const },
  { key: "ctr", label: "CTR", kind: "percent" as const },
  { key: "averageCpc", label: "Average CPC", kind: "money" as const },
  { key: "conversions", label: "Conversions", kind: "count" as const },
  { key: "conversionRate", label: "Conversion Rate", kind: "percent" as const },
  { key: "costPerConversion", label: "Cost per Conversion", kind: "money" as const },
];

export default function AdsCommandCenter() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const agent = useAdsAgent();
  const [status, setStatus] = useState<GoogleAdsStatus | null>(null);
  const [summary, setSummary] = useState<AdsAccountSummary | null>(null);

  useEffect(() => {
    void getToken()
      .then((token) => api.get("/admin/ads/status", token))
      .then((response) => setStatus(unwrapData<GoogleAdsStatus>(response)))
      .catch(() => setStatus(null));
  }, [getToken]);

  useEffect(() => {
    if (status?.mode !== "READ_ONLY") {
      setSummary(null);
      return;
    }
    void getToken()
      .then((token) => api.get("/admin/ads/reporting/summary", token))
      .then((response) => {
        const payload = unwrapData<ReportingEnvelope<AdsAccountSummary> | AdsAccountSummary>(response);
        if (payload && "available" in payload) {
          setSummary(payload.available ? payload.data ?? null : null);
          return;
        }
        setSummary(payload);
      })
      .catch(() => setSummary(null));
  }, [getToken, status?.mode]);

  const connected = status?.mode === "READ_ONLY";
  const showRevenue = Boolean(summary?.conversionValue != null && summary.conversionValue > 0);

  return (
    <div data-ads-command-center className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">Ads</p>
        <h1 className={`mt-2 text-3xl font-semibold ${adsTitleClass(isLightTheme)}`}>Command Center</h1>
        <p className={`mt-2 max-w-2xl text-sm ${adsMutedClass(isLightTheme)}`}>
          {connected
            ? `${summary?.dateRange.label || "Last 30 Days"} for the connected Prime Mentor advertising account.`
            : "Advertising intelligence for Divin8 Reports. Google Ads data will appear here after the account is connected."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={adsCardClass(isLightTheme)}>
          <p className="text-xs uppercase tracking-[0.24em] text-accent-cyan">Google Ads</p>
          <h2 className={`mt-2 text-xl font-semibold ${adsTitleClass(isLightTheme)}`}>
            {connected ? "Connected — Read Only" : "Not Connected"}
          </h2>
          <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
            {connected
              ? `${status?.customerIdDisplay || "Advertising account"} via ${status?.loginCustomerIdDisplay || "manager account"}.`
              : status?.lastError || "Google Ads has not been connected yet."}
          </p>
          <Link
            to="/admin/ads/settings"
            className="mt-4 inline-flex rounded-lg bg-accent-cyan/20 px-4 py-2 text-sm font-medium text-accent-cyan"
          >
            {connected ? "Ads Settings" : "Configure Google Ads"}
          </Link>
        </section>

        <section className={adsCardClass(isLightTheme)}>
          <p className="text-xs uppercase tracking-[0.24em] text-accent-cyan">Ads Agent</p>
          <h2 className={`mt-2 text-xl font-semibold ${adsTitleClass(isLightTheme)}`}>{agent.healthLabel}</h2>
          <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
            GLM 5.3 Flash via OpenRouter. {connected ? "Live read-only Ads tools are available." : "Google Ads stays disconnected."}
          </p>
        </section>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLACEHOLDER_METRICS.map((metric) => (
          <div key={metric.key} className={adsCardClass(isLightTheme)}>
            <p className={`text-xs uppercase tracking-[0.18em] ${adsMutedClass(isLightTheme)}`}>{metric.label}</p>
            <p className={`mt-3 text-lg font-semibold ${adsTitleClass(isLightTheme)}`}>
              {connected
                ? formatAdsNumber(summary?.[metric.key as keyof AdsAccountSummary] as number | null, metric.kind)
                : "Connect Google Ads to begin"}
            </p>
          </div>
        ))}
        {showRevenue ? (
          <>
            <div className={adsCardClass(isLightTheme)}>
              <p className={`text-xs uppercase tracking-[0.18em] ${adsMutedClass(isLightTheme)}`}>Conversion Value</p>
              <p className={`mt-3 text-lg font-semibold ${adsTitleClass(isLightTheme)}`}>{formatAdsNumber(summary?.conversionValue, "money")}</p>
            </div>
            <div className={adsCardClass(isLightTheme)}>
              <p className={`text-xs uppercase tracking-[0.18em] ${adsMutedClass(isLightTheme)}`}>ROAS</p>
              <p className={`mt-3 text-lg font-semibold ${adsTitleClass(isLightTheme)}`}>{formatAdsNumber(summary?.roas, "count")}</p>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
