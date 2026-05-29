import type { Divin8KnowledgeRetrievalDebugResponse } from "@wisdom/utils";
import { useState, type FormEvent } from "react";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function KnowledgeRetrievalTester({
  isLightTheme,
  isBusy,
  result,
  onRun,
}: {
  isLightTheme: boolean;
  isBusy: boolean;
  result: Divin8KnowledgeRetrievalDebugResponse | null;
  onRun: (query: string) => void;
}) {
  const [query, setQuery] = useState("Life Path 9");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onRun(query);
  }

  return (
    <section className={classNames("rounded-3xl border p-5", isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5")}>
      <h3 className="font-semibold">Retrieval Test Console</h3>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={classNames("min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none", isLightTheme ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/10 bg-white/[0.04] text-white")}
        />
        <button type="submit" disabled={isBusy} className="rounded-xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950">Run</button>
      </form>

      {result ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">Matched Concepts</p>
            <ul className="mt-2 space-y-1 text-sm opacity-75">
              {result.matchedConcepts.map((concept) => <li key={concept.id}>{concept.conceptKey}: {concept.canonicalMeanings.join(", ")}</li>)}
            </ul>
            <p className="mt-4 text-sm font-semibold">Hard Overrides</p>
            <ul className="mt-2 space-y-1 text-sm opacity-75">
              {result.appliedOverrides.map((override) => <li key={override.id}>{override.ruleKey}: use {override.alwaysUse ?? "—"} avoid {override.neverUse.join(", ")}</li>)}
            </ul>
            <p className="mt-4 text-sm font-semibold">Chunks</p>
            <ul className="mt-2 space-y-1 text-sm opacity-75">
              {result.matchedChunks.map((chunk) => <li key={chunk.chunkId}>{chunk.sourceName} · score {chunk.score.toFixed(1)}</li>)}
            </ul>
          </div>
          <pre className={classNames("max-h-96 overflow-auto rounded-2xl p-4 text-xs whitespace-pre-wrap", isLightTheme ? "bg-slate-950 text-slate-100" : "bg-black/30 text-white/80")}>
            {result.finalContext}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
