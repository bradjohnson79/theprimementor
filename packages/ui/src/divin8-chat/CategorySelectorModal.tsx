import { useEffect, useState } from "react";
import {
  DIVIN8_CATEGORY_GROUPS,
  getDivin8CategoriesByGroup,
  getDivin8CategoryImageHelperText,
  parseDivin8CategoryTags,
  type Divin8Category,
} from "@wisdom/utils";
import Divin8ModalPortal from "./Divin8ModalPortal";
import { classNames, darkChatStyles } from "./utils";

interface CategorySelectorModalProps {
  open: boolean;
  isLightTheme: boolean;
  inputText: string;
  onClose: () => void;
  onAddCategories: (tags: string[]) => void;
}

export default function CategorySelectorModal({
  open,
  isLightTheme,
  inputText,
  onClose,
  onAddCategories,
}: CategorySelectorModalProps) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSelectedTags(new Set());
      return;
    }
    setSelectedTags(new Set(parseDivin8CategoryTags(inputText).tags));
  }, [inputText, open]);

  if (!open) {
    return null;
  }

  function toggleCategory(category: Divin8Category) {
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(category.tag)) {
        next.delete(category.tag);
      } else {
        next.add(category.tag);
      }
      return next;
    });
  }

  function handleAddCategories() {
    if (selectedTags.size === 0) {
      return;
    }
    onAddCategories([...selectedTags]);
  }

  return (
    <Divin8ModalPortal open={open} onClose={onClose} closeOnBackdropClick>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="divin8-categories-modal-title"
        className={classNames(
          "flex max-h-[62vh] w-full max-w-md flex-col rounded-[22px] border p-4 shadow-[0_28px_90px_rgba(8,15,30,0.42),0_0_40px_rgba(34,211,238,0.14)] transition-all duration-200 ease-out animate-[fadeIn_180ms_ease-out]",
          isLightTheme ? "border-slate-200 bg-white text-slate-900" : "text-white",
        )}
        style={{
          ...(!isLightTheme ? darkChatStyles.panelElevated : undefined),
          transform: "scale(1)",
        }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <p className={classNames("text-xs uppercase tracking-[0.18em]", isLightTheme ? "text-slate-400" : "text-white/45")}>
              Reading Systems
            </p>
            <h3 id="divin8-categories-modal-title" className="mt-1 text-lg font-semibold">Select Reading Categories</h3>
            <p className={classNames("mt-1 text-xs", isLightTheme ? "text-slate-500" : "text-white/60")}>
              Choose one or more metaphysical systems for Divin8 Chat to include in your reading.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close categories"
            title="Close"
            className={classNames(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
              isLightTheme ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900" : "text-white/55 hover:bg-white/10 hover:text-white",
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-scroll pr-2" style={{ scrollbarGutter: "stable" }}>
          {DIVIN8_CATEGORY_GROUPS.map((group) => (
            <fieldset key={group.id}>
              <legend className={classNames("mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]", isLightTheme ? "text-slate-500" : "text-white/55")}>
                {group.title}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {getDivin8CategoriesByGroup(group.id).map((category) => {
                  const checked = selectedTags.has(category.tag);
                  const helperText = getDivin8CategoryImageHelperText(category);
                  return (
                    <label
                      key={category.tag}
                      className={classNames(
                        "flex cursor-pointer items-start gap-2.5 rounded-xl border px-2.5 py-2 text-xs transition-colors",
                        checked
                          ? isLightTheme
                            ? "border-cyan-300 bg-cyan-50 text-slate-900"
                            : "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
                          : isLightTheme
                            ? "border-slate-200 bg-slate-50 text-slate-700"
                            : "border-white/10 bg-white/[0.03] text-white/75",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5"
                        checked={checked}
                        onChange={() => toggleCategory(category)}
                      />
                      <span>
                        <span className="block font-medium">{category.label}</span>
                        <span className={classNames("block text-xs", isLightTheme ? "text-slate-500" : "text-white/45")}>
                          {category.tag}
                          {helperText ? ` - ${helperText}` : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="mt-4 flex shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={classNames(
              "rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors",
              isLightTheme ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-white/10 text-white hover:bg-white/15",
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAddCategories}
            disabled={selectedTags.size === 0}
            className={classNames(
              "rounded-xl px-3.5 py-1.5 text-sm font-semibold transition",
              selectedTags.size === 0
                ? isLightTheme
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : "cursor-not-allowed bg-white/10 text-white/35"
                : "bg-accent-cyan text-slate-950 hover:brightness-110",
            )}
          >
            Add Categories
          </button>
        </div>
      </div>
    </Divin8ModalPortal>
  );
}
