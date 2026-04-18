import { useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import Card from "./Card";
import { api } from "../lib/api";
import { renderReportMarkdownToSafeHtml } from "../lib/reportHtml";

interface InterpretationReport {
  overview: string;
  coreIdentity: string;
  strengths: string;
  challenges: string;
  lifeDirection: string;
  relationships: string;
  closingGuidance: string;
  practices: string;
  forecast: string;
}

interface ReportViewerProps {
  report: InterpretationReport;
  /** When set (e.g. after interpret), render sanitized HTML from stored markdown */
  fullMarkdown?: string | null;
  reportId: string;
  status: string;
  adminNotes: string | null;
  onSaveNotes: (notes: string) => void;
  onUpdateStatus: (status: string) => void;
}

const SECTION_LABELS: { key: keyof InterpretationReport; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "coreIdentity", label: "Core Identity" },
  { key: "strengths", label: "Strengths" },
  { key: "challenges", label: "Challenges" },
  { key: "lifeDirection", label: "Life Direction" },
  { key: "relationships", label: "Relationships" },
  { key: "closingGuidance", label: "Closing Guidance" },
  { key: "practices", label: "Alignment Practices" },
  { key: "forecast", label: "Forecast" },
];

const STATUS_OPTIONS = ["draft", "interpreted", "reviewed", "final", "finalized"];

export default function ReportViewer({
  report,
  fullMarkdown,
  status,
  adminNotes,
  onSaveNotes,
  onUpdateStatus,
  reportId,
}: ReportViewerProps) {
  const { getToken } = useAuth();
  const [notes, setNotes] = useState(adminNotes ?? "");
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);

  const articleHtml = useMemo(() => {
    if (fullMarkdown?.trim()) {
      return renderReportMarkdownToSafeHtml(fullMarkdown);
    }
    return "";
  }, [fullMarkdown]);

  async function handleExport(kind: "docx" | "pdf") {
    setExporting(kind);
    try {
      const token = await getToken();
      await api.downloadBlob(`/reports/${reportId}/${kind}`, token, `report.${kind}`);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium uppercase tracking-wider text-white/50">
            Generated Report
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!!exporting}
              onClick={() => handleExport("docx")}
              className="rounded-lg border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-white/80 hover:border-accent-cyan/40 disabled:opacity-40"
              title="Download DOCX"
            >
              {exporting === "docx" ? "…" : "DOCX"}
            </button>
            <button
              type="button"
              disabled={!!exporting}
              onClick={() => handleExport("pdf")}
              className="rounded-lg border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-white/80 hover:border-accent-cyan/40 disabled:opacity-40"
              title="Download PDF"
            >
              {exporting === "pdf" ? "…" : "PDF"}
            </button>
            <span className="text-xs text-white/30">Status:</span>
            <select
              value={status}
              onChange={(e) => onUpdateStatus(e.target.value)}
              className="rounded border border-glass-border bg-glass px-2 py-1 text-xs text-white/80 outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {articleHtml ? (
          <div
            className="report-prose text-sm leading-relaxed text-white/85"
            dangerouslySetInnerHTML={{ __html: articleHtml }}
          />
        ) : (
          <div className="space-y-6">
            {SECTION_LABELS.map(({ key, label }) => (
              <div key={key}>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-accent-cyan">
                  {label}
                </h4>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{report[key]}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/50">Admin Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-white/80 outline-none focus:border-accent-cyan/50"
          placeholder="Add private notes about this report..."
        />
        <button
          onClick={() => onSaveNotes(notes)}
          className="mt-3 rounded-lg bg-accent-violet/20 px-4 py-2 text-sm font-medium text-accent-violet transition-colors hover:bg-accent-violet/30"
        >
          Save Notes
        </button>
      </Card>
    </div>
  );
}
