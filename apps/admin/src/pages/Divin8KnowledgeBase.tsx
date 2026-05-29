import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type {
  Divin8KnowledgePreviewResponse,
  Divin8KnowledgeRetrievalDebugResponse,
  Divin8KnowledgeSourceDetailResponse,
  Divin8KnowledgeSourceSummary,
} from "@wisdom/utils";
import KnowledgeConceptEditor from "../components/divin8-knowledge/KnowledgeConceptEditor";
import KnowledgeOverrideEditor from "../components/divin8-knowledge/KnowledgeOverrideEditor";
import KnowledgeRetrievalTester from "../components/divin8-knowledge/KnowledgeRetrievalTester";
import KnowledgeSourceDrawer from "../components/divin8-knowledge/KnowledgeSourceDrawer";
import KnowledgeSourceTable from "../components/divin8-knowledge/KnowledgeSourceTable";
import KnowledgeUploadPanel from "../components/divin8-knowledge/KnowledgeUploadPanel";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { api } from "../lib/api";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function uploadForm(input: { file: File; name: string; category: string; authorityLevel: string }) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("name", input.name);
  form.append("category", input.category);
  form.append("authorityLevel", input.authorityLevel);
  return form;
}

export default function Divin8KnowledgeBase() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [sources, setSources] = useState<Divin8KnowledgeSourceSummary[]>([]);
  const [detail, setDetail] = useState<Divin8KnowledgeSourceDetailResponse | null>(null);
  const [replacementTarget, setReplacementTarget] = useState<Divin8KnowledgeSourceSummary | null>(null);
  const [preview, setPreview] = useState<Divin8KnowledgePreviewResponse | null>(null);
  const [retrievalResult, setRetrievalResult] = useState<Divin8KnowledgeRetrievalDebugResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshSources = useCallback(async () => {
    const token = await getToken();
    const response = (await api.get("/divin8/knowledge/sources", token)) as { sources: Divin8KnowledgeSourceSummary[] };
    setSources(response.sources);
  }, [getToken]);

  useEffect(() => {
    void refreshSources().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load knowledge sources."));
  }, [refreshSources]);

  async function runBusy(action: () => Promise<void>, success?: string) {
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      if (success) setMessage(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Knowledge Base action failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function openSource(source: Divin8KnowledgeSourceSummary) {
    await runBusy(async () => {
      const token = await getToken();
      setDetail((await api.get(`/divin8/knowledge/sources/${source.id}`, token)) as Divin8KnowledgeSourceDetailResponse);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={classNames("space-y-6", isLightTheme ? "text-slate-900" : "text-white")}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Divin8 Knowledge Base</h2>
          <p className={classNames("mt-1 max-w-3xl text-sm", isLightTheme ? "text-slate-500" : "text-white/55")}>
            Upload, version, edit, and test Prime Mentor canonical metaphysical doctrine before it reaches Divin8 Chat.
          </p>
        </div>
        <Link
          to="/admin/divin8-chat"
          className={classNames("inline-flex rounded-xl px-4 py-2.5 text-sm font-medium transition-colors", isLightTheme ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-white/10 text-white hover:bg-white/15")}
        >
          Back to chat
        </Link>
      </div>

      {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">{error}</div> : null}

      <KnowledgeUploadPanel
        isLightTheme={isLightTheme}
        isBusy={isBusy}
        onPreview={(input) => void runBusy(async () => {
          const token = await getToken();
          setPreview((await api.postForm("/divin8/knowledge/sources/preview", uploadForm(input), token)) as Divin8KnowledgePreviewResponse);
        }, "Extraction preview ready.")}
        onUpload={(input) => void runBusy(async () => {
          const token = await getToken();
          const uploaded = (await api.postForm("/divin8/knowledge/sources", uploadForm(input), token)) as Divin8KnowledgeSourceDetailResponse;
          setDetail(uploaded);
          setPreview(null);
          await refreshSources();
        }, "Knowledge source indexed.")}
      />

      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          const source = replacementTarget;
          event.target.value = "";
          if (!file || !source) return;
          void runBusy(async () => {
            const token = await getToken();
            const replaced = (await api.postForm(
              `/divin8/knowledge/sources/${source.id}/replace`,
              uploadForm({
                file,
                name: source.name,
                category: source.category,
                authorityLevel: source.authorityLevel,
              }),
              token,
            )) as Divin8KnowledgeSourceDetailResponse;
            setDetail(replaced);
            setReplacementTarget(null);
            await refreshSources();
          }, "Knowledge source replaced and versioned.");
        }}
      />

      {preview ? (
        <section className={classNames("rounded-3xl border p-5", isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5")}>
          <h3 className="font-semibold">Dry-run Preview</h3>
          <p className="mt-2 text-sm opacity-70">{preview.chunks.length} chunks · {preview.concepts.length} concepts · {preview.overrides.length} overrides detected</p>
          <pre className={classNames("mt-4 max-h-64 overflow-auto rounded-2xl p-4 text-xs whitespace-pre-wrap", isLightTheme ? "bg-slate-950 text-slate-100" : "bg-black/30 text-white/80")}>
            {preview.extractedTextPreview}
          </pre>
        </section>
      ) : null}

      <KnowledgeSourceTable
        sources={sources}
        isLightTheme={isLightTheme}
        onView={(source) => void openSource(source)}
        onReprocess={(source) => void runBusy(async () => {
          const token = await getToken();
          const next = (await api.post(`/divin8/knowledge/sources/${source.id}/reprocess`, {
            versionId: source.currentVersionId,
            category: source.category,
            authorityLevel: source.authorityLevel,
          }, token)) as Divin8KnowledgeSourceDetailResponse;
          setDetail(next);
          await refreshSources();
        }, "Knowledge source reprocessed.")}
        onReplace={(source) => {
          setReplacementTarget(source);
          replaceInputRef.current?.click();
        }}
        onDisable={(source) => void runBusy(async () => {
          const token = await getToken();
          await api.post(`/divin8/knowledge/sources/${source.id}/disable`, undefined, token);
          await refreshSources();
        }, "Knowledge source disabled.")}
        onDelete={(source) => {
          if (!window.confirm(`Disable and delete ${source.name}? Records are retained for audit/history.`)) return;
          void runBusy(async () => {
            const token = await getToken();
            await api.delete(`/divin8/knowledge/sources/${source.id}`, token, { confirm: true });
            await refreshSources();
          }, "Knowledge source deleted.");
        }}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <KnowledgeConceptEditor
          isLightTheme={isLightTheme}
          onSave={(body) => void runBusy(async () => {
            const token = await getToken();
            await api.post("/divin8/knowledge/concepts", body, token);
          }, "Concept saved.")}
        />
        <KnowledgeOverrideEditor
          isLightTheme={isLightTheme}
          onSave={(body) => void runBusy(async () => {
            const token = await getToken();
            await api.post("/divin8/knowledge/overrides", body, token);
          }, "Override saved.")}
        />
      </div>

      <KnowledgeRetrievalTester
        isLightTheme={isLightTheme}
        isBusy={isBusy}
        result={retrievalResult}
        onRun={(query) => void runBusy(async () => {
          const token = await getToken();
          setRetrievalResult((await api.post("/divin8/knowledge/test-retrieval", { query }, token)) as Divin8KnowledgeRetrievalDebugResponse);
        })}
      />

      <KnowledgeSourceDrawer
        detail={detail}
        isLightTheme={isLightTheme}
        onClose={() => setDetail(null)}
        onRollback={(versionId) => void runBusy(async () => {
          if (!detail) return;
          const token = await getToken();
          setDetail((await api.post(`/divin8/knowledge/sources/${detail.source.id}/rollback`, { versionId }, token)) as Divin8KnowledgeSourceDetailResponse);
          await refreshSources();
        }, "Knowledge version rolled back.")}
      />
    </motion.div>
  );
}
