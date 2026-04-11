import { useEffect, useRef, type ChangeEvent, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import type { SpeechRecognitionStatus } from "../../hooks/useSpeechRecognition";
import { useI18n } from "../../i18n";
import { classNames } from "./utils";

interface ChatComposerProps {
  inputText: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  imageName: string | null;
  imagePreviewUrl: string | null;
  imageError: string | null;
  disabled: boolean;
  isListening: boolean;
  isSpeechSupported: boolean;
  speechStatus: SpeechRecognitionStatus;
  speechButtonTitle: string;
  onToggleSpeech: () => void;
  isUploadingImage: boolean;
  isLightTheme: boolean;
  blockMessage: string | null;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

export default function ChatComposer({
  inputText,
  onInputChange,
  onSubmit,
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
  isUploadingImage,
  isLightTheme,
  blockMessage,
  inputRef,
}: ChatComposerProps) {
  const { t } = useI18n();
  const localInputRef = useRef<HTMLTextAreaElement | null>(null);

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

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
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

  return (
    <form onSubmit={onSubmit} className="space-y-2" aria-label={t("divin8.composer.formLabel")}>
      {imagePreviewUrl ? (
        <div
          className={classNames(
            "flex items-center gap-3 rounded-xl border px-3 py-2",
            isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5",
          )}
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
            <img src={imagePreviewUrl} alt="Selected upload" className="h-full w-full object-cover" />
          </div>
          <p className="min-w-0 flex-1 truncate text-xs font-medium">
            {imageName || t("divin8.composer.uploadedImage")}
          </p>
          <button
            type="button"
            onClick={onRemoveImage}
            aria-label={t("divin8.composer.remove")}
            className={classNames(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
              isLightTheme ? "text-slate-500 hover:bg-slate-200 hover:text-slate-900" : "text-white/50 hover:bg-white/10 hover:text-white",
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      <div
        className={classNames(
          "rounded-2xl border",
          isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-[rgba(10,15,30,0.7)]",
        )}
      >
        <textarea
          ref={setRefs}
          value={inputText}
          disabled={disabled}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("divin8.composer.placeholder")}
          aria-label={t("divin8.composer.placeholder")}
          className={classNames(
            "max-h-[10.5rem] min-h-[2.5rem] w-full resize-none bg-transparent px-3 pt-2.5 pb-0 text-sm leading-6 outline-none",
            isLightTheme ? "text-slate-900 placeholder:text-slate-400" : "text-white placeholder:text-white/35",
          )}
        />

        <div className="flex items-center gap-1 px-2 pb-2 pt-1">
          <label
            className={classNames(
              "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors focus-within:ring-2 focus-within:ring-accent-cyan/70",
              disabled || isUploadingImage
                ? "pointer-events-none opacity-40"
                : isLightTheme
                  ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  : "text-white/50 hover:bg-white/10 hover:text-white/80",
            )}
            title={isUploadingImage ? t("divin8.composer.uploading") : t("divin8.composer.image")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="9" cy="10" r="1.5" />
              <path d="M21 15l-4.5-4.5a1 1 0 0 0-1.4 0L8 17" />
            </svg>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={onImageChange}
              disabled={disabled || isUploadingImage}
              aria-label={t("divin8.composer.image")}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={onToggleSpeech}
            disabled={disabled || !isSpeechSupported}
            title={speechButtonTitle}
            aria-label={speechButtonTitle}
            className={classNames(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
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
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M6.5 11a5.5 5.5 0 0 0 11 0" />
              <path d="M12 16.5V21" />
              <path d="M9 21h6" />
            </svg>
          </button>

          <div className="flex-1" />

          <button
            type="submit"
            disabled={!canSend}
            aria-label={t("divin8.composer.send")}
            className={classNames(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
              canSend
                ? "bg-accent-cyan text-slate-950 hover:brightness-110"
                : isLightTheme
                  ? "text-slate-300"
                  : "text-white/20",
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]" aria-hidden="true">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {blockMessage ? (
        <div
          className={classNames(
            "rounded-lg px-3 py-2 text-xs",
            isLightTheme ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-amber-500/30 bg-amber-500/10 text-amber-100",
          )}
        >
          {blockMessage}
        </div>
      ) : null}

      {imageError ? (
        <div
          className={classNames(
            "rounded-lg px-3 py-2 text-xs",
            isLightTheme ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-rose-500/30 bg-rose-500/10 text-rose-100",
          )}
          role="alert"
        >
          {imageError}
        </div>
      ) : null}
    </form>
  );
}
