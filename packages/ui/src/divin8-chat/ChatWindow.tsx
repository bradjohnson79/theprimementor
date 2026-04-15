import { useCallback, useEffect, useState, type ReactNode, type RefObject, type UIEvent } from "react";
import MessageThread from "./MessageThread";
import type { Divin8ChatMessage, Divin8ServerTimeContext } from "./types";
import { classNames, darkChatStyles, visuallyHiddenStyle } from "./utils";

interface ChatWindowProps {
  title: string;
  messages: Divin8ChatMessage[];
  isGenerating: boolean;
  isThreadLoading: boolean;
  threadError: string | null;
  isLightTheme: boolean;
  onRetryMessage: (messageId: string) => void;
  onRetryLoad: () => void;
  showScrollToBottom: boolean;
  onScrollToBottom: () => void;
  onViewportScroll: (event: UIEvent<HTMLDivElement>) => void;
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  composer: ReactNode;
  liveAnnouncement: string;
  headerActions?: ReactNode;
  serverTimeContext?: Divin8ServerTimeContext | null;
}

function formatServerTime(context: Divin8ServerTimeContext) {
  const date = new Date(context.currentDateTime);
  if (Number.isNaN(date.getTime())) {
    return {
      dayLabel: context.currentDate,
      timeLabel: context.currentTime,
      zoneLabel: context.timezone,
    };
  }
  return {
    dayLabel: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: context.timezone,
    }).format(date),
    timeLabel: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: context.timezone,
    }).format(date),
    zoneLabel: context.timezone.replaceAll("_", " "),
  };
}

function LoadingSkeleton({ isLightTheme }: { isLightTheme: boolean }) {
  return (
    <div className="space-y-3 px-3 py-4">
      {[0, 1, 2].map((value) => (
        <div key={value} className={classNames("animate-pulse rounded-2xl border p-4", isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/[0.07] bg-white/[0.03]")}>
          <div className={classNames("h-2.5 w-16 rounded-full", isLightTheme ? "bg-slate-200" : "bg-white/10")} />
          <div className={classNames("mt-2.5 h-2.5 w-full rounded-full", isLightTheme ? "bg-slate-200" : "bg-white/10")} />
          <div className={classNames("mt-2 h-2.5 w-3/4 rounded-full", isLightTheme ? "bg-slate-200" : "bg-white/10")} />
        </div>
      ))}
    </div>
  );
}

export default function ChatWindow({
  title,
  messages,
  isGenerating,
  isThreadLoading,
  threadError,
  isLightTheme,
  onRetryMessage,
  onRetryLoad,
  showScrollToBottom,
  onScrollToBottom,
  onViewportScroll,
  scrollViewportRef,
  composer,
  liveAnnouncement,
  headerActions,
  serverTimeContext,
}: ChatWindowProps) {
  const [composerHeight, setComposerHeight] = useState(0);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

  const setViewportElement = useCallback(
    (node: HTMLDivElement | null) => {
      if (scrollViewportRef.current !== node) {
        scrollViewportRef.current = node;
      }
      setScrollElement((current) => (current === node ? current : node));
    },
    [scrollViewportRef],
  );

  useEffect(() => {
    const composerElement = scrollElement?.nextElementSibling as HTMLElement | null;
    if (!composerElement) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setComposerHeight(entry.contentRect.height);
    });

    observer.observe(composerElement);
    return () => observer.disconnect();
  }, [composer, scrollElement]);

  const formattedTime = serverTimeContext ? formatServerTime(serverTimeContext) : null;

  return (
    <section
      className={classNames(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border",
        isLightTheme ? "border-slate-200 bg-white" : "",
      )}
      style={!isLightTheme ? darkChatStyles.panel : undefined}
    >
      <div
        className={classNames(
          "sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2.5 border-b px-4 py-2.5 backdrop-blur-xl",
          isLightTheme ? "border-slate-200 bg-white/92" : "",
        )}
        style={!isLightTheme ? darkChatStyles.header : undefined}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            {formattedTime ? (
              <div
                className={classNames(
                  "inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full border px-2.5 py-1 text-[11px] shadow-[0_0_24px_rgba(34,211,238,0.14)]",
                  isLightTheme
                    ? "border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-violet-50 text-slate-700"
                    : "border-cyan-400/25 bg-[linear-gradient(135deg,rgba(18,26,46,0.96),rgba(38,16,60,0.92))] text-white/88",
                )}
                title={`Authoritative server time in ${formattedTime.zoneLabel}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(34,211,238,0.85)]" aria-hidden="true" />
                <span className="truncate font-medium">{formattedTime.dayLabel}</span>
                <span className={classNames("hidden h-1 w-1 rounded-full md:inline-block", isLightTheme ? "bg-slate-300" : "bg-white/25")} aria-hidden="true" />
                <span className="font-semibold text-accent-cyan">{formattedTime.timeLabel}</span>
              </div>
            ) : null}
          </div>
          {formattedTime ? (
            <p className={classNames("mt-1 truncate text-[11px]", isLightTheme ? "text-slate-400" : "text-white/38")}>
              Synced to {formattedTime.zoneLabel}
            </p>
          ) : null}
        </div>
        {headerActions ? (
          <div className="flex shrink-0 items-center gap-1">{headerActions}</div>
        ) : null}
      </div>

      <div ref={setViewportElement} onScroll={onViewportScroll} className="flex-1 overflow-y-auto overscroll-contain">
        {isThreadLoading ? (
          <LoadingSkeleton isLightTheme={isLightTheme} />
        ) : threadError ? (
          <div className="px-4 py-5">
            <div
              className={classNames(
                "rounded-2xl border px-5 py-6 text-center text-sm",
                isLightTheme ? "border-rose-200 bg-rose-50 text-rose-700" : "border-rose-500/20 bg-rose-500/10 text-rose-100",
              )}
            >
              <p>{threadError}</p>
              <button
                type="button"
                onClick={onRetryLoad}
                className={classNames(
                  "mt-3 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
                  isLightTheme ? "bg-white text-rose-700 hover:bg-rose-100" : "bg-white/10 text-white hover:bg-white/15",
                )}
              >
                Retry thread
              </button>
            </div>
          </div>
        ) : messages.length === 0 && !isGenerating ? (
          <div className="px-4 py-5">
            <div
              className={classNames(
                "rounded-2xl border border-dashed px-5 py-8 text-center text-sm",
                isLightTheme ? "border-slate-200 text-slate-400" : "border-white/10 text-white/40",
              )}
            >
              Start your Divin8 conversation.
            </div>
          </div>
        ) : (
          <MessageThread
            isLightTheme={isLightTheme}
            isGenerating={isGenerating}
            messages={messages}
            scrollContainer={scrollElement}
            bottomSpacer={composerHeight + 16}
            onRetry={onRetryMessage}
          />
        )}
      </div>

      {showScrollToBottom ? (
        <button
          type="button"
          onClick={onScrollToBottom}
          aria-label="Scroll to bottom"
          className="absolute right-4 z-20 flex items-center justify-center overflow-hidden rounded-full bg-accent-cyan text-slate-950 shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70"
          style={{
            bottom: `${composerHeight + 12}px`,
            width: "32px",
            height: "32px",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-3.5 w-3.5"
            style={{ width: "14px", height: "14px" }}
            aria-hidden="true"
          >
            <path d="M19 14l-7 7-7-7M12 21V3" />
          </svg>
        </button>
      ) : null}

      <div
        className={classNames(
          "sticky bottom-0 z-10 shrink-0 border-t px-3 pt-2",
          isLightTheme ? "border-slate-100 bg-white/95" : "",
        )}
        style={{
          ...(!isLightTheme ? darkChatStyles.footer : {}),
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        }}
      >
        {composer}
      </div>

      <div style={visuallyHiddenStyle} aria-live="polite">
        {liveAnnouncement}
      </div>
    </section>
  );
}
