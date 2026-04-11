import { useAuth } from "@clerk/react";
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import {
  Divin8ChatPage,
  classNames,
  type Divin8ChatTier,
  type UseDivin8ChatReturn,
} from "@wisdom/ui/divin8-chat";
import ChatToolModal from "../components/divin8-chat/ChatToolModal";
import Divin8Guide from "../components/divin8-chat/Divin8Guide";
import InsightTimelinePanel from "../components/divin8-chat/InsightTimelinePanel";
import PipelineDebugPanel from "../components/divin8-chat/PipelineDebugPanel";
import TierToggle from "../components/divin8-chat/TierToggle";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { uploadImageAsset } from "../lib/uploadImageAsset";

const chatApi = {
  get: api.get,
  post: api.post,
  del: api.delete,
  downloadBlobPost: api.downloadBlobPost,
};

export default function Divin8Chat() {
  const { getToken } = useAuth();
  const { resolvedTheme, settings } = useAdminSettings();
  const { t } = useI18n();
  const isLightTheme = resolvedTheme === "light";

  const [tier, setTier] = useState<Divin8ChatTier>("seeker");
  const [activeTool, setActiveTool] = useState<"guide" | "timeline" | "debug" | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleTranscriptRef = useRef<(text: string) => void>(() => {});
  const speech = useSpeechRecognition((text) => handleTranscriptRef.current(text));

  const handleImageChange = useCallback(async (event: ChangeEvent<HTMLInputElement>, chat: UseDivin8ChatReturn) => {
    const file = event.target.files?.[0];
    if (!file) return;
    chat.setImageError(null);
    chat.setIsUploadingImage(true);
    try {
      if (chat.imagePreviewUrl) URL.revokeObjectURL(chat.imagePreviewUrl);
      const token = await getToken();
      const uploaded = await uploadImageAsset(file, token);
      chat.setImageRef(uploaded.imageAssetId);
      chat.setImageName(uploaded.fileName);
      chat.setImagePreviewUrl(uploaded.previewUrl);
    } catch (err) {
      chat.setImageError(err instanceof Error ? err.message : "Image upload failed.");
      chat.clearImageSelection();
    } finally {
      chat.setIsUploadingImage(false);
      event.target.value = "";
    }
  }, [getToken]);

  const headerActions = useCallback((chat: UseDivin8ChatReturn) => {
    handleTranscriptRef.current = (text: string) => {
      const current = chat.inputText;
      chat.setInputText((current ? `${current.trim()} ${text}` : text).trim());
    };

    return (
      <>
        <TierToggle value={tier} onChange={setTier} isLightTheme={isLightTheme} />
        <div className={classNames("mx-0.5 h-5 w-px", isLightTheme ? "bg-slate-200" : "bg-white/10")} />
        <button
          type="button"
          onClick={() => setActiveTool("guide")}
          title={t("divin8.tools.guide")}
          aria-label={t("divin8.tools.guide")}
          className={classNames(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
            isLightTheme ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700" : "text-white/50 hover:bg-white/10 hover:text-white/80",
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
            <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setActiveTool("timeline")}
          title={t("divin8.tools.timeline")}
          aria-label={t("divin8.tools.timeline")}
          className={classNames(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
            isLightTheme ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700" : "text-white/50 hover:bg-white/10 hover:text-white/80",
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportMenu((c) => !c)}
            disabled={!chat.activeThreadId || chat.messages.length === 0 || chat.isLoadingThread}
            title={chat.isExporting ? t("divin8.window.exporting") : t("divin8.tools.export")}
            aria-label={chat.isExporting ? t("divin8.window.exporting") : t("divin8.tools.export")}
            className={classNames(
              "flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
              !chat.activeThreadId || chat.messages.length === 0 || chat.isLoadingThread
                ? "pointer-events-none opacity-30"
                : isLightTheme
                  ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  : "text-white/50 hover:bg-white/10 hover:text-white/80",
            )}
          >
            {chat.isExporting ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            )}
          </button>
          {showExportMenu ? (
            <div
              className={classNames(
                "absolute right-0 top-[calc(100%+4px)] z-20 min-w-[130px] rounded-lg border p-1 shadow-xl",
                isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950",
              )}
            >
              <button
                type="button"
                onClick={() => { setShowExportMenu(false); chat.handleExport("docx"); }}
                className={classNames(
                  "block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                  isLightTheme ? "text-slate-700 hover:bg-slate-100" : "text-white hover:bg-white/10",
                )}
              >
                {t("divin8.window.exportDoc")}
              </button>
              <button
                type="button"
                onClick={() => { setShowExportMenu(false); chat.handleExport("pdf"); }}
                className={classNames(
                  "block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                  isLightTheme ? "text-slate-700 hover:bg-slate-100" : "text-white hover:bg-white/10",
                )}
              >
                {t("divin8.window.exportPdf")}
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setActiveTool("debug")}
          title={t("divin8.tools.debug")}
          aria-label={t("divin8.tools.debug")}
          className={classNames(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
            isLightTheme ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700" : "text-white/50 hover:bg-white/10 hover:text-white/80",
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
            <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
          </svg>
        </button>
      </>
    );
  }, [handleTranscriptRef, isLightTheme, showExportMenu, t, tier]);

  const toolModals = useCallback((chat: UseDivin8ChatReturn) => (
    <>
      <ChatToolModal
        title={t("divin8.tools.guide")}
        open={activeTool === "guide"}
        onClose={() => setActiveTool(null)}
        isLightTheme={isLightTheme}
      >
        <Divin8Guide isLightTheme={isLightTheme} />
      </ChatToolModal>

      <ChatToolModal
        title={t("divin8.tools.timeline")}
        open={activeTool === "timeline"}
        onClose={() => setActiveTool(null)}
        isLightTheme={isLightTheme}
        variant="drawer"
      >
        <InsightTimelinePanel isLightTheme={isLightTheme} events={chat.timelineEvents} />
      </ChatToolModal>

      <ChatToolModal
        title={t("divin8.tools.debug")}
        open={activeTool === "debug"}
        onClose={() => setActiveTool(null)}
        isLightTheme={isLightTheme}
      >
        <PipelineDebugPanel meta={chat.debugMeta} isLightTheme={isLightTheme} title={t("divin8.debug.title")} />
      </ChatToolModal>
    </>
  ), [activeTool, isLightTheme, t]);

  return (
    <Divin8ChatPage
      config={{
        basePath: "/divin8",
        getToken,
        api: chatApi,
        tier,
        language: settings.language,
      }}
      isLightTheme={isLightTheme}
      headerActions={headerActions}
      toolModals={toolModals}
      speech={{
        isSupported: speech.isSupported,
        status: speech.status,
        error: speech.error,
        toggle: speech.toggle,
        buttonTitle: !speech.isSupported
          ? t("divin8.composer.unsupportedSpeech")
          : (speech.error || t("divin8.composer.micReady")),
      }}
      imageUpload={{
        onImageChange: handleImageChange,
      }}
    />
  );
}
