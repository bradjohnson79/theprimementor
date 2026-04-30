import { useAuth } from "@clerk/react";
import { SEO_PAGES, type SeoPageKey } from "@wisdom/utils";
import { useEffect, useMemo, useState } from "react";
import SeoAuditResults from "../components/seo/SeoAuditResults";
import SeoHealthHeader from "../components/seo/SeoHealthHeader";
import SeoManualEditor, { type SeoFormState } from "../components/seo/SeoManualEditor";
import SeoReportsList from "../components/seo/SeoReportsList";
import SeoReviewQueue from "../components/seo/SeoReviewQueue";
import type {
  SeoAudit,
  SeoAuditItem,
  SeoPageDefinition,
  SeoRecommendation,
  SeoRecord,
  SeoReport,
} from "../components/seo/types";
import { classNames } from "../components/seo/utils";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { api } from "../lib/api";

interface SeoDashboardResponse {
  pages: SeoPageDefinition[];
  settings: SeoRecord[];
  audit: SeoAudit | null;
}

function toKeywordLines(value: string[]) {
  return value.join(", ");
}

function parseKeywords(value: string) {
  return Array.from(new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  ));
}

function buildFormState(record: SeoRecord | null | undefined): SeoFormState {
  return {
    title: record?.title ?? "",
    metaDescription: record?.metaDescription ?? "",
    primaryKeywords: toKeywordLines(record?.keywords.primary ?? []),
    secondaryKeywords: toKeywordLines(record?.keywords.secondary ?? []),
    ogImage: record?.ogImage ?? "",
    robotsIndex: record?.robotsIndex ?? true,
  };
}

export default function Seo() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";

  const [dashboard, setDashboard] = useState<SeoDashboardResponse | null>(null);
  const [audits, setAudits] = useState<SeoAudit[]>([]);
  const [auditItems, setAuditItems] = useState<SeoAuditItem[]>([]);
  const [recommendations, setRecommendations] = useState<SeoRecommendation[]>([]);
  const [reports, setReports] = useState<SeoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<SeoPageKey>(SEO_PAGES.home);
  const [form, setForm] = useState<SeoFormState>(buildFormState(null));
  const [savingKey, setSavingKey] = useState<SeoPageKey | null>(null);
  const [actingRecommendationId, setActingRecommendationId] = useState<string | null>(null);
  const [auditMode, setAuditMode] = useState<"quick" | "full">("full");
  const [runningAudit, setRunningAudit] = useState(false);

  const latestAudit = audits[0] ?? dashboard?.audit ?? null;

  const settingsByPage = useMemo(() => {
    const next = new Map<SeoPageKey, SeoRecord>();
    for (const item of dashboard?.settings ?? []) {
      next.set(item.pageKey, item);
    }
    return next;
  }, [dashboard]);

  const activeRecord = settingsByPage.get(activePage) ?? null;

  useEffect(() => {
    setForm(buildFormState(activeRecord));
  }, [activeRecord, activePage]);

  async function loadAll(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const token = await getToken();
      const [dashboardResponse, auditsResponse, reportsResponse] = await Promise.all([
        api.get("/admin/seo", token) as Promise<{ data: SeoDashboardResponse }>,
        api.get("/admin/seo/audits", token) as Promise<{ data: { audits: SeoAudit[] } }>,
        api.get("/admin/seo/reports", token) as Promise<{ data: { reports: SeoReport[] } }>,
      ]);

      const nextAudits = auditsResponse.data.audits;
      const nextLatestAudit = nextAudits[0] ?? dashboardResponse.data.audit ?? null;
      const [itemsResponse, recommendationsResponse] = await Promise.all([
        nextLatestAudit
          ? api.get(`/admin/seo/audits/${nextLatestAudit.id}/items`, token) as Promise<{ data: { items: SeoAuditItem[] } }>
          : Promise.resolve({ data: { items: [] } }),
        api.get(
          nextLatestAudit ? `/admin/seo/recommendations?auditId=${encodeURIComponent(nextLatestAudit.id)}` : "/admin/seo/recommendations",
          token,
        ) as Promise<{ data: { recommendations: SeoRecommendation[] } }>,
      ]);

      setDashboard(dashboardResponse.data);
      setAudits(nextAudits);
      setAuditItems(itemsResponse.data.items);
      setRecommendations(recommendationsResponse.data.recommendations);
      setReports(reportsResponse.data.reports);
      setRunningAudit(Boolean(nextLatestAudit && ["pending", "running"].includes(nextLatestAudit.status)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load SEO dashboard.");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!latestAudit || !["pending", "running"].includes(latestAudit.status)) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void loadAll({ silent: true });
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [latestAudit?.id, latestAudit?.status]);

  async function savePage(pageKey: SeoPageKey) {
    setSavingKey(pageKey);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      const payload = {
        pageKey,
        title: form.title,
        metaDescription: form.metaDescription,
        keywords: {
          primary: parseKeywords(form.primaryKeywords),
          secondary: parseKeywords(form.secondaryKeywords),
        },
        ogImage: form.ogImage,
        robotsIndex: form.robotsIndex,
      };
      const existing = settingsByPage.get(pageKey);
      if (existing) {
        await api.put(`/admin/seo/${pageKey}`, payload, token);
      } else {
        await api.post("/admin/seo", payload, token);
      }
      await loadAll({ silent: true });
      setMessage("Live SEO metadata saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save SEO metadata.");
    } finally {
      setSavingKey(null);
    }
  }

  async function runAudit() {
    setRunningAudit(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      await api.post("/admin/seo/audits", { scope: "all_pages", mode: auditMode }, token);
      await loadAll({ silent: true });
      setMessage("SEO audit started. The dashboard will refresh while it runs.");
    } catch (runError) {
      setRunningAudit(false);
      setError(runError instanceof Error ? runError.message : "Failed to start SEO audit.");
    }
  }

  async function approveRecommendation(recommendation: SeoRecommendation) {
    setActingRecommendationId(recommendation.id);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      await api.post(
        `/admin/seo/recommendations/${recommendation.id}/approve`,
        { expectedVersion: recommendation.version },
        token,
      );
      await loadAll({ silent: true });
      setMessage("Recommendation approved and applied.");
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Failed to approve recommendation.");
    } finally {
      setActingRecommendationId(null);
    }
  }

  async function rejectRecommendation(recommendation: SeoRecommendation) {
    setActingRecommendationId(recommendation.id);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      await api.post(
        `/admin/seo/recommendations/${recommendation.id}/reject`,
        { expectedVersion: recommendation.version },
        token,
      );
      await loadAll({ silent: true });
      setMessage("Recommendation rejected.");
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Failed to reject recommendation.");
    } finally {
      setActingRecommendationId(null);
    }
  }

  async function editRecommendation(recommendation: SeoRecommendation, editedValue: unknown) {
    setActingRecommendationId(recommendation.id);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      await api.post(
        `/admin/seo/recommendations/${recommendation.id}/edit`,
        { expectedVersion: recommendation.version, editedValue },
        token,
      );
      await loadAll({ silent: true });
      setMessage("Edited recommendation applied.");
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Failed to edit recommendation.");
    } finally {
      setActingRecommendationId(null);
    }
  }

  async function downloadReportPdf(report: SeoReport) {
    try {
      const token = await getToken();
      await api.downloadBlob(`/seo/reports/${report.id}/pdf`, token, `prime-mentor-seo-report-${report.id}.pdf`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download report PDF.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">Search Layer</p>
        <h1 className={classNames("mt-2 text-3xl font-semibold tracking-tight", isLightTheme ? "text-slate-900" : "text-white")}>
          AI SEO Dashboard
        </h1>
        <p className={classNames("mt-3 max-w-3xl text-sm leading-6", isLightTheme ? "text-slate-600" : "text-white/65")}>
          Audit the site, review deterministic findings, approve or edit AI proposals, and keep a full historical trail of reports and live SEO changes.
        </p>
      </div>

      {message ? (
        <div className={classNames("rounded-2xl border px-4 py-3 text-sm", isLightTheme ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100")}>
          {message}
        </div>
      ) : null}

      {error ? (
        <div className={classNames("rounded-2xl border px-4 py-3 text-sm", isLightTheme ? "border-rose-200 bg-rose-50 text-rose-700" : "border-rose-400/25 bg-rose-400/10 text-rose-100")}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className={classNames("rounded-3xl border p-6", isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5")}>
          <p className="text-sm opacity-70">Loading SEO dashboard...</p>
        </div>
      ) : (
        <>
          <SeoHealthHeader
            isLightTheme={isLightTheme}
            latestAudit={latestAudit}
            auditMode={auditMode}
            onAuditModeChange={setAuditMode}
            onRunAudit={runAudit}
            running={runningAudit}
          />

          <SeoAuditResults
            isLightTheme={isLightTheme}
            latestAudit={latestAudit}
            items={auditItems}
          />

          <SeoReviewQueue
            isLightTheme={isLightTheme}
            recommendations={recommendations}
            actingRecommendationId={actingRecommendationId}
            onApprove={approveRecommendation}
            onReject={rejectRecommendation}
            onEdit={editRecommendation}
          />

          <SeoReportsList
            isLightTheme={isLightTheme}
            reports={reports}
            onDownloadPdf={downloadReportPdf}
          />

          <SeoManualEditor
            isLightTheme={isLightTheme}
            pages={dashboard?.pages ?? []}
            settingsByPage={settingsByPage}
            activePage={activePage}
            onActivePageChange={setActivePage}
            form={form}
            onFormChange={setForm}
            savingKey={savingKey}
            onSave={savePage}
          />
        </>
      )}
    </div>
  );
}
