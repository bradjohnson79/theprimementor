import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { api } from "../../lib/api";
import { formatAdsNumber, unwrapData, type AdsCampaign, type ReportingEnvelope } from "./adsApi";
import { adsCardClass, adsMutedClass, adsTitleClass } from "./adsTheme";

export default function AdsCampaigns() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [campaigns, setCampaigns] = useState<AdsCampaign[] | null>(null);
  const [message, setMessage] = useState("Connect Google Ads to begin");

  useEffect(() => {
    void getToken()
      .then((token) => api.get("/admin/ads/reporting/campaigns", token))
      .then((response) => {
        const payload = unwrapData<ReportingEnvelope<AdsCampaign[]> | AdsCampaign[]>(response);
        if (payload && "available" in payload) {
          if (!payload.available) {
            setCampaigns([]);
            setMessage(payload.message || "Connect Google Ads to begin");
            return;
          }
          setCampaigns(payload.data ?? []);
          setMessage("");
          return;
        }
        setCampaigns(Array.isArray(payload) ? payload : []);
        setMessage("");
      })
      .catch(() => {
        setCampaigns([]);
        setMessage("Connect Google Ads to begin");
      });
  }, [getToken]);

  return (
    <div data-ads-campaigns className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">Ads</p>
        <h1 className={`mt-2 text-3xl font-semibold ${adsTitleClass(isLightTheme)}`}>Campaigns</h1>
        <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>Last 30 Days · read only</p>
      </div>
      <section className={`${adsCardClass(isLightTheme)} overflow-x-auto`}>
        {campaigns && campaigns.length > 0 ? (
          <table className="min-w-full text-left text-sm">
            <thead className={adsMutedClass(isLightTheme)}>
              <tr>
                <th className="pb-3 pr-4 font-medium">Campaign</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Spend</th>
                <th className="pb-3 pr-4 font-medium">Impressions</th>
                <th className="pb-3 pr-4 font-medium">Clicks</th>
                <th className="pb-3 pr-4 font-medium">CTR</th>
                <th className="pb-3 pr-4 font-medium">Conversions</th>
                <th className="pb-3 font-medium">Cost per Conversion</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className={isLightTheme ? "border-t border-slate-200" : "border-t border-white/10"}>
                  <td className={`py-3 pr-4 ${adsTitleClass(isLightTheme)}`}>{campaign.name}</td>
                  <td className="py-3 pr-4">{campaign.status}</td>
                  <td className="py-3 pr-4">{campaign.type}</td>
                  <td className="py-3 pr-4">{formatAdsNumber(campaign.cost ?? campaign.spend, "money")}</td>
                  <td className="py-3 pr-4">{formatAdsNumber(campaign.impressions)}</td>
                  <td className="py-3 pr-4">{formatAdsNumber(campaign.clicks)}</td>
                  <td className="py-3 pr-4">{formatAdsNumber(campaign.ctr, "percent")}</td>
                  <td className="py-3 pr-4">{formatAdsNumber(campaign.conversions)}</td>
                  <td className="py-3">{formatAdsNumber(campaign.costPerConversion, "money")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={`text-sm ${adsMutedClass(isLightTheme)}`}>{message}</p>
        )}
      </section>
    </div>
  );
}
