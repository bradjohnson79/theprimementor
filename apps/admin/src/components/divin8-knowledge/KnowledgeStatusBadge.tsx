import type { Divin8KnowledgeStatus } from "@wisdom/utils";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function KnowledgeStatusBadge({
  status,
  isLightTheme,
}: {
  status: Divin8KnowledgeStatus;
  isLightTheme: boolean;
}) {
  const positive = status === "ready" || status === "indexed";
  const failed = status === "failed" || status === "deleted" || status === "disabled";
  return (
    <span
      className={classNames(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        positive
          ? "bg-emerald-500/15 text-emerald-500"
          : failed
            ? "bg-rose-500/15 text-rose-500"
            : isLightTheme
              ? "bg-amber-100 text-amber-700"
              : "bg-amber-400/15 text-amber-200",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
