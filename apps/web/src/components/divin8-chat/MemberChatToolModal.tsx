import { useEffect, useRef, type ReactNode } from "react";
import { classNames } from "@wisdom/ui/divin8-chat";

interface MemberChatToolModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: "modal" | "drawer";
}

export default function MemberChatToolModal({
  title,
  open,
  onClose,
  children,
  variant = "modal",
}: MemberChatToolModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const closeBtn = panel.querySelector<HTMLElement>("[data-modal-close]");
    closeBtn?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const isDrawer = variant === "drawer";

  return (
    <div
      className="fixed inset-0 left-64 z-[60] flex"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="modal-overlay-enter absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
        role="button"
        tabIndex={-1}
        aria-label="Close overlay"
      />

      <div
        ref={panelRef}
        className={classNames(
          "relative z-10 flex max-h-full min-h-0 flex-col border shadow-2xl border-white/10 bg-slate-950 text-white",
          isDrawer
            ? "drawer-panel-enter ml-auto h-full w-full max-w-xl rounded-l-2xl"
            : "modal-panel-enter m-auto h-[min(82vh,760px)] w-[min(92vw,980px)] rounded-2xl",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
