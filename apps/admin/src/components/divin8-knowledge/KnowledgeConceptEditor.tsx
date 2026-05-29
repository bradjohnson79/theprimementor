import {
  DIVIN8_KNOWLEDGE_AUTHORITY_LEVELS,
  DIVIN8_KNOWLEDGE_CATEGORIES,
  type Divin8KnowledgeAuthorityLevel,
  type Divin8KnowledgeCategory,
} from "@wisdom/utils";
import { useState, type FormEvent } from "react";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function KnowledgeConceptEditor({
  isLightTheme,
  onSave,
}: {
  isLightTheme: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const [category, setCategory] = useState<Divin8KnowledgeCategory>("numerology_prime_canon");
  const [authorityLevel, setAuthorityLevel] = useState<Divin8KnowledgeAuthorityLevel>("canonical_interpretation");
  const [conceptKey, setConceptKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [canonicalMeanings, setCanonicalMeanings] = useState("");
  const [forbiddenInterpretations, setForbiddenInterpretations] = useState("");
  const fieldClass = classNames("rounded-xl border px-3 py-2 text-sm outline-none", isLightTheme ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/10 bg-white/[0.04] text-white");

  function split(value: string) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({
      category,
      authorityLevel,
      conceptKey,
      displayName,
      canonicalMeanings: split(canonicalMeanings),
      forbiddenInterpretations: split(forbiddenInterpretations),
      preferredTerms: split(canonicalMeanings),
      replacementRules: {},
      priority: authorityLevel === "hard_override" ? 100 : 50,
      active: true,
    });
  }

  return (
    <form onSubmit={handleSubmit} className={classNames("rounded-3xl border p-5", isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5")}>
      <h3 className="font-semibold">Manual Concept Rule</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value as Divin8KnowledgeCategory)}>
          {DIVIN8_KNOWLEDGE_CATEGORIES.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
        </select>
        <select className={fieldClass} value={authorityLevel} onChange={(event) => setAuthorityLevel(event.target.value as Divin8KnowledgeAuthorityLevel)}>
          {DIVIN8_KNOWLEDGE_AUTHORITY_LEVELS.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
        </select>
        <input className={fieldClass} value={conceptKey} onChange={(event) => setConceptKey(event.target.value)} placeholder="life_path_9" />
        <input className={fieldClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Life Path 9" />
        <input className={fieldClass} value={canonicalMeanings} onChange={(event) => setCanonicalMeanings(event.target.value)} placeholder="completion, wisdom, culmination" />
        <input className={fieldClass} value={forbiddenInterpretations} onChange={(event) => setForbiddenInterpretations(event.target.value)} placeholder="humanitarian, martyr" />
      </div>
      <button type="submit" className="mt-4 rounded-xl bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-slate-950">Save Concept</button>
    </form>
  );
}
