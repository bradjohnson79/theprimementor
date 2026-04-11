import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supportQuickActions } from "./supportKnowledge";
import type { SupportMessage, SupportQuickAction } from "./supportTypes";

interface SupportChatProps {
  isOpen: boolean;
  messages: SupportMessage[];
  loading: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onQuickAction: (prompt: string) => void;
  onClose: () => void;
}

interface SupportMessageBubbleProps {
  message: SupportMessage;
  onNavigate: () => void;
}

const panelClassName =
  "absolute bottom-16 right-0 flex w-[min(92vw,20rem)] max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_24px_70px_rgba(15,23,42,0.65)] transition duration-200";
const sectionBorderClassName = "border-white/10";
const headerButtonClassName =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70";
const quickActionClassName =
  "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-xs text-white/80 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70";
const inputClassName =
  "min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50";
const sendButtonClassName =
  "rounded-xl bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60";

function SupportMessageBubble({ message, onNavigate }: SupportMessageBubbleProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const isAssistant = message.role === "assistant";
  const bubbleClassName = isAssistant
    ? "self-start rounded-2xl rounded-bl-md border border-white/10 bg-white/5 text-white/85"
    : "self-end rounded-2xl rounded-br-md bg-cyan-300 text-slate-950";

  return (
    <div
      className={`flex flex-col gap-2 transition duration-200 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      }`}
    >
      <div className={`max-w-[85%] px-3 py-2 text-sm leading-6 shadow-sm ${bubbleClassName}`}>{message.text}</div>
      {message.links?.length ? (
        <div className="flex flex-wrap gap-2">
          {message.links.map((link) => (
            <Link
              key={`${message.id}-${link.href}`}
              to={link.href}
              onClick={onNavigate}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SupportTypingRow() {
  return (
    <div className="self-start rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-white/60 animate-pulse" />
        <span className="h-2 w-2 rounded-full bg-white/50 animate-pulse [animation-delay:120ms]" />
        <span className="h-2 w-2 rounded-full bg-white/40 animate-pulse [animation-delay:240ms]" />
      </div>
    </div>
  );
}

function QuickActions({
  actions,
  onQuickAction,
}: {
  actions: SupportQuickAction[];
  onQuickAction: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => onQuickAction(action.prompt)}
          className={quickActionClassName}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export default function SupportChat({
  isOpen,
  messages,
  loading,
  inputValue,
  onInputChange,
  onSubmit,
  onQuickAction,
  onClose,
}: SupportChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [isOpen, messages, loading]);

  return (
    <div
      className={`${panelClassName} ${
        isOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
      aria-hidden={!isOpen}
    >
      <div className={`flex items-center justify-between border-b ${sectionBorderClassName} px-4 py-3`}>
        <div>
          <p className="text-sm font-semibold text-white">Prime Mentor Support</p>
          <p className="text-xs text-white/55">Ask about sessions, reports, or booking.</p>
        </div>
        <button type="button" onClick={onClose} className={headerButtonClassName} aria-label="Close support chat">
          x
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <QuickActions actions={supportQuickActions} onQuickAction={onQuickAction} />
        <div className="mt-4 flex flex-col gap-3">
          {messages.map((message) => (
            <SupportMessageBubble key={message.id} message={message} onNavigate={onClose} />
          ))}
          {loading ? <SupportTypingRow /> : null}
        </div>
      </div>

      <form
        className={`shrink-0 border-t ${sectionBorderClassName} bg-slate-950/95 px-4 py-3`}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Ask a support question"
            className={inputClassName}
          />
          <button type="submit" disabled={!inputValue.trim() || loading} className={sendButtonClassName}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
