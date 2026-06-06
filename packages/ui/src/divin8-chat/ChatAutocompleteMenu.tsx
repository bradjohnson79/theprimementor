import { getDivin8CategoryImageHelperText } from "@wisdom/utils";
import { classNames } from "./utils";
import type { Divin8AutocompleteSuggestion, Divin8AutocompleteTrigger } from "./useDivin8Autocomplete";

interface ChatAutocompleteMenuProps {
  trigger: Divin8AutocompleteTrigger | null;
  suggestions: Divin8AutocompleteSuggestion[];
  activeIndex: number;
  isLightTheme: boolean;
  onSelect: (token: string) => void;
}

export default function ChatAutocompleteMenu({
  trigger,
  suggestions,
  activeIndex,
  isLightTheme,
  onSelect,
}: ChatAutocompleteMenuProps) {
  if (!trigger || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={classNames(
        "mx-2 mb-1 rounded-2xl border p-1",
        isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950/95",
      )}
    >
      {suggestions.map((suggestion, index) => {
        const token = suggestion.token;
        const primary = token;
        const secondary = suggestion.kind === "profile"
          ? suggestion.profile.fullName
          : suggestion.category.label;
        const helperText = suggestion.kind === "category"
          ? getDivin8CategoryImageHelperText(suggestion.category)
          : null;

        return (
          <button
            key={suggestion.kind === "profile" ? suggestion.profile.id : suggestion.category.tag}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(token);
            }}
            className={classNames(
              "block w-full rounded-xl px-3 py-2 text-left transition-colors",
              index === activeIndex
                ? isLightTheme
                  ? "bg-slate-100"
                  : "bg-white/10"
                : "",
            )}
          >
            <div className="text-sm font-medium text-accent-cyan">{primary}</div>
            <div className={classNames("text-xs", isLightTheme ? "text-slate-500" : "text-white/50")}>
              {secondary}
              {helperText ? ` - ${helperText}` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
