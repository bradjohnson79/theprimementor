import type { Divin8KnowledgeSourceSummary } from "@wisdom/utils";
import KnowledgeStatusBadge from "./KnowledgeStatusBadge";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function KnowledgeSourceTable({
  sources,
  isLightTheme,
  onView,
  onReprocess,
  onReplace,
  onDisable,
  onDelete,
}: {
  sources: Divin8KnowledgeSourceSummary[];
  isLightTheme: boolean;
  onView: (source: Divin8KnowledgeSourceSummary) => void;
  onReprocess: (source: Divin8KnowledgeSourceSummary) => void;
  onReplace: (source: Divin8KnowledgeSourceSummary) => void;
  onDisable: (source: Divin8KnowledgeSourceSummary) => void;
  onDelete: (source: Divin8KnowledgeSourceSummary) => void;
}) {
  return (
    <div className={classNames("overflow-hidden rounded-3xl border", isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5")}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={isLightTheme ? "bg-slate-50 text-slate-500" : "bg-white/[0.03] text-white/45"}>
            <tr>
              {["Name", "Category", "Authority", "Status", "Version", "Updated", "Actions"].map((heading) => (
                <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className={isLightTheme ? "divide-y divide-slate-100" : "divide-y divide-white/10"}>
            {sources.map((source) => (
              <tr key={source.id}>
                <td className="px-4 py-3 font-medium">{source.name}</td>
                <td className="px-4 py-3 capitalize">{source.category.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 capitalize">{source.authorityLevel.replace(/_/g, " ")}</td>
                <td className="px-4 py-3"><KnowledgeStatusBadge status={source.status} isLightTheme={isLightTheme} /></td>
                <td className="px-4 py-3">{source.currentVersionLabel ?? "v1"}</td>
                <td className="px-4 py-3">{source.updatedAt ? new Date(source.updatedAt).toLocaleString() : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onView(source)} className="text-accent-cyan">View</button>
                    <button type="button" onClick={() => onReprocess(source)}>Reprocess</button>
                    <button type="button" onClick={() => onReplace(source)}>Replace</button>
                    <button type="button" onClick={() => onDisable(source)}>Disable</button>
                    <button type="button" onClick={() => onDelete(source)} className="text-rose-500">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {sources.length === 0 ? (
              <tr>
                <td colSpan={7} className={classNames("px-4 py-8 text-center", isLightTheme ? "text-slate-500" : "text-white/50")}>
                  No knowledge sources yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
