import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type RefObject, type UIEvent } from "react";
import { extractDivin8ProfileTags, extractDivin8TimelineTags } from "@wisdom/utils";
import type { Divin8Profile, Divin8TimelineDraft } from "./types";
import { classNames, darkChatStyles } from "./utils";

type SpeechRecognitionStatus = "idle" | "listening" | "error" | "disabled";

interface ChatComposerProps {
  inputText: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  profiles: Divin8Profile[];
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  imageName: string | null;
  imagePreviewUrl: string | null;
  imageError: string | null;
  disabled: boolean;
  isSpeechSupported: boolean;
  speechStatus: SpeechRecognitionStatus;
  speechButtonTitle: string;
  onToggleSpeech: () => void;
  onOpenTimeline: () => void;
  isUploadingImage: boolean;
  isLightTheme: boolean;
  blockMessage: string | null;
  submitError: string | null;
  activeTimeline: Divin8TimelineDraft | null;
  showTimelineButton: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
}

export default function ChatComposer({
  inputText,
  onInputChange,
  onSubmit,
  profiles,
  onImageChange,
  onRemoveImage,
  imageName,
  imagePreviewUrl,
  imageError,
  disabled,
  isSpeechSupported,
  speechStatus,
  speechButtonTitle,
  onToggleSpeech,
  onOpenTimeline,
  isUploadingImage,
  isLightTheme,
  blockMessage,
  submitError,
  activeTimeline,
  showTimelineButton,
  inputRef,
  placeholder = "Share what you want guidance on...",
}: ChatComposerProps) {
  const localInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  function setRefs(element: HTMLTextAreaElement | null) {
    localInputRef.current = element;
    if (inputRef) {
      inputRef.current = element;
    }
  }

  useEffect(() => {
    const textarea = localInputRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight || "24") || 24;
    const paddingTop = Number.parseFloat(styles.paddingTop || "0") || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom || "0") || 0;
    const maxHeight = lineHeight * 6 + paddingTop + paddingBottom;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [inputText]);

  const activeTagMatch = useMemo(() => {
    const textarea = localInputRef.current;
    const selectionStart = textarea?.selectionStart ?? inputText.length;
    const beforeCursor = inputText.slice(0, selectionStart);
    const match = beforeCursor.match(/(^|\s)(@[A-Za-z0-9]*)$/);
    if (!match) {
      return null;
    }
    return {
      query: match[2],
      start: selectionStart - match[2].length,
      end: selectionStart,
    };
  }, [inputText]);

  const profileSuggestions = useMemo(() => {
    if (!activeTagMatch || !activeTagMatch.query.startsWith("@")) {
      return [];
    }
    const normalized = activeTagMatch.query.slice(1).toLowerCase();
    const matches = profiles.filter((profile) => (
      !normalized
      || profile.tag.slice(1).toLowerCase().startsWith(normalized)
      || profile.fullName.toLowerCase().includes(normalized)
    ));
    return matches.slice(0, 6);
  }, [activeTagMatch, profiles]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [activeTagMatch?.query]);

  function applyProfileSuggestion(tag: string) {
    const textarea = localInputRef.current;
    if (!textarea || !activeTagMatch) {
      return;
    }
    const tokenEnd = (() => {
      let index = activeTagMatch.end;
      while (index < inputText.length && /[A-Za-z0-9]/.test(inputText[index] ?? "")) {
        index += 1;
      }
      return index;
    })();
    const suffix = inputText.slice(tokenEnd).startsWith(" ") ? "" : " ";
    const nextValue = `${inputText.slice(0, activeTagMatch.start)}${tag}${suffix}${inputText.slice(tokenEnd)}`;
    const nextCaret = activeTagMatch.start + tag.length + suffix.length;
    onInputChange(nextValue);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleTextareaScroll(_event: UIEvent<HTMLTextAreaElement>) {}

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (profileSuggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestionIndex((current) => (current + 1) % profileSuggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestionIndex((current) => (current - 1 + profileSuggestions.length) % profileSuggestions.length);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        applyProfileSuggestion(profileSuggestions[activeSuggestionIndex]?.tag ?? profileSuggestions[0]!.tag);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveSuggestionIndex(0);
        return;
      }
    }

    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (disabled || (!inputText.trim() && !imagePreviewUrl)) {
      return;
    }
    event.currentTarget.form?.requestSubmit();
  }

  const canSend = !disabled && (inputText.trim().length > 0 || !!imagePreviewUrl);
  const detectedTags = extractDivin8ProfileTags(inputText);
  const detectedTimelineTags = extractDivin8TimelineTags(inputText);

  return (
    <form onSubmit={onSubmit} className="space-y-2" aria-label="Divin8 chat composer">
      {imagePreviewUrl ? (
        <div
          className={classNames(
            "flex items-center gap-3 rounded-xl border px-3 py-2",
            isLightTheme ? "border-slate-200 bg-slate-50" : "",
          )}
          style={!isLightTheme ? darkChatStyles.bubbleSoft : undefined}
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
            <img src={imagePreviewUrl} alt="Selected upload" className="h-full w-full object-cover" />
          </div>
          <p className="min-w-0 flex-1 truncate text-xs font-medium">{imageName || "Uploaded image"}</p>
          <button
            type="button"
            onClick={onRemoveImage}
            aria-label="Remove image"
            className={classNames(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
              isLightTheme ? "text-slate-500 hover:bg-slate-200 hover:text-slate-900" : "text-white/50 hover:bg-white/10 hover:text-white",
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-label="Remove image" role="img">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      <div
        className={classNames("relative rounded-2xl border", isLightTheme ? "border-slate-200 bg-white" : "")}
        style={!isLightTheme ? darkChatStyles.panelElevated : undefined}
      >
        <textarea
          ref={setRefs}
          value={inputText}
          disabled={disabled}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleTextareaScroll}
          placeholder={placeholder}
          aria-label={placeholder}
          className={classNames(
            "relative z-[1] max-h-[10.5rem] min-h-[2.5rem] w-full resize-none bg-transparent px-3 pt-2.5 pb-0 text-sm leading-6 outline-none caret-accent-cyan",
            isLightTheme
              ? "text-slate-900 placeholder:text-slate-400"
              : "text-white placeholder:text-white/35",
          )}
        />

        {profileSuggestions.length > 0 ? (
          <div
            className={classNames(
              "mx-2 mb-1 rounded-2xl border p-1",
              isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950/95",
            )}
          >
            {profileSuggestions.map((profile, index) => (
              <button
                key={profile.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyProfileSuggestion(profile.tag);
                }}
                className={classNames(
                  "block w-full rounded-xl px-3 py-2 text-left transition-colors",
                  index === activeSuggestionIndex
                    ? isLightTheme
                      ? "bg-slate-100"
                      : "bg-white/10"
                    : "",
                )}
              >
                <div className="text-sm font-medium text-accent-cyan">{profile.tag}</div>
                <div className={classNames("text-xs", isLightTheme ? "text-slate-500" : "text-white/50")}>
                  {profile.fullName}
                </div>
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-1 px-2 pb-2 pt-1">
          <label
            className={classNames(
              "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors focus-within:ring-2 focus-within:ring-accent-cyan/70",
              disabled || isUploadingImage
                ? "pointer-events-none opacity-40"
                : isLightTheme
                  ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  : "text-white/50 hover:bg-white/10 hover:text-white/80",
            )}
            title={isUploadingImage ? "Uploading image..." : "Attach image"}
            style={{ width: "28px", height: "28px" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              style={{ width: "16px", height: "16px" }}
              aria-label="Attach image"
              role="img"
            >
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="9" cy="10" r="1.5" />
              <path d="M21 15l-4.5-4.5a1 1 0 0 0-1.4 0L8 17" />
            </svg>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={onImageChange}
              disabled={disabled || isUploadingImage}
              aria-label="Attach image"
              style={{ display: "none" }}
            />
          </label>

          <div className="flex-1" />

          {showTimelineButton ? (
            <button
              type="button"
              onClick={onOpenTimeline}
              disabled={disabled}
              title="Timeline reading"
              aria-label="Timeline reading"
              className={classNames(
                "inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
                disabled
                  ? "pointer-events-none opacity-40"
                  : activeTimeline
                    ? isLightTheme
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-indigo-400/15 text-indigo-200 shadow-[0_0_0_1px_rgba(129,140,248,0.25)]"
                    : isLightTheme
                      ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      : "text-white/50 hover:bg-white/10 hover:text-white/80",
              )}
              style={{ width: "28px", height: "28px" }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                style={{ width: "16px", height: "16px" }}
                aria-label="Timeline reading"
                role="img"
              >
                <rect x="3" y="4" width="18" height="17" rx="2.5" />
                <path d="M8 2v4M16 2v4M3 9h18" />
                <path d="M8 13h3M13 13h3M8 17h3" />
              </svg>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onToggleSpeech}
            disabled={disabled || !isSpeechSupported}
            title={speechButtonTitle}
            aria-label={speechButtonTitle}
            className={classNames(
              "inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
              disabled || !isSpeechSupported
                ? "pointer-events-none opacity-40"
                : speechStatus === "listening"
                  ? "bg-accent-cyan text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.3)] animate-pulse"
                  : speechStatus === "error"
                    ? isLightTheme
                      ? "text-rose-600 hover:bg-rose-50"
                      : "text-rose-300 hover:bg-rose-500/10"
                    : isLightTheme
                      ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      : "text-white/50 hover:bg-white/10 hover:text-white/80",
            )}
            style={{ width: "28px", height: "28px" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              style={{ width: "16px", height: "16px" }}
              aria-label="Speech input"
              role="img"
            >
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M6.5 11a5.5 5.5 0 0 0 11 0" />
              <path d="M12 16.5V21" />
              <path d="M9 21h6" />
            </svg>
          </button>

          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            className={classNames(
              "inline-flex h-8 w-8 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
              canSend
                ? "bg-accent-cyan text-slate-950 hover:brightness-110"
                : isLightTheme
                  ? "text-slate-300"
                  : "text-white/20",
            )}
            style={{ width: "32px", height: "32px" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              style={{ width: "16px", height: "16px" }}
              aria-label="Send"
              role="img"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {detectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-1">
          {detectedTags.map((tag) => (
            <span
              key={tag}
              className={classNames(
                "rounded-full px-2 py-1 text-[11px] font-medium",
                isLightTheme ? "bg-amber-100 text-amber-700" : "bg-amber-400/15 text-amber-200",
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {detectedTimelineTags.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-1">
          {detectedTimelineTags.map((tag) => (
            <span
              key={tag}
              className={classNames(
                "rounded-full px-2 py-1 text-[11px] font-medium",
                isLightTheme ? "bg-indigo-100 text-indigo-700" : "bg-indigo-400/15 text-indigo-200",
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {blockMessage ? (
        <div className={classNames("rounded-lg px-3 py-2 text-xs", isLightTheme ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-amber-500/30 bg-amber-500/10 text-amber-100")}>
          {blockMessage}
        </div>
      ) : null}

      {submitError ? (
        <div
          className={classNames("rounded-lg px-3 py-2 text-xs", isLightTheme ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-rose-500/30 bg-rose-500/10 text-rose-100")}
          role="alert"
        >
          {submitError}
        </div>
      ) : null}

      {imageError ? (
        <div
          className={classNames("rounded-lg px-3 py-2 text-xs", isLightTheme ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-rose-500/30 bg-rose-500/10 text-rose-100")}
          role="alert"
        >
          {imageError}
        </div>
      ) : null}
    </form>
  );
}
