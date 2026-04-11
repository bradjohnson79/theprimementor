import { useState } from "react";
import { formatPacificMonthDay } from "@wisdom/utils";
import { useI18n } from "../../i18n";
import type { Divin8ConversationThread } from "./types";
import { classNames } from "./utils";

interface ConversationListProps {
  threads: Divin8ConversationThread[];
  activeThreadId: string | null;
  isLightTheme: boolean;
  isCreating: boolean;
  searchQuery: string;
  isSearching: boolean;
  onSearchQueryChange: (value: string) => void;
  onCreate: () => void;
  onSelect: (threadId: string) => void;
  onArchiveRequest: (thread: Divin8ConversationThread) => void;
}

function formatUpdatedAt(value: string | null, justNowLabel: string) {
  if (!value) {
    return justNowLabel;
  }
  return formatPacificMonthDay(value);
}

export default function ConversationList({
  threads,
  activeThreadId,
  isLightTheme,
  isCreating,
  searchQuery,
  isSearching,
  onSearchQueryChange,
  onCreate,
  onSelect,
  onArchiveRequest,
}: ConversationListProps) {
  const { plural, t } = useI18n();
  const [openMenuThreadId, setOpenMenuThreadId] = useState<string | null>(null);

  return (
    <aside
      className={classNames(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border",
        isLightTheme ? "border-slate-200 bg-white" : "border-white/[0.07] bg-white/[0.03]",
      )}
    >
      <div className="border-b border-inherit p-3">
        <label className="block">
          <span className="sr-only">{t("divin8.conversations.searchPlaceholder")}</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={t("divin8.conversations.searchPlaceholder")}
            className={classNames(
              "w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors",
              isLightTheme
                ? "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-accent-cyan"
                : "border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-accent-cyan",
            )}
          />
        </label>
        <button
          type="button"
          onClick={onCreate}
          disabled={isCreating}
          className={classNames(
            "mt-2 w-full rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
            isCreating
              ? "cursor-not-allowed bg-slate-400/30 text-white/50"
              : "bg-accent-cyan text-slate-950 hover:brightness-110",
          )}
        >
          {isCreating ? t("divin8.conversations.creating") : t("divin8.conversations.new")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                className={classNames(
                  "group relative rounded-xl border transition-colors",
                  isActive
                    ? "border-accent-cyan/40 bg-accent-cyan/10"
                    : isLightTheme
                      ? "border-transparent hover:border-slate-200 hover:bg-slate-50"
                      : "border-transparent hover:border-white/10 hover:bg-white/[0.04]",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuThreadId(null);
                    onSelect(thread.id);
                  }}
                  className="w-full rounded-xl px-3 py-2 pr-10 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium">{thread.title}</p>
                    <span className={classNames("shrink-0 text-[10px]", isLightTheme ? "text-slate-400" : "text-white/35")}>
                      {formatUpdatedAt(thread.updatedAt, t("divin8.conversations.justNow"))}
                    </span>
                  </div>
                  <p className={classNames("mt-1 line-clamp-1 text-xs", isLightTheme ? "text-slate-500" : "text-white/45")}>
                    {thread.summary || thread.preview || t("divin8.conversations.noSummary")}
                  </p>
                  <p className={classNames("mt-0.5 text-[10px]", isLightTheme ? "text-slate-350" : "text-white/25")}>
                    {plural("divin8.conversations.message", thread.messageCount)}
                  </p>
                </button>

                <div className="absolute right-2 top-2">
                  <button
                    type="button"
                    aria-label={t("divin8.conversations.actions")}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuThreadId((current) => (current === thread.id ? null : thread.id));
                    }}
                    className={classNames(
                      "rounded-md px-1.5 py-0.5 text-sm font-semibold opacity-0 transition-all group-hover:opacity-100",
                      isActive && "opacity-100",
                      isLightTheme ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900" : "text-white/55 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    ...
                  </button>

                  {openMenuThreadId === thread.id ? (
                    <div
                      className={classNames(
                        "absolute right-0 z-20 mt-1 min-w-[130px] rounded-lg border p-1 shadow-lg",
                        isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950",
                      )}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuThreadId(null);
                          onArchiveRequest(thread);
                        }}
                        className={classNames(
                          "w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                          isLightTheme ? "text-rose-600 hover:bg-rose-50" : "text-rose-300 hover:bg-rose-500/10",
                        )}
                      >
                        {t("divin8.conversations.delete")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {threads.length === 0 ? (
            <div className={classNames("rounded-xl border px-3 py-4 text-sm", isLightTheme ? "border-slate-200 text-slate-500" : "border-white/10 text-white/55")}>
              {searchQuery.trim()
                ? (isSearching ? t("divin8.conversations.searching") : t("divin8.conversations.noSearchResults"))
                : t("divin8.conversations.empty")}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
