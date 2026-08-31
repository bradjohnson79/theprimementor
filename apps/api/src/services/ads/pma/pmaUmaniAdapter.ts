import type { Database } from "@wisdom/db";
import {
  getAdminAnalyticsEvents,
  getAdminAnalyticsInsights,
  getAdminAnalyticsSummary,
  type AnalyticsLogger,
} from "../../analyticsService.js";
import { emptyBehavior } from "./pmaEngine.js";
import type { PmaBehaviorInsight } from "./pmaTypes.js";

type AnalyticsActor = { actorRole: string; actorUserId?: string | null };

export async function loadPmaBehaviorSignals(input: {
  db: Database;
  actor: AnalyticsActor;
  logger: AnalyticsLogger;
  range?: "24h" | "7d" | "30d";
}): Promise<PmaBehaviorInsight> {
  const range = input.range ?? "30d";
  try {
    const [summary, events, insights] = await Promise.all([
      getAdminAnalyticsSummary(input.actor, range, input.logger),
      getAdminAnalyticsEvents(input.actor, range, input.logger),
      getAdminAnalyticsInsights(input.db, input.actor, range, input.logger),
    ]);

    const degraded = summary.status !== "ok" || events.status !== "ok" || insights.status !== "ok";
    const pages = [
      ...(insights.entryPages?.items ?? []),
      ...(insights.conversionPaths?.items ?? []).map((row) => ({
        label: row.path,
        visitors: row.visitors,
        pageviews: row.pageviews,
        bounceRate: row.bounceRate,
      })),
    ];
    const reports = pages.find((row) => String(row.label ?? "").startsWith("/reports"));
    const named = (events.items ?? []).map((row: { name?: string; total?: number }) => ({
      name: String(row.name ?? ""),
      total: Number(row.total ?? 0),
    }));
    const ctaClicks = named.find((row) => row.name === "cta_click")?.total ?? 0;
    const purchases = named.find((row) => row.name === "purchase")?.total ?? 0;
    const campaigns = (insights.campaigns?.items ?? []).slice(0, 6).map((row: {
      label?: string;
      utmSource?: string | null;
      utmMedium?: string | null;
      utmCampaign?: string | null;
      visitors?: number;
      bounceRate?: number;
    }) => ({
      label: row.label ?? "Unknown",
      utmSource: row.utmSource ?? null,
      utmMedium: row.utmMedium ?? null,
      utmCampaign: row.utmCampaign ?? null,
      visitors: row.visitors ?? 0,
      bounceRate: row.bounceRate ?? 0,
    }));

    return {
      status: degraded ? "degraded" : "ok",
      range,
      warning: degraded ? "Some Umani sections were unavailable. PMA did not invent the missing metrics." : null,
      landingPage: "/reports",
      sessions: summary.traffic?.sessions ?? null,
      pageviews: summary.traffic?.pageviews ?? null,
      bounceRate: summary.traffic?.sessions
        ? Math.round(((summary.traffic.bounces ?? 0) / summary.traffic.sessions) * 100)
        : null,
      ctaClicks,
      purchases,
      hasUtmData: Boolean(insights.campaigns?.hasUtmData),
      campaigns,
      reportsPath: reports
        ? {
          path: String(reports.label),
          visitors: Number(reports.visitors ?? 0),
          pageviews: Number(reports.pageviews ?? 0),
          bounceRate: Number(reports.bounceRate ?? 0),
        }
        : null,
      note: "Umani shows after-click behavior. CTA clicks and purchases outrank session length. utm_term and utm_content are not available from this integration.",
    };
  } catch {
    return emptyBehavior("Umani is unavailable. PMA continues with keyword theory only.");
  }
}
