import { useEffect, useMemo, useState } from "react";
import {
  DIVIN8_TIMELINE_SYSTEMS,
  buildDivin8TimelineTag,
  validateDivin8TimelineRange,
  type Divin8TimelineRequest,
  type Divin8TimelineSystem,
} from "@wisdom/utils";
import Divin8ModalPortal from "./Divin8ModalPortal";
import { classNames, darkChatStyles } from "./utils";

interface Divin8TimelineModalProps {
  open: boolean;
  isLightTheme: boolean;
  onClose: () => void;
  onGenerate: (timeline: Divin8TimelineRequest) => void;
  errorMessage?: string | null;
}

interface FormState {
  system: Divin8TimelineSystem | "";
  monthIndex: string;
  startDay: string;
  endDay: string;
  year: string;
}

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function initialFormState() {
  const now = new Date();
  return {
    system: "",
    monthIndex: String(now.getMonth()),
    startDay: "",
    endDay: "",
    year: String(now.getFullYear()),
  } satisfies FormState;
}

function buildIsoDate(year: string, monthIndex: string, day: string) {
  if (!year || !monthIndex || !day) {
    return "";
  }
  return `${year.padStart(4, "0")}-${String(Number(monthIndex) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export default function Divin8TimelineModal({
  open,
  isLightTheme,
  onClose,
  onGenerate,
  errorMessage,
}: Divin8TimelineModalProps) {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(initialFormState());
      setValidationError(null);
    }
  }, [open]);

  const previewTag = useMemo(() => {
    const startDate = buildIsoDate(form.year, form.monthIndex, form.startDay);
    const endDate = buildIsoDate(form.year, form.monthIndex, form.endDay);
    if (!startDate || !endDate) {
      return null;
    }
    try {
      return buildDivin8TimelineTag(startDate, endDate);
    } catch {
      return null;
    }
  }, [form.endDay, form.monthIndex, form.startDay, form.year]);

  if (!open) {
    return null;
  }

  const fieldClassName = classNames(
    "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors",
    isLightTheme
      ? "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-accent-cyan"
      : "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-accent-cyan",
  );

  function handleGenerate() {
    if (!form.system) {
      setValidationError("Choose an astrology system before generating a timeline.");
      return;
    }

    const startDate = buildIsoDate(form.year, form.monthIndex, form.startDay);
    const endDate = buildIsoDate(form.year, form.monthIndex, form.endDay);

    try {
      const validated = validateDivin8TimelineRange(startDate, endDate);
      setValidationError(null);
      onGenerate({
        tag: validated.tag,
        system: form.system,
        startDate: validated.startDate,
        endDate: validated.endDate,
      });
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Timeline range is invalid.");
    }
  }

  return (
    <Divin8ModalPortal open={open} onClose={onClose} closeOnBackdropClick>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="divin8-timeline-modal-title"
        className={classNames(
          "w-full max-w-xl rounded-[28px] border p-6 shadow-[0_28px_90px_rgba(8,15,30,0.42),0_0_40px_rgba(99,102,241,0.18)] transition-all duration-200 ease-out animate-[fadeIn_180ms_ease-out]",
          isLightTheme ? "border-slate-200 bg-white text-slate-900" : "text-white",
        )}
        style={{
          ...(!isLightTheme ? darkChatStyles.panelElevated : undefined),
          transform: "scale(1)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={classNames("text-xs uppercase tracking-[0.18em]", isLightTheme ? "text-slate-400" : "text-white/45")}>
              Timeline Reading
            </p>
            <h3 id="divin8-timeline-modal-title" className="mt-1 text-xl font-semibold">Generate Timeline</h3>
            <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-500" : "text-white/60")}>
              Choose one astrology system and a same-month range up to 31 days. Divin8 will add a single timeline tag to the chat.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={classNames(
              "rounded-lg px-2 py-1 text-sm transition-colors",
              isLightTheme ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900" : "text-white/55 hover:bg-white/10 hover:text-white",
            )}
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <fieldset>
            <legend className={classNames("mb-2 text-xs font-semibold uppercase tracking-[0.14em]", isLightTheme ? "text-slate-500" : "text-white/55")}>
              Astrology System
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {DIVIN8_TIMELINE_SYSTEMS.map((system) => (
                <label
                  key={system}
                  className={classNames(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
                    form.system === system
                      ? isLightTheme
                        ? "border-cyan-300 bg-cyan-50 text-slate-900"
                        : "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
                      : isLightTheme
                        ? "border-slate-200 bg-slate-50 text-slate-700"
                        : "border-white/10 bg-white/[0.03] text-white/75",
                  )}
                >
                  <input
                    type="radio"
                    name="timeline-system"
                    className="h-4 w-4"
                    checked={form.system === system}
                    onChange={() => setForm((current) => ({ ...current, system }))}
                  />
                  <span>{system === "western" ? "Western Astrology" : "Vedic Astrology"}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-4">
            <label className="block sm:col-span-2">
              <span className={classNames("mb-2 block text-xs font-semibold uppercase tracking-[0.14em]", isLightTheme ? "text-slate-500" : "text-white/55")}>
                Month
              </span>
              <select
                value={form.monthIndex}
                onChange={(event) => setForm((current) => ({ ...current, monthIndex: event.target.value }))}
                className={fieldClassName}
              >
                {MONTH_OPTIONS.map((month, index) => (
                  <option key={month} value={String(index)}>
                    {month}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={classNames("mb-2 block text-xs font-semibold uppercase tracking-[0.14em]", isLightTheme ? "text-slate-500" : "text-white/55")}>
                Start Day
              </span>
              <input
                type="number"
                min="1"
                max="31"
                value={form.startDay}
                onChange={(event) => setForm((current) => ({ ...current, startDay: event.target.value }))}
                className={fieldClassName}
                placeholder="1"
              />
            </label>

            <label className="block">
              <span className={classNames("mb-2 block text-xs font-semibold uppercase tracking-[0.14em]", isLightTheme ? "text-slate-500" : "text-white/55")}>
                End Day
              </span>
              <input
                type="number"
                min="1"
                max="31"
                value={form.endDay}
                onChange={(event) => setForm((current) => ({ ...current, endDay: event.target.value }))}
                className={fieldClassName}
                placeholder="30"
              />
            </label>
          </div>

          <label className="block max-w-[180px]">
            <span className={classNames("mb-2 block text-xs font-semibold uppercase tracking-[0.14em]", isLightTheme ? "text-slate-500" : "text-white/55")}>
              Year
            </span>
            <input
              type="number"
              min="1900"
              max="9999"
              value={form.year}
              onChange={(event) => setForm((current) => ({ ...current, year: event.target.value.slice(0, 4) }))}
              className={fieldClassName}
              placeholder="2026"
            />
          </label>

          <div
            className={classNames(
              "rounded-2xl border px-4 py-3 text-sm",
              isLightTheme ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-indigo-400/30 bg-indigo-500/10 text-indigo-100",
            )}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">Generated Tag</div>
            <div className="mt-1 font-medium">{previewTag ?? "Choose a valid same-month date range to preview the tag."}</div>
          </div>

          {validationError || errorMessage ? (
            <div
              className={classNames(
                "rounded-lg px-3 py-2 text-xs",
                isLightTheme ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-rose-500/30 bg-rose-500/10 text-rose-100",
              )}
              role="alert"
            >
              {validationError || errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={classNames(
                "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                isLightTheme ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-white/10 text-white hover:bg-white/15",
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
            >
              Generate Timeline
            </button>
          </div>
        </div>
      </div>
    </Divin8ModalPortal>
  );
}
