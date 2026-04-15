import { type ChangeEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import ChatComposer from "./ChatComposer";
import ChatWindow from "./ChatWindow";
import ConversationList from "./ConversationList";
import Divin8ChatShell from "./Divin8ChatShell";
import Divin8ProfileModal from "./Divin8ProfileModal";
import Divin8TimelineModal from "./Divin8TimelineModal";
import type { Divin8Capabilities } from "./capabilities";
import { classNames } from "./utils";
import { useDivin8Chat, type UseDivin8ChatConfig, type UseDivin8ChatReturn } from "./useDivin8Chat";

type SpeechRecognitionStatus = "idle" | "listening" | "error" | "disabled";

export interface Divin8ChatPageProps {
  config: UseDivin8ChatConfig;
  isLightTheme: boolean;

  capabilities?: Partial<Divin8Capabilities>;
  headerActions?: (chat: UseDivin8ChatReturn, capabilities: Divin8Capabilities) => ReactNode;
  toolModals?: (chat: UseDivin8ChatReturn, capabilities: Divin8Capabilities) => ReactNode;
  wrapperClassName?: string;

  speech?: {
    isSupported: boolean;
    status: SpeechRecognitionStatus;
    error: string | null;
    toggle: () => void;
    buttonTitle: string;
  };
  imageUpload?: {
    onImageChange: (event: ChangeEvent<HTMLInputElement>, chat: UseDivin8ChatReturn) => void;
  };
}

export default function Divin8ChatPage({
  config,
  isLightTheme,
  capabilities,
  headerActions,
  toolModals,
  wrapperClassName,
  speech,
  imageUpload,
}: Divin8ChatPageProps) {
  const chat = useDivin8Chat(config);
  const mergedCapabilities: Divin8Capabilities = {
    showDebug: true,
    showTimeline: true,
    showTimelineReading: true,
    showExport: true,
    showRegenerate: true,
    showTierToggle: true,
    ...capabilities,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={classNames(
        "flex min-h-0 flex-1 flex-col",
        isLightTheme ? "text-slate-900" : "text-white",
        wrapperClassName,
      )}
    >
      <Divin8ChatShell
        conversationList={
          <ConversationList
            threads={chat.displayedThreads}
            activeThreadId={chat.activeThreadId}
            isLightTheme={isLightTheme}
            isCreating={chat.isCreatingThread}
            searchQuery={chat.searchQuery}
            isSearching={chat.isSearching}
            profiles={chat.profiles}
            isLoadingProfiles={chat.isLoadingProfiles}
            deletingProfileId={chat.deletingProfileId}
            onSearchQueryChange={chat.setSearchQuery}
            onCreate={chat.handleCreateConversation}
            onAddProfile={chat.handleOpenProfileModal}
            onInsertProfileTag={chat.insertProfileTag}
            onDeleteProfile={(profileId) => {
              void chat.handleDeleteProfile(profileId).catch(() => {});
            }}
            onSelect={chat.handleSelectConversation}
            onArchiveRequest={chat.setArchiveTarget}
          />
        }
        chatWindow={
          <ChatWindow
            title={chat.chatTitle}
            messages={chat.messages}
            isGenerating={chat.isGenerating}
            isThreadLoading={chat.isLoadingThread || chat.isBootstrapping}
            threadError={chat.threadError}
            isLightTheme={isLightTheme}
            onRetryMessage={chat.handleRetryMessage}
            onRetryLoad={() => {
              if (chat.activeThreadId) chat.handleSelectConversation(chat.activeThreadId);
            }}
            showScrollToBottom={chat.showScrollToBottom}
            onScrollToBottom={() => chat.scrollToBottom("smooth")}
            onViewportScroll={chat.handleViewportScroll}
            scrollViewportRef={chat.messageViewportRef}
            liveAnnouncement={chat.liveAnnouncement}
            headerActions={headerActions?.(chat, mergedCapabilities) ?? null}
            composer={
              <ChatComposer
                inputText={chat.inputText}
                onInputChange={chat.setInputText}
                onSubmit={chat.handleSubmit}
                profiles={chat.profiles}
                onImageChange={imageUpload ? (e) => imageUpload.onImageChange(e, chat) : () => {}}
                onRemoveImage={chat.clearImageSelection}
                imageName={chat.imageName}
                imagePreviewUrl={chat.imagePreviewUrl}
                imageError={chat.imageError || speech?.error || null}
                disabled={chat.isGenerating || !!chat.blockMessage || !!chat.profileLimitMessage || !!chat.timelineLimitMessage || chat.isLoadingThread || chat.isBootstrapping}
                isSpeechSupported={speech?.isSupported ?? false}
                speechStatus={speech?.status ?? "disabled"}
                speechButtonTitle={speech?.buttonTitle ?? "Speech unavailable"}
                onToggleSpeech={speech?.toggle ?? (() => {})}
                onOpenTimeline={chat.handleOpenTimelineModal}
                isUploadingImage={chat.isUploadingImage}
                isLightTheme={isLightTheme}
                blockMessage={chat.blockMessage ?? chat.profileLimitMessage ?? chat.timelineLimitMessage ?? chat.timelineError}
                submitError={chat.sendError}
                activeTimeline={chat.activeTimeline}
                showTimelineButton={mergedCapabilities.showTimelineReading}
                inputRef={chat.composerInputRef}
              />
            }
          />
        }
      />

      {chat.archiveNotice ? (
        <div
          className={classNames(
            "fixed bottom-6 right-6 z-40 rounded-xl border px-4 py-2.5 text-sm shadow-lg",
            isLightTheme ? "border-amber-200 bg-amber-50 text-amber-700" : "border-amber-500/30 bg-slate-950 text-amber-100",
          )}
        >
          {chat.archiveNotice}
        </div>
      ) : null}

      {chat.archiveTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-6">
          <div
            className={classNames(
              "w-full max-w-sm rounded-2xl border p-5 shadow-2xl",
              isLightTheme ? "border-slate-200 bg-white text-slate-900" : "border-white/10 bg-slate-950 text-white",
            )}
          >
            <h3 className="text-base font-semibold">Delete conversation?</h3>
            <p className={classNames("mt-2 text-sm", isLightTheme ? "text-slate-600" : "text-white/65")}>
              This permanently deletes the conversation and its stored recall.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!chat.archivingThreadId) chat.setArchiveTarget(null);
                }}
                className={classNames(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  isLightTheme ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-white/10 text-white hover:bg-white/15",
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(chat.archivingThreadId)}
                onClick={chat.handleArchiveConversation}
                className={classNames(
                  "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  chat.archivingThreadId ? "cursor-not-allowed bg-rose-300/40 text-white/60" : "bg-rose-600 text-white hover:bg-rose-500",
                )}
              >
                {chat.archivingThreadId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Divin8ProfileModal
        open={chat.isProfileModalOpen}
        isLightTheme={isLightTheme}
        api={config.api}
        onClose={chat.handleCloseProfileModal}
        onSave={chat.handleCreateProfile}
        isSaving={chat.isSavingProfile}
        errorMessage={chat.profileError}
      />

      <Divin8TimelineModal
        open={chat.isTimelineModalOpen}
        isLightTheme={isLightTheme}
        onClose={chat.handleCloseTimelineModal}
        onGenerate={chat.handleGenerateTimeline}
        errorMessage={chat.timelineError}
      />

      {toolModals?.(chat, mergedCapabilities)}
    </motion.div>
  );
}
