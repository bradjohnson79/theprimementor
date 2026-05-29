import type { Divin8KnowledgeSourceDetailResponse } from "@wisdom/utils";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function KnowledgeSourceDrawer({
  detail,
  isLightTheme,
  onClose,
  onRollback,
}: {
  detail: Divin8KnowledgeSourceDetailResponse | null;
  isLightTheme: boolean;
  onClose: () => void;
  onRollback: (versionId: string) => void;
}) {
  if (!detail) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className={classNames("h-full w-full max-w-2xl overflow-y-auto p-6 shadow-2xl", isLightTheme ? "bg-white text-slate-900" : "bg-navy-dark text-white")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] opacity-60">Knowledge Source</p>
            <h3 className="mt-1 text-xl font-semibold">{detail.source.name}</h3>
            <p className="mt-1 text-sm opacity-60">{detail.source.category.replace(/_/g, " ")} · {detail.source.authorityLevel.replace(/_/g, " ")}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm opacity-70 hover:opacity-100">Close</button>
        </div>

        <section className="mt-6">
          <h4 className="font-semibold">Extracted Concepts</h4>
          <div className="mt-3 space-y-3">
            {detail.concepts.map((concept) => (
              <div key={concept.id} className={classNames("rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
                <p className="font-medium">{concept.displayName} <span className="text-xs opacity-50">({concept.conceptKey})</span></p>
                <p className="mt-2 text-sm">Meanings: {concept.canonicalMeanings.join(", ") || "Not specified"}</p>
                {concept.forbiddenInterpretations.length ? <p className="mt-1 text-sm text-rose-500">Avoid: {concept.forbiddenInterpretations.join(", ")}</p> : null}
              </div>
            ))}
            {detail.concepts.length === 0 ? <p className="text-sm opacity-60">No concepts extracted yet.</p> : null}
          </div>
        </section>

        <section className="mt-6">
          <h4 className="font-semibold">Version History</h4>
          <div className="mt-3 space-y-2">
            {detail.versions.map((version) => (
              <div key={version.id} className={classNames("flex items-center justify-between rounded-xl border px-3 py-2 text-sm", isLightTheme ? "border-slate-200" : "border-white/10")}>
                <span>{version.versionLabel} · {version.status} · {new Date(version.createdAt).toLocaleString()}</span>
                <button type="button" onClick={() => onRollback(version.id)} className="text-accent-cyan">Rollback</button>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h4 className="font-semibold">Chunk Preview</h4>
          <div className="mt-3 space-y-3">
            {detail.chunks.slice(0, 5).map((chunk, index) => (
              <div key={`${chunk.title ?? "chunk"}-${index}`} className={classNames("rounded-2xl border p-4 text-sm", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5")}>
                <p className="font-medium">{chunk.title ?? `Chunk ${index + 1}`}</p>
                <p className="mt-1 opacity-70">{chunk.content.slice(0, 500)}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
