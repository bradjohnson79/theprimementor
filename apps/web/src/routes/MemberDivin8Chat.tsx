import { useAuth } from "@clerk/react";
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { Navigate } from "react-router-dom";
import { Divin8ChatPage, classNames, type Divin8Capabilities, type UseDivin8ChatReturn } from "@wisdom/ui/divin8-chat";
import MemberChatToolModal from "../components/divin8-chat/MemberChatToolModal";
import MemberGuide from "../components/divin8-chat/MemberGuide";
import MemberTimelinePanel from "../components/divin8-chat/MemberTimelinePanel";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { api } from "../lib/api";
import { uploadImageAsset } from "../lib/uploadImageAsset";

const chatApi = {
  get: api.get,
  post: api.post,
  del: api.delete,
  downloadBlobPost: api.downloadBlobPost,
};

export default function MemberDivin8Chat() {
  const { getToken } = useAuth();
  const { user: dbUser, isLoading, tierState } = useCurrentUser();
  const handleTranscriptRef = useRef<(text: string) => void>(() => {});
  const speech = useSpeechRecognition((text) => handleTranscriptRef.current(text));

  const memberTier = tierState;
  const isInitiate = dbUser?.member?.capabilities.unlimitedChat === true;
  const usage = dbUser?.member?.usage;
  const capabilities: Divin8Capabilities = {
    showDebug: false,
    showTimeline: false,
    showExport: false,
    showRegenerate: false,
    showTierToggle: false,
  };

  const [activeTool, setActiveTool] = useState<"guide" | "timeline" | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

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

  if (isLoading || memberTier === "loading") {
    return (
      <div className="flex min-h-[100dvh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/70" />
      </div>
    );
  }

  if (memberTier === "free") {
    return <Navigate to="/dashboard" replace />;
  }

  const headerActions = (chat: UseDivin8ChatReturn, currentCapabilities: Divin8Capabilities) => {
    handleTranscriptRef.current = (text: string) => {
      const current = chat.inputText;
      chat.setInputText((current ? `${current.trim()} ${text}` : text).trim());
    };

    return (
      <>
        {/* Tier badge */}
        <div
          className={classNames(
            "flex h-7 items-center gap-2 rounded-full border px-2.5 text-[10px] font-medium",
            isInitiate
              ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
          )}
        >
          <span
            className={classNames(
              "inline-block h-1.5 w-1.5 rounded-full",
              isInitiate ? "bg-purple-400" : "bg-cyan-400",
            )}
          />
          {isInitiate ? "Initiate" : "Seeker"}
        </div>

        {/* Usage / unlimited badge */}
        {!isInitiate ? (
          <span className="flex h-7 items-center rounded-full border border-white/10 bg-white/5 px-2.5 text-[10px] font-medium text-white/65">
            {`${usage?.used ?? 0} / ${usage?.limit ?? 150}`}
          </span>
        ) : (
          <span className="flex h-7 items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 text-[10px] font-medium text-purple-300">
            Unlimited
          </span>
        )}

        <div className="mx-0.5 h-5 w-px bg-white/10" />

        {/* Guide button */}
        <button
          type="button"
          onClick={() => setActiveTool("guide")}
          title="Guide"
          aria-label="Guide"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
            <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />
          </svg>
        </button>

        {currentCapabilities.showTimeline ? (
          <button
            type="button"
            onClick={() => setActiveTool("timeline")}
            title="Timeline"
            aria-label="Timeline"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </button>
        ) : null}

        {currentCapabilities.showExport ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((c) => !c)}
              disabled={!chat.activeThreadId || chat.messages.length === 0 || chat.isLoadingThread}
              title={chat.isExporting ? "Exporting..." : "Export"}
              aria-label={chat.isExporting ? "Exporting..." : "Export"}
              className={classNames(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
                !chat.activeThreadId || chat.messages.length === 0 || chat.isLoadingThread
                  ? "pointer-events-none opacity-30"
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
              <div className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[130px] rounded-lg border border-white/10 bg-slate-950 p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => { setShowExportMenu(false); chat.handleExport("docx"); }}
                  className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-white transition-colors hover:bg-white/10"
                >
                  Export DOC
                </button>
                <button
                  type="button"
                  onClick={() => { setShowExportMenu(false); chat.handleExport("pdf"); }}
                  className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-white transition-colors hover:bg-white/10"
                >
                  Export PDF
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </>
    );
  };

  const toolModals = (chat: UseDivin8ChatReturn, currentCapabilities: Divin8Capabilities) => (
    <>
      <MemberChatToolModal
        title="Guide"
        open={activeTool === "guide"}
        onClose={() => setActiveTool(null)}
      >
        <MemberGuide />
      </MemberChatToolModal>

      {currentCapabilities.showTimeline ? (
        <MemberChatToolModal
          title="Timeline"
          open={activeTool === "timeline"}
          onClose={() => setActiveTool(null)}
          variant="drawer"
        >
          <MemberTimelinePanel events={chat.timelineEvents} />
        </MemberChatToolModal>
      ) : null}
    </>
  );

  return (
    <Divin8ChatPage
      config={{
        basePath: "/member/divin8",
        getToken,
        api: chatApi,
        tier: memberTier === "initiate" ? "initiate" : "seeker",
        hideSummaryInPreviews: true,
      }}
      capabilities={capabilities}
      isLightTheme={false}
      headerActions={headerActions}
      toolModals={toolModals}
      speech={{
        isSupported: speech.isSupported,
        status: speech.status,
        error: speech.error,
        toggle: speech.toggle,
        buttonTitle: !speech.isSupported
          ? "Speech unavailable"
          : (speech.error || "Start speech input"),
      }}
      imageUpload={{
        onImageChange: handleImageChange,
      }}
    />
  );
}
