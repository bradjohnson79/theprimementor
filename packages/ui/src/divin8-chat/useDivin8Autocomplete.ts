import { useEffect, useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import {
  filterDivin8CategorySuggestions,
  type Divin8Category,
} from "@wisdom/utils";
import type { Divin8Profile } from "./types";

export type Divin8AutocompleteTrigger = "@" | "#";

export type Divin8AutocompleteSuggestion =
  | { kind: "profile"; profile: Divin8Profile; token: string }
  | { kind: "category"; category: Divin8Category; token: string };

interface ActiveAutocompleteMatch {
  trigger: Divin8AutocompleteTrigger;
  query: string;
  start: number;
  end: number;
}

interface UseDivin8AutocompleteParams {
  inputText: string;
  profiles: Divin8Profile[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
}

function shouldLogDivin8AutocompletePerf() {
  return typeof window !== "undefined"
    && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
}

function getActiveAutocompleteMatch(inputText: string, selectionStart: number): ActiveAutocompleteMatch | null {
  const beforeCursor = inputText.slice(0, selectionStart);
  const profileMatch = beforeCursor.match(/(^|\s)(@[A-Za-z0-9]*)$/);
  if (profileMatch?.[2]) {
    return {
      trigger: "@",
      query: profileMatch[2],
      start: selectionStart - profileMatch[2].length,
      end: selectionStart,
    };
  }

  const categoryMatch = beforeCursor.match(/(^|\s)(#[A-Za-z0-9 ]*)$/);
  if (categoryMatch?.[2]) {
    return {
      trigger: "#",
      query: categoryMatch[2],
      start: selectionStart - categoryMatch[2].length,
      end: selectionStart,
    };
  }

  return null;
}

export function useDivin8Autocomplete({
  inputText,
  profiles,
  textareaRef,
  onInputChange,
}: UseDivin8AutocompleteParams) {
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);

  const activeMatch = useMemo(() => {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? inputText.length;
    return getActiveAutocompleteMatch(inputText, selectionStart);
  }, [inputText, textareaRef]);

  const suggestions = useMemo<Divin8AutocompleteSuggestion[]>(() => {
    const startedAt = performance.now();
    const finish = (result: Divin8AutocompleteSuggestion[]) => {
      if (shouldLogDivin8AutocompletePerf()) {
        console.debug("[Divin8 perf] autocomplete parsing", `${Math.round(performance.now() - startedAt)}ms`, {
          trigger: activeMatch?.trigger ?? null,
          suggestions: result.length,
        });
      }
      return result;
    };
    if (!activeMatch || activeMatch.query === dismissedQuery) {
      return finish([]);
    }

    if (activeMatch.trigger === "@") {
      const normalized = activeMatch.query.slice(1).toLowerCase();
      return finish(profiles
        .filter((profile) => (
          !normalized
          || profile.tag.slice(1).toLowerCase().startsWith(normalized)
          || profile.fullName.toLowerCase().includes(normalized)
        ))
        .slice(0, 6)
        .map((profile) => ({ kind: "profile", profile, token: profile.tag })));
    }

    return finish(filterDivin8CategorySuggestions(activeMatch.query)
      .map((category) => ({ kind: "category", category, token: category.tag })));
  }, [activeMatch, dismissedQuery, profiles]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
    setDismissedQuery(null);
  }, [activeMatch?.query]);

  function applySuggestion(token: string) {
    const textarea = textareaRef.current;
    if (!textarea || !activeMatch) {
      return;
    }

    const tokenEnd = (() => {
      let index = activeMatch.end;
      while (index < inputText.length && /[A-Za-z0-9]/.test(inputText[index] ?? "")) {
        index += 1;
      }
      return index;
    })();
    const suffix = inputText.slice(tokenEnd).startsWith(" ") ? "" : " ";
    const nextValue = `${inputText.slice(0, activeMatch.start)}${token}${suffix}${inputText.slice(tokenEnd)}`;
    const nextCaret = activeMatch.start + token.length + suffix.length;

    onInputChange(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleAutocompleteKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length === 0 || !activeMatch) {
      return false;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => (current + 1) % suggestions.length);
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
      return true;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      applySuggestion(suggestions[activeSuggestionIndex]?.token ?? suggestions[0]!.token);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissedQuery(activeMatch.query);
      setActiveSuggestionIndex(0);
      return true;
    }

    return false;
  }

  return {
    trigger: activeMatch?.trigger ?? null,
    suggestions,
    activeSuggestionIndex,
    applySuggestion,
    handleAutocompleteKeyDown,
  };
}
