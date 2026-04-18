import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import type { RefObject } from "react";
import { motion } from "framer-motion";
import { formatPacificTime } from "@wisdom/utils";
import { api } from "../lib/api";
import { renderReportMarkdownToSafeHtml } from "../lib/reportHtml";
import Card from "./Card";
import type { InterpretSuccessPayload } from "./GenerationTab";

interface ListRow {
  id: string;
  client_id: string | null;
  archived: boolean;
  status: string;
  member_status?: string;
  display_title: string | null;
  interpretation_tier: string | null;
  subject_name: string;
  created_at: string;
  updated_at: string;
  tier_outputs?: Array<{ tier: string; status: string }>;
}

interface TierOutputRow {
  id: string;
  tier: string;
  status: string;
  display_title: string | null;
  full_markdown: string | null;
  created_at: string | null;
  updated_at: string | null;
  error_message: string | null;
}

interface ReportClientInfoBlock {
  clientName: string;
  birthDate: string;
  birthDateLabel: string;
  birthTime: string | null;
  birthTimeLabel: string;
  birthLocation: string | null;
  birthLocationLabel: string;
  birthTimezone: string | null;
}

interface SwissEphemerisPlanetRow {
  body: string;
  position: string;
  sign: string;
  house: string;
  notes: string;
}

interface SwissEphemerisAspectRow {
  aspect: string;
  planets: string;
  orb: string;
  orbDegrees: number;
}

interface ReportStructuredData {
  reportDateIso: string;
  reportDateLabel: string;
  clientInfo: ReportClientInfoBlock;
  astronomicalCalculations: {
    title: string;
    subtitle: string;
    planets: SwissEphemerisPlanetRow[];
    aspects: SwissEphemerisAspectRow[];
  };
}

interface ReportDetail {
  id: string;
  archived: boolean;
  display_title: string | null;
  interpretation_tier: string | null;
  subject_name: string;
  full_markdown: string | null;
  status: string;
  member_status: string | null;
  created_at: string;
  updated_at: string;
  admin_notes: string | null;
  systems_used: string[];
  meta: Record<string, unknown> | null;
  purchase_intake: Record<string, unknown> | null;
  birth_place_name: string | null;
  birth_lat: number | null;
  birth_lng: number | null;
  birth_timezone: string | null;
  structured_data: ReportStructuredData | null;
  tier_outputs: TierOutputRow[];
}

interface ReportsListResponse {
  data: ListRow[];
  nextCursor: string | null;
}

interface ReportsTabProps {
  selectedReportId: string | null;
  onSelectReport: (id: string | null) => void;
  listRefreshKey: number;
  viewerRef: RefObject<HTMLDivElement | null>;
  /** Fresh interpret response for this session — fills header/body until GET /reports/:id returns */
  interpretSeed?: InterpretSuccessPayload | null;
  onInterpretSeedConsumed?: () => void;
  onReportDetailSettled?: () => void;
}

export default function ReportsTab({
  selectedReportId,
  onSelectReport,
  listRefreshKey,
  viewerRef,
  interpretSeed = null,
  onInterpretSeedConsumed,
  onReportDetailSettled,
}: ReportsTabProps) {
  const { getToken } = useAuth();
  const [list, setList] = useState<ListRow[]>([]);
  const [listNextCursor, setListNextCursor] = useState<string | null>(null);
  const [loadingMoreList, setLoadingMoreList] = useState(false);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);
  const [copyState, setCopyState] = useState<"success" | "error" | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterClient, setFilterClient] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editMarkdown, setEditMarkdown] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const interpretSeedRef = useRef(interpretSeed);
  interpretSeedRef.current = interpretSeed;
  const onDetailSettledRef = useRef(onReportDetailSettled);
  onDetailSettledRef.current = onReportDetailSettled;
  const onSeedConsumedRef = useRef(onInterpretSeedConsumed);
  onSeedConsumedRef.current = onInterpretSeedConsumed;

  function toReportDetail(row: {
    id: string;
    display_title: string | null;
    interpretation_tier: string | null;
    subject_name?: string;
    full_markdown: string | null;
    status: string;
    member_status?: string | null;
    created_at: string;
    updated_at: string;
    admin_notes: string | null;
    systems_used?: unknown;
    meta?: unknown;
    purchase_intake?: unknown;
    birth_place_name?: string | null;
    birth_lat?: number | null;
    birth_lng?: number | null;
    birth_timezone?: string | null;
    structured_data?: ReportStructuredData | null;
    tier_outputs?: TierOutputRow[];
  }): ReportDetail {
    return {
      id: row.id,
      archived: (row as { archived?: boolean }).archived ?? false,
      display_title: row.display_title,
      interpretation_tier: row.interpretation_tier,
      subject_name: row.subject_name ?? "Guest",
      full_markdown: row.full_markdown,
      status: row.status,
      member_status: row.member_status ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      admin_notes: row.admin_notes,
      systems_used: Array.isArray(row.systems_used)
        ? row.systems_used.filter((value): value is string => typeof value === "string")
        : [],
      meta:
        row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
          ? (row.meta as Record<string, unknown>)
          : null,
      purchase_intake:
        row.purchase_intake && typeof row.purchase_intake === "object" && !Array.isArray(row.purchase_intake)
          ? (row.purchase_intake as Record<string, unknown>)
          : null,
      birth_place_name: row.birth_place_name ?? null,
      birth_lat: typeof row.birth_lat === "number" ? row.birth_lat : null,
      birth_lng: typeof row.birth_lng === "number" ? row.birth_lng : null,
      birth_timezone: row.birth_timezone ?? null,
      structured_data: row.structured_data ?? null,
      tier_outputs: Array.isArray(row.tier_outputs) ? row.tier_outputs : [],
    };
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingList(true);
      setError(null);
      setListNextCursor(null);
      try {
        const token = await getToken();
        const res = (await api.get(`/reports?limit=50&showArchived=${showArchived ? "true" : "false"}`, token)) as ReportsListResponse;
        if (!cancelled) {
          setList(res.data);
          setListNextCursor(res.nextCursor ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load reports");
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [getToken, listRefreshKey, showArchived]);

  async function loadMoreReports() {
    if (!listNextCursor || loadingMoreList || loadingList) return;
    setLoadingMoreList(true);
    setError(null);
    try {
      const token = await getToken();
      const q = `/reports?limit=50&cursor=${encodeURIComponent(listNextCursor)}&showArchived=${showArchived ? "true" : "false"}`;
      const res = (await api.get(q, token)) as ReportsListResponse;
      setList((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const extra = res.data.filter((r) => !seen.has(r.id));
        return [...prev, ...extra];
      });
      setListNextCursor(res.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more reports");
    } finally {
      setLoadingMoreList(false);
    }
  }

  useEffect(() => {
    if (selectedReportId === null && list.length > 0) {
      onSelectReport(list[0].id);
    }
  }, [list, selectedReportId, onSelectReport]);

  useEffect(() => {
    if (!selectedReportId) {
      setDetail(null);
      onDetailSettledRef.current?.();
      return;
    }
    let cancelled = false;
    async function loadDetail() {
      setLoadingDetail(true);
      try {
        const token = await getToken();
        const suffix = selectedTier ? `?tier=${encodeURIComponent(selectedTier)}` : "";
        const row = await api.get(`/blueprints/reports/${selectedReportId}${suffix}`, token);
        if (!cancelled) {
          setDetail(toReportDetail(row));
          if (interpretSeedRef.current?.reportId === row.id) {
            onSeedConsumedRef.current?.();
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load report");
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
          onDetailSettledRef.current?.();
        }
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [getToken, selectedReportId, selectedTier]);

  useEffect(() => {
    if (!selectedReportId) {
      setSelectedTier(null);
      setIsEditing(false);
    }
  }, [selectedReportId]);

  useEffect(() => {
    if (interpretSeed?.interpretation_tier) {
      setSelectedTier(interpretSeed.interpretation_tier);
    }
  }, [interpretSeed?.interpretation_tier]);

  useEffect(() => {
    setIsEditing(false);
  }, [selectedTier]);

  const displayDetail = useMemo((): ReportDetail | null => {
    if (!selectedReportId) return null;
    if (detail?.id === selectedReportId) return detail;
    const seed =
      interpretSeed?.reportId === selectedReportId && loadingDetail ? interpretSeed : null;
    if (!seed) return detail;
    return {
      id: seed.reportId,
      archived: false,
      display_title: seed.display_title ?? null,
      interpretation_tier: seed.interpretation_tier ?? null,
      subject_name: "…",
      full_markdown: seed.full_markdown ?? null,
      status: "interpreted",
      member_status: null,
      created_at: seed.created_at ?? new Date().toISOString(),
      updated_at: seed.created_at ?? new Date().toISOString(),
      admin_notes: null,
      systems_used: [],
      meta: null,
      purchase_intake: null,
      birth_place_name: null,
      birth_lat: null,
      birth_lng: null,
      birth_timezone: null,
      structured_data: null,
      tier_outputs: seed.interpretation_tier
        ? [
            {
              id: seed.reportId,
              tier: seed.interpretation_tier,
              status: "interpreted",
              display_title: seed.display_title ?? null,
              full_markdown: seed.full_markdown ?? null,
              created_at: seed.created_at ?? new Date().toISOString(),
              updated_at: seed.created_at ?? new Date().toISOString(),
              error_message: null,
            },
          ]
        : [],
    };
  }, [detail, selectedReportId, interpretSeed, loadingDetail]);

  useEffect(() => {
    if (!isEditing) {
      setEditMarkdown(displayDetail?.full_markdown ?? "");
    }
  }, [displayDetail?.id, displayDetail?.full_markdown, isEditing]);

  const articleHtml = useMemo(() => {
    const md = displayDetail?.full_markdown ?? "";
    if (!md.trim()) return "";
    return renderReportMarkdownToSafeHtml(md);
  }, [displayDetail?.full_markdown]);

  const availableTierFilters = useMemo(() => {
    const tiers = new Set<string>();
    for (const row of list) {
      if (row.interpretation_tier) tiers.add(row.interpretation_tier);
      for (const tierOutput of row.tier_outputs ?? []) tiers.add(tierOutput.tier);
    }
    return Array.from(tiers).sort();
  }, [list]);

  const filteredList = useMemo(() => {
    return list.filter((row) => {
      const matchesTier =
        filterTier === "all" ||
        row.interpretation_tier === filterTier ||
        (row.tier_outputs ?? []).some((tierOutput) => tierOutput.tier === filterTier);
      const matchesClient =
        !filterClient.trim() ||
        row.subject_name.toLowerCase().includes(filterClient.trim().toLowerCase()) ||
        (row.display_title ?? "").toLowerCase().includes(filterClient.trim().toLowerCase());
      const matchesDate = !filterDate || row.created_at.slice(0, 10) === filterDate;
      return matchesTier && matchesClient && matchesDate;
    });
  }, [filterClient, filterDate, filterTier, list]);

  const activeTier = selectedTier ?? displayDetail?.interpretation_tier ?? null;
  const isFinalized = displayDetail ? ["final", "finalized"].includes(displayDetail.status) : false;
  const clarityGlyphCount = activeTier === "initiate" ? 2 : activeTier === "deep_dive" ? 1 : 0;

  async function reloadSelectedReport() {
    if (!selectedReportId) return null;
    const token = await getToken();
    const suffix = selectedTier ? `?tier=${encodeURIComponent(selectedTier)}` : "";
    const row = await api.get(`/blueprints/reports/${selectedReportId}${suffix}`, token);
    const nextDetail = toReportDetail(row);
    setDetail(nextDetail);
    setList((prev) =>
      prev.map((item) =>
        item.id === nextDetail.id
          ? {
              ...item,
              display_title: nextDetail.display_title,
              interpretation_tier: nextDetail.interpretation_tier,
              status: nextDetail.status,
              updated_at: nextDetail.updated_at,
              subject_name: nextDetail.subject_name,
              tier_outputs: nextDetail.tier_outputs.map((tierOutput) => ({
                tier: tierOutput.tier,
                status: tierOutput.status,
              })),
            }
          : item,
      ),
    );
    return nextDetail;
  }

  useEffect(() => {
    if (!copyState) return;
    const timeout = window.setTimeout(() => setCopyState(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  async function handleExport(kind: "docx" | "pdf") {
    if (!selectedReportId) return;
    setExporting(kind);
    try {
      const token = await getToken();
      const suffix = selectedTier ? `?tier=${encodeURIComponent(selectedTier)}` : "";
      await api.downloadBlob(`/reports/${selectedReportId}/${kind}${suffix}`, token, `report.${kind}`);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  async function handleCopy() {
    const markdown = displayDetail?.full_markdown ?? "";
    if (!markdown.trim()) return;
    try {
      if (typeof ClipboardItem !== "undefined" && articleHtml) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([articleHtml], { type: "text/html" }),
            "text/plain": new Blob([markdown], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(markdown);
      }
      setCopyState("success");
    } catch (e) {
      console.error(e);
      setCopyState("error");
      setError("Copy failed");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this archived report? This action cannot be undone.")) {
      return;
    }
    try {
      const token = await getToken();
      await api.delete(`/reports/${id}`, token);
      const newList = list.filter((r) => r.id !== id);
      setList(newList);
      if (selectedReportId === id) {
        setSelectedTier(null);
        onSelectReport(newList[0]?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleSaveEdit() {
    if (!displayDetail || isFinalized) return;
    setSavingEdit(true);
    setError(null);
    try {
      const token = await getToken();
      const suffix = activeTier ? `?tier=${encodeURIComponent(activeTier)}` : "";
      const row = await api.patch(
        `/reports/${displayDetail.id}${suffix}`,
        { full_markdown: editMarkdown },
        token,
      );
      const nextDetail = toReportDetail(row);
      setDetail(nextDetail);
      setIsEditing(false);
      setEditMarkdown(nextDetail.full_markdown ?? "");
      setList((prev) =>
        prev.map((item) =>
          item.id === nextDetail.id
            ? {
                ...item,
                status: nextDetail.status,
                display_title: nextDetail.display_title,
                updated_at: nextDetail.updated_at,
              }
            : item,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRegenerate() {
    if (!displayDetail || isFinalized) return;
    setRegenerating(true);
    setError(null);
    try {
      const token = await getToken();
      await api.post(
        `/reports/${displayDetail.id}/regenerate`,
        activeTier ? { tier: activeTier } : {},
        token,
      );
      await reloadSelectedReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleFinalize() {
    if (!displayDetail || isFinalized) return;
    setFinalizing(true);
    setError(null);
    try {
      const token = await getToken();
      await api.post(
        `/reports/${displayDetail.id}/finalize`,
        activeTier ? { tier: activeTier } : {},
        token,
      );
      const nextDetail = await reloadSelectedReport();
      if (nextDetail) {
        setIsEditing(false);
        setEditMarkdown(nextDetail.full_markdown ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Finalize failed");
    } finally {
      setFinalizing(false);
    }
  }

  async function handleMarkMemberComplete() {
    if (!displayDetail || displayDetail.member_status === "fulfilled") return;
    setError(null);
    try {
      const token = await getToken();
      const suffix = activeTier ? `?tier=${encodeURIComponent(activeTier)}` : "";
      const row = await api.patch(
        `/reports/${displayDetail.id}${suffix}`,
        { member_status: "fulfilled" },
        token,
      );
      const nextDetail = toReportDetail(row);
      setDetail(nextDetail);
      setList((prev) =>
        prev.map((item) =>
          item.id === nextDetail.id
            ? {
                ...item,
                status: nextDetail.status,
                member_status: nextDetail.member_status ?? undefined,
                display_title: nextDetail.display_title,
                updated_at: nextDetail.updated_at,
              }
            : item,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark member report complete");
    }
  }

  function formatIntakeValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ");
    if (value && typeof value === "object") return JSON.stringify(value);
    return "—";
  }

  const activeTierOutputs = displayDetail?.tier_outputs ?? [];

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

      <Card>
        <div
          ref={viewerRef}
          tabIndex={-1}
          className="outline-none focus-visible:ring-2 focus-visible:ring-accent-violet/50 rounded-lg"
        >
          <div className="sticky top-4 z-10 mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {displayDetail?.display_title ?? "Select a report"}
              </h3>
              {displayDetail && (
                <p className="mt-1 text-xs text-white/40">
                  {displayDetail.subject_name} · {displayDetail.interpretation_tier ?? "—"} ·{" "}
                  {formatPacificTime(displayDetail.created_at)}
                </p>
              )}
              {displayDetail?.structured_data && (
                <p className="mt-1 text-xs text-white/35">
                  Report Date: {displayDetail.structured_data.reportDateLabel}
                </p>
              )}
              {displayDetail && (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/45">
                  <span className="rounded-full border border-white/10 px-2 py-0.5">
                    Status: {displayDetail.status}
                  </span>
                  {displayDetail.member_status ? (
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      Member: {displayDetail.member_status}
                    </span>
                  ) : null}
                  {!!displayDetail.systems_used.length && (
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      Systems: {displayDetail.systems_used.join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>
            {displayDetail && (
              <div className="flex flex-wrap gap-2">
                {activeTierOutputs.length > 0 && (
                  <div className="mr-2 flex flex-wrap gap-2">
                    {activeTierOutputs.map((tierOutput) => (
                      <button
                        key={tierOutput.tier}
                        type="button"
                        onClick={() => setSelectedTier(tierOutput.tier)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                          (selectedTier ?? displayDetail.interpretation_tier) === tierOutput.tier
                            ? "border-accent-violet/50 bg-accent-violet/15 text-accent-violet"
                            : "border-glass-border bg-glass text-white/65 hover:border-accent-violet/30"
                        }`}
                      >
                        {tierOutput.tier}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  disabled={!!exporting || !articleHtml}
                  onClick={() => void handleCopy()}
                  className="rounded-lg border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-white/80 hover:border-accent-cyan/40 disabled:opacity-40"
                >
                  {copyState === "success" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy"}
                </button>
                <button
                  type="button"
                  disabled={isFinalized || savingEdit}
                  onClick={() => {
                    setIsEditing((prev) => !prev);
                    if (isEditing) setEditMarkdown(displayDetail.full_markdown ?? "");
                  }}
                  className="rounded-lg border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-white/80 hover:border-accent-cyan/40 disabled:opacity-40"
                >
                  {isEditing ? "Preview Mode" : "Edit Mode"}
                </button>
                {isEditing && (
                  <>
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => void handleSaveEdit()}
                      className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-300/50 disabled:opacity-40"
                    >
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => {
                        setIsEditing(false);
                        setEditMarkdown(displayDetail.full_markdown ?? "");
                      }}
                      className="rounded-lg border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-white/70 hover:border-white/20 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={regenerating || isFinalized}
                  onClick={() => void handleRegenerate()}
                  className="rounded-lg border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-white/80 hover:border-accent-cyan/40 disabled:opacity-40"
                >
                  {regenerating ? "Regenerating…" : "Regenerate"}
                </button>
                <button
                  type="button"
                  disabled={finalizing || isFinalized}
                  onClick={() => void handleFinalize()}
                  className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:border-amber-300/50 disabled:opacity-40"
                >
                  {isFinalized ? "Final" : finalizing ? "Finalizing…" : "Finalize"}
                </button>
                <button
                  type="button"
                  disabled={displayDetail.member_status === "fulfilled"}
                  onClick={() => void handleMarkMemberComplete()}
                  className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:border-emerald-300/50 disabled:opacity-40"
                >
                  {displayDetail.member_status === "fulfilled" ? "Member Fulfilled" : "Mark Member Fulfilled"}
                </button>
                <button
                  type="button"
                  disabled={!!exporting || !articleHtml || isEditing}
                  onClick={() => handleExport("docx")}
                  className="rounded-lg border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-white/80 hover:border-accent-cyan/40 disabled:opacity-40"
                >
                  {exporting === "docx" ? "…" : "DOCX"}
                </button>
                <button
                  type="button"
                  disabled={!!exporting || !articleHtml || isEditing}
                  onClick={() => handleExport("pdf")}
                  className="rounded-lg border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-white/80 hover:border-accent-cyan/40 disabled:opacity-40"
                >
                  {exporting === "pdf" ? "…" : "PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(displayDetail.id)}
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:border-red-400/40"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {loadingDetail && !articleHtml && (
            <p className="text-sm text-white/50">Loading report…</p>
          )}
          {displayDetail?.purchase_intake && (
            <div className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
              <h4 className="text-sm font-semibold text-white">Purchase Intake</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {Object.entries(displayDetail.purchase_intake).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-white/40">{key}</p>
                    <p className="mt-1 text-sm text-white/80">{formatIntakeValue(value)}</p>
                  </div>
                ))}
                <div className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-white/40">birthplace coordinates</p>
                  <p className="mt-1 text-sm text-white/80">
                    {displayDetail.birth_place_name ?? "—"}
                    {displayDetail.birth_lat !== null && displayDetail.birth_lng !== null
                      ? ` (${displayDetail.birth_lat}, ${displayDetail.birth_lng})`
                      : ""}
                  </p>
                  {displayDetail.birth_timezone ? (
                    <p className="mt-1 text-xs text-white/45">{displayDetail.birth_timezone}</p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
          {displayDetail?.structured_data && (
            <div className="mb-6 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-white">Report Header</h4>
                    <span className="text-xs text-white/45">
                      Report Date: {displayDetail.structured_data.reportDateLabel}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Client Name", displayDetail.structured_data.clientInfo.clientName],
                      ["Birth Date", displayDetail.structured_data.clientInfo.birthDateLabel],
                      ["Birth Time", displayDetail.structured_data.clientInfo.birthTimeLabel],
                      ["Birth Location", displayDetail.structured_data.clientInfo.birthLocationLabel],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
                        <p className="mt-1 text-sm text-white/85">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <h4 className="text-sm font-semibold text-white">
                    {displayDetail.structured_data.astronomicalCalculations.title}
                  </h4>
                  <p className="mt-1 text-xs text-white/45">
                    {displayDetail.structured_data.astronomicalCalculations.subtitle}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-white/65">
                    Deterministic Swiss Ephemeris data is shown first so the fixed chart mechanics stay visually separate
                    from the interpretive narrative below.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-white/80">
                    <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wide text-white/45">
                      <tr>
                        <th className="px-4 py-3 font-medium">Element</th>
                        <th className="px-4 py-3 font-medium">Position</th>
                        <th className="px-4 py-3 font-medium">Sign</th>
                        <th className="px-4 py-3 font-medium">House</th>
                        <th className="px-4 py-3 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDetail.structured_data.astronomicalCalculations.planets.map((row) => (
                        <tr key={row.body} className="border-t border-white/10">
                          <td className="px-4 py-3 font-medium text-white">{row.body}</td>
                          <td className="px-4 py-3">{row.position}</td>
                          <td className="px-4 py-3">{row.sign}</td>
                          <td className="px-4 py-3">{row.house}</td>
                          <td className="px-4 py-3 text-white/60">{row.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
                <div className="border-b border-white/10 px-4 py-3">
                  <h4 className="text-sm font-semibold text-white">Aspects</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-white/80">
                    <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wide text-white/45">
                      <tr>
                        <th className="px-4 py-3 font-medium">Aspect</th>
                        <th className="px-4 py-3 font-medium">Planets</th>
                        <th className="px-4 py-3 font-medium">Orb</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDetail.structured_data.astronomicalCalculations.aspects.length > 0 ? (
                        displayDetail.structured_data.astronomicalCalculations.aspects.map((row) => (
                          <tr key={`${row.planets}-${row.aspect}`} className="border-t border-white/10">
                            <td className="px-4 py-3 font-medium text-white">{row.aspect}</td>
                            <td className="px-4 py-3">{row.planets}</td>
                            <td className="px-4 py-3">{row.orb}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-t border-white/10">
                          <td className="px-4 py-3 text-white/55" colSpan={3}>
                            No major aspects were available for this report view.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          )}
          {!loadingDetail && !articleHtml && displayDetail && (
            <p className="text-sm text-white/50">
              No written report yet. Run interpretation from the Generation tab.
            </p>
          )}
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editMarkdown}
                onChange={(event) => setEditMarkdown(event.target.value)}
                rows={24}
                className="min-h-[28rem] w-full rounded-lg border border-glass-border bg-slate-950/70 px-4 py-3 text-sm leading-relaxed text-white/85 outline-none focus:border-accent-violet/40"
              />
              {isFinalized && (
                <p className="text-xs text-amber-200">Final reports are locked and cannot be edited.</p>
              )}
            </div>
          ) : articleHtml ? (
            <>
              <div
                className="report-prose text-sm leading-relaxed text-white/85"
                dangerouslySetInnerHTML={{ __html: articleHtml }}
              />
              {clarityGlyphCount > 0 && (
                <div className="mt-8 rounded-lg border border-dashed border-accent-violet/30 bg-accent-violet/5 px-4 py-4">
                  <h4 className="text-sm font-semibold text-accent-violet">Clarity Glyph(s)</h4>
                  <p className="mt-2 text-sm text-white/60">
                    {clarityGlyphCount === 1
                      ? "One glyph placeholder will appear here for Deep Dive reports."
                      : "Two glyph placeholders will appear here for Initiate reports."}
                  </p>
                </div>
              )}
            </>
          ) : null}
          {!loadingDetail && !displayDetail && !loadingList && (
            <p className="text-sm text-white/50">No reports yet. Generate a blueprint first.</p>
          )}
        </div>
      </Card>

      <Card>
        <button
          type="button"
          onClick={() => setArchiveOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left"
        >
          <h3 className="text-sm font-medium uppercase tracking-wider text-white/50">
            Archived Reports
          </h3>
          <span className="text-white/40">{archiveOpen ? "▼" : "▶"}</span>
        </button>
        {archiveOpen && (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-xs text-white/50">
                Tier
                <select
                  value={filterTier}
                  onChange={(event) => setFilterTier(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-white/80 outline-none"
                >
                  <option value="all">All tiers</option>
                  {availableTierFilters.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-white/50">
                Client
                <input
                  value={filterClient}
                  onChange={(event) => setFilterClient(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-white/80 outline-none"
                  placeholder="Filter by client or title"
                />
              </label>
              <label className="text-xs text-white/50">
                Date
                <input
                  type="date"
                  value={filterDate}
                  onChange={(event) => setFilterDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-white/80 outline-none"
                />
              </label>
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-white/65">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Show Archived
            </label>
            <ul className="mt-4 space-y-2">
            {loadingList && <li className="text-sm text-white/40">Loading…</li>}
            {!loadingList &&
              filteredList.map((r) => (
                <li
                  key={r.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                    r.id === selectedReportId
                      ? "border-accent-violet/40 bg-accent-violet/10"
                      : "border-white/5 bg-white/5"
                  } ${r.archived ? "opacity-55" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTier(null);
                      onSelectReport(r.id);
                    }}
                    className="min-w-0 flex-1 text-left text-sm text-white/80 hover:text-accent-cyan"
                  >
                    <span className="font-medium">
                      {r.display_title ?? `Report ${r.id.slice(0, 8)}…`}
                    </span>
                    <span className="mt-0.5 block text-xs text-white/35">
                      {r.subject_name} · {r.member_status ?? r.status} · {r.interpretation_tier ?? r.status} ·{" "}
                      {formatPacificTime(r.created_at)}
                    </span>
                    {r.archived ? (
                      <span className="mt-1 inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                        Archived
                      </span>
                    ) : null}
                    {!!r.tier_outputs?.length && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {r.tier_outputs.map((tierOutput) => (
                          <span
                            key={`${r.id}-${tierOutput.tier}`}
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/45"
                          >
                            {tierOutput.tier}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="shrink-0 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </li>
              ))}
            {!loadingList && filteredList.length === 0 && (
              <li className="text-sm text-white/35">No reports yet.</li>
            )}
            {listNextCursor && !loadingList && (
              <li className="pt-2">
                <button
                  type="button"
                  disabled={loadingMoreList}
                  onClick={() => void loadMoreReports()}
                  className="text-sm text-accent-cyan hover:underline disabled:opacity-50"
                >
                  {loadingMoreList ? "Loading…" : "Load more reports"}
                </button>
              </li>
            )}
            </ul>
          </>
        )}
      </Card>
    </motion.div>
  );
}
