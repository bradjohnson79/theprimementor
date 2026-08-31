import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

interface SampleReportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  pdfUrl: string;
  orderPath: string;
  ctaLabel: string;
}

export default function SampleReportDialog({
  open,
  onClose,
  title,
  pdfUrl,
  orderPath,
  ctaLabel,
}: SampleReportDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.classList.add("modal-open");
    panel?.querySelector<HTMLElement>("[data-modal-close]")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])',
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
      document.body.classList.remove("modal-open");
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sample-report-title">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="Close sample report"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-amber-200/20 bg-[#070b16] text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-amber-200/70">Sample Report</p>
            <h2 id="sample-report-title" className="mt-1 text-lg font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            aria-label="Close sample report"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 text-white/80 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-black/40">
          <iframe title={`${title} sample PDF`} src={pdfUrl} className="h-[min(60vh,32rem)] w-full border-0" />
        </div>
        <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:justify-end">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          >
            Open sample
          </a>
          <a
            href={pdfUrl}
            download
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          >
            Download sample
          </a>
          <Link
            to={orderPath}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
