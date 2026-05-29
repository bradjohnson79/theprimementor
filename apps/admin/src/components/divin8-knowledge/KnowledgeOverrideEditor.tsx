import { type FormEvent, useState } from "react";
import { DIVIN8_KNOWLEDGE_CATEGORIES, type Divin8KnowledgeCategory } from "@wisdom/utils";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function KnowledgeOverrideEditor({
  isLightTheme,
  onSave,
}: {
  isLightTheme: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const [category, setCategory] = useState<Divin8KnowledgeCategory>("chinese_bazi_vietnamese_branch");
  const [ruleKey, setRuleKey] = useState("");
  const [alwaysUse, setAlwaysUse] = useState("");
  const [neverUse, setNeverUse] = useState("");
  const fieldClass = classNames("rounded-xl border px-3 py-2 text-sm outline-none", isLightTheme ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/10 bg-white/[0.04] text-white");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({
      category,
      ruleKey,
      alwaysUse,
      neverUse: neverUse.split(",").map((item) => item.trim()).filter(Boolean),
      replacements: alwaysUse && neverUse ? Object.fromEntries(neverUse.split(",").map((item) => [item.trim(), alwaysUse]).filter(([from]) => from)) : {},
      authorityLevel: "hard_override",
      priority: 100,
      active: true,
    });
  }

  return (
    <form onSubmit={handleSubmit} className={classNames("rounded-3xl border p-5", isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5")}>
      <h3 className="font-semibold">Manual Hard Override</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value as Divin8KnowledgeCategory)}>
          {DIVIN8_KNOWLEDGE_CATEGORIES.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
        </select>
        <input className={fieldClass} value={ruleKey} onChange={(event) => setRuleKey(event.target.value)} placeholder="animal_branch_4" />
        <input className={fieldClass} value={alwaysUse} onChange={(event) => setAlwaysUse(event.target.value)} placeholder="Cat" />
        <input className={fieldClass} value={neverUse} onChange={(event) => setNeverUse(event.target.value)} placeholder="Rabbit" />
      </div>
      <button type="submit" className="mt-4 rounded-xl bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-slate-950">Save Override</button>
    </form>
  );
}
