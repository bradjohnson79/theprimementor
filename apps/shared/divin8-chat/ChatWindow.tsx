import { useCallback, useEffect, useState, type ReactNode, type RefObject, type UIEvent } from "react";
import MessageThread from "./MessageThread";
import type { Divin8ChatMessage } from "./types";
import { classNames } from "./utils";

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

  return (
    <section
      className={classNames(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border",
        isLightTheme ? "border-slate-200 bg-white" : "border-white/[0.07] bg-white/[0.03]",
      )}
    >
      <div
        className={classNames(
          "sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 backdrop-blur-xl",
          isLightTheme ? "border-slate-200 bg-white/92" : "border-white/[0.07] bg-[rgba(8,12,22,0.92)]",
        )}
      >
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
        </div>
        {headerActions ? (
          <div className="flex shrink-0 items-center gap-1.5">{headerActions}</div>
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
          className="absolute right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-accent-cyan text-slate-950 shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70"
          style={{ bottom: `${composerHeight + 12}px` }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4" aria-hidden="true">
            <path d="M19 14l-7 7-7-7M12 21V3" />
          </svg>
        </button>
      ) : null}

      <div
        className={classNames(
          "sticky bottom-0 z-10 shrink-0 border-t px-3 pt-2",
          isLightTheme ? "border-slate-100 bg-white/95" : "border-white/[0.05] bg-[rgba(8,12,22,0.95)]",
        )}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
      >
        {composer}
      </div>

      <div className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </div>
    </section>
  );
}
