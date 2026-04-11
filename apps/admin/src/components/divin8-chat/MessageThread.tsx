import { formatPacificClock } from "@wisdom/utils";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { renderReportMarkdownToSafeHtml } from "../../lib/reportHtml";
import type { Divin8ChatMessage } from "./types";
import { classNames } from "./utils";

interface MessageThreadProps {
  isLightTheme: boolean;
  isGenerating: boolean;
  messages: Divin8ChatMessage[];
  scrollContainer: HTMLDivElement | null;
  bottomSpacer: number;
  onRetry: (messageId: string) => void;
}

interface MessageRowItem {
  id: string;
  message: Divin8ChatMessage;
  isGroupStart: boolean;
  isGroupEnd: boolean;
}

interface TypingRowItem {
  id: "__typing__";
  type: "typing";
}

type VirtualRowItem = MessageRowItem | TypingRowItem;

function isTypingRow(item: VirtualRowItem): item is TypingRowItem {
  return "type" in item;
}

function shouldCollapseMessage(message: Divin8ChatMessage) {
  return (
    message.role === "assistant"
    && (message.text.length > 1200 || message.text.split("\n").length > 12)
  );
}

function formatMessageTime(createdAt: string) {
  return formatPacificClock(createdAt);
}

const MessageRow = memo(function MessageRow({
  item,
  isLightTheme,
  collapsed,
  onToggleCollapse,
  onRetry,
  onMeasure,
}: {
  item: MessageRowItem;
  isLightTheme: boolean;
  collapsed: boolean;
  onToggleCollapse: (messageId: string) => void;
  onRetry: (messageId: string) => void;
  onMeasure: () => void;
}) {
  const { message, isGroupStart, isGroupEnd } = item;
  const isUser = message.role === "user";
  const intentSignal = !isUser ? message.meta?.divin8?.intentSignal : undefined;
  const intentRing =
    intentSignal === "inquiry"
      ? isLightTheme
        ? "ring-1 ring-amber-400/45"
        : "ring-1 ring-amber-300/35"
      : intentSignal === "confirmation"
        ? isLightTheme
          ? "ring-1 ring-emerald-500/35"
          : "ring-1 ring-emerald-400/30"
        : "";
  const renderedMessageHtml = useMemo(
    () => (!isUser ? renderReportMarkdownToSafeHtml(message.text) : null),
    [isUser, message.text],
  );

  useEffect(() => {
    const timeout = window.setTimeout(onMeasure, 80);
    return () => window.clearTimeout(timeout);
  }, [collapsed, message.imagePreviewUrl, onMeasure]);

  return (
    <div
      className={classNames(
        "flex w-full px-3",
        isUser ? "justify-end" : "justify-start",
        isGroupStart ? "pt-3" : "pt-0.5",
        isGroupEnd ? "pb-2" : "pb-0.5",
      )}
    >
      <div className={classNames("flex w-full gap-2.5", isUser ? "max-w-[620px] flex-row-reverse" : "max-w-[860px]")}>
        <div className="w-7 shrink-0">
          {isGroupStart ? (
            <div
              className={classNames(
                "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold uppercase",
                isUser
                  ? "bg-accent-cyan text-slate-950"
                  : isLightTheme
                    ? "bg-slate-200 text-slate-700"
                    : "bg-white/10 text-white/80",
              )}
              aria-hidden="true"
            >
              {isUser ? "You" : "PM"}
            </div>
          ) : null}
        </div>

        <div className={classNames("min-w-0", isUser ? "flex flex-col items-end" : "")}>
          {isGroupStart ? (
            <p className={classNames("mb-0.5 px-0.5 text-[10px] font-medium", isLightTheme ? "text-slate-400" : "text-white/35")}>
              {isUser ? "You" : "Prime Mentor"}
            </p>
          ) : null}

          <div
            className={classNames(
              "relative overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
              isUser
                ? "bg-gradient-to-br from-cyan-400 to-blue-500 text-white border border-white/10"
                : isLightTheme
                  ? "border border-slate-200 bg-white text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
                  : "border border-white/[0.07] bg-white/[0.04] text-white",
              !isUser ? intentRing : "",
            )}
          >
            {isUser ? (
              <div className="leading-6 whitespace-pre-wrap">{message.text}</div>
            ) : (
              <div className="relative">
                <div
                  className={classNames(
                    "leading-6",
                    collapsed ? "max-h-[16rem] overflow-hidden" : "",
                    "[&_a]:font-medium [&_a]:underline [&_blockquote]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1.5 [&_h2]:text-[0.94rem] [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:ml-4 [&_li]:py-0.5 [&_ol]:my-1.5 [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:my-1.5 [&_ul]:ml-4 [&_ul]:list-disc",
                    isLightTheme
                      ? "[&_a]:text-cyan-700 [&_blockquote]:border-slate-300 [&_code]:bg-slate-100 [&_pre]:bg-slate-950 [&_pre]:text-slate-100"
                      : "[&_a]:text-accent-cyan [&_blockquote]:border-white/20 [&_code]:bg-white/10 [&_pre]:bg-slate-950/80",
                  )}
                  dangerouslySetInnerHTML={{ __html: renderedMessageHtml || "" }}
                />
                {collapsed ? (
                  <div className={classNames("pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t", isLightTheme ? "from-white to-transparent" : "from-[rgba(20,24,34,0.96)] to-transparent")} />
                ) : null}
              </div>
            )}

            {message.imagePreviewUrl ? (
              <div
                className={classNames(
                  "relative mt-2.5 aspect-[4/3] w-44 overflow-hidden rounded-xl border",
                  isLightTheme ? "border-slate-200 bg-slate-100" : "border-white/10 bg-white/5",
                )}
              >
                <img src={message.imagePreviewUrl} alt="Chat upload preview" className="h-full w-full object-cover" onLoad={onMeasure} />
              </div>
            ) : null}

            {!isUser && (message.engineUsed || message.systemsUsed?.length) ? (
              <div
                className={classNames(
                  "mt-2.5 flex flex-wrap items-center gap-1.5 border-t pt-2.5 text-[10px]",
                  isLightTheme ? "border-slate-100 text-slate-400" : "border-white/[0.06] text-white/40",
                )}
              >
                <span>{message.engineUsed ? "Engine" : "Conversational"}</span>
                {message.systemsUsed?.map((system) => (
                  <span
                    key={`${message.id}-${system}`}
                    className={classNames(
                      "rounded-full px-1.5 py-0.5",
                      isLightTheme ? "bg-slate-50 text-slate-500" : "bg-white/[0.06] text-white/55",
                    )}
                  >
                    {system}
                  </span>
                ))}
              </div>
            ) : null}

            {shouldCollapseMessage(message) ? (
              <button
                type="button"
                onClick={() => onToggleCollapse(message.id)}
                className={classNames(
                  "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
                  isLightTheme ? "bg-slate-50 text-slate-600 hover:bg-slate-100" : "bg-white/[0.06] text-white/60 hover:bg-white/10",
                )}
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Expand response" : "Collapse response"}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={classNames("h-3 w-3 transition-transform", collapsed ? "" : "rotate-180")}
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
                {collapsed ? "Show more" : "Show less"}
              </button>
            ) : null}

            {message.deliveryState ? (
              <div
                className={classNames(
                  "mt-2 flex items-center gap-2 text-[11px]",
                  message.deliveryState === "failed"
                    ? isLightTheme ? "text-rose-700" : "text-rose-200"
                    : isLightTheme ? "text-slate-600" : "text-white/70",
                )}
              >
                <span>{message.deliveryState === "failed" ? "Failed to send" : "Sending..."}</span>
                {message.deliveryState === "failed" ? (
                  <button
                    type="button"
                    onClick={() => onRetry(message.id)}
                    className={classNames(
                      "rounded-full px-2 py-0.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
                      isLightTheme ? "bg-white/70 text-rose-700 hover:bg-white" : "bg-white/10 text-white hover:bg-white/15",
                    )}
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {isGroupEnd ? (
            <p className={classNames("mt-1 px-0.5 text-[10px]", isLightTheme ? "text-slate-300" : "text-white/25")}>
              {formatMessageTime(message.createdAt)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
});

const TypingRow = memo(function TypingRow({ isLightTheme }: { isLightTheme: boolean }) {
  return (
    <div className="flex justify-start px-3 pt-3 pb-2">
      <div className="flex gap-2.5">
        <div
          className={classNames(
            "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold uppercase",
            isLightTheme ? "bg-slate-200 text-slate-700" : "bg-white/10 text-white/80",
          )}
          aria-hidden="true"
        >
          PM
        </div>
        <div>
          <p className={classNames("mb-0.5 px-0.5 text-[10px] font-medium", isLightTheme ? "text-slate-400" : "text-white/35")}>
            Prime Mentor
          </p>
          <div
            className={classNames(
              "rounded-2xl border px-4 py-3",
              isLightTheme ? "border-slate-200 bg-white" : "border-white/[0.07] bg-white/[0.04]",
            )}
          >
            <div className={classNames("flex items-center gap-1.5", isLightTheme ? "text-slate-400" : "text-white/50")}>
              <span className="chat-typing-dot inline-block h-1.5 w-1.5 rounded-full bg-current" />
              <span className="chat-typing-dot inline-block h-1.5 w-1.5 rounded-full bg-current" />
              <span className="chat-typing-dot inline-block h-1.5 w-1.5 rounded-full bg-current" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function MessageThread({
  isLightTheme,
  isGenerating,
  messages,
  scrollContainer,
  bottomSpacer,
  onRetry,
}: MessageThreadProps) {
  const measureTimeoutRef = useRef<number | null>(null);
  const [collapsedState, setCollapsedState] = useState<Record<string, boolean>>({});

  const rows = useMemo<MessageRowItem[]>(
    () =>
      messages.map((message, index) => ({
        id: message.id,
        message,
        isGroupStart: index === 0 || messages[index - 1]?.role !== message.role,
        isGroupEnd: index === messages.length - 1 || messages[index + 1]?.role !== message.role,
      })),
    [messages],
  );

  const items = useMemo<VirtualRowItem[]>(
    () => (isGenerating ? [...rows, { id: "__typing__", type: "typing" }] : rows),
    [isGenerating, rows],
  );

  const virtualizerRef = useRef<ReturnType<typeof useVirtualizer<HTMLDivElement, Element>> | null>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual intentionally exposes imperative methods from the hook result.
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainer,
    estimateSize: (index) => (items[index]?.id === "__typing__" ? 72 : 120),
    getItemKey: (index) => items[index]?.id ?? `virtual-${index}`,
    overscan: 10,
  });

  virtualizerRef.current = virtualizer;

  const scheduleMeasure = useCallback(() => {
    if (measureTimeoutRef.current) {
      window.clearTimeout(measureTimeoutRef.current);
    }
    measureTimeoutRef.current = window.setTimeout(() => {
      virtualizerRef.current?.measure();
    }, 60);
  }, []);

  useEffect(() => {
    return () => {
      if (measureTimeoutRef.current) {
        window.clearTimeout(measureTimeoutRef.current);
      }
    };
  }, []);

  function handleToggleCollapse(messageId: string) {
    const targetRow = rows.find((row) => row.id === messageId);
    if (!targetRow) {
      return;
    }

    setCollapsedState((current) => ({
      ...current,
      [messageId]: !(current[messageId] ?? shouldCollapseMessage(targetRow.message)),
    }));
    scheduleMeasure();
  }

  return (
    <div style={{ height: `${virtualizer.getTotalSize() + bottomSpacer}px`, position: "relative" }}>
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const item = items[virtualItem.index];
        if (!item) {
          return null;
        }

        if (isTypingRow(item)) {
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={(node) => {
                if (node) {
                  virtualizer.measureElement(node);
                }
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <TypingRow isLightTheme={isLightTheme} />
            </div>
          );
        }

        const collapsed = collapsedState[item.id] ?? shouldCollapseMessage(item.message);

        return (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={(node) => {
              if (node) {
                virtualizer.measureElement(node);
              }
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <MessageRow
              item={item}
              isLightTheme={isLightTheme}
              collapsed={collapsed}
              onToggleCollapse={handleToggleCollapse}
              onRetry={onRetry}
              onMeasure={scheduleMeasure}
            />
          </div>
        );
      })}
    </div>
  );
}
