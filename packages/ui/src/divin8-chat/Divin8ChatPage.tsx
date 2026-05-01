import { useState, type ChangeEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import ChatComposer from "./ChatComposer";
import ChatWindow from "./ChatWindow";
import ConversationList from "./ConversationList";
import Divin8ChatShell from "./Divin8ChatShell";
import Divin8ModalPortal from "./Divin8ModalPortal";
import Divin8ProfileModal from "./Divin8ProfileModal";
import Divin8TimelineModal from "./Divin8TimelineModal";
import type { Divin8Capabilities } from "./capabilities";
import { classNames } from "./utils";
import { useDivin8Chat, type UseDivin8ChatConfig, type UseDivin8ChatReturn } from "./useDivin8Chat";

type SpeechRecognitionStatus = "idle" | "listening" | "error" | "disabled";
type MobilePanel = "chat" | "conversations" | "profiles";

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
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chat");
  const mergedCapabilities: Divin8Capabilities = {
    showDebug: true,
    showTimeline: true,
    showTimelineReading: true,
    showExport: true,
    showRegenerate: true,
    showTierToggle: true,
    ...capabilities,
  };

  const desktopConversationList = (
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
  );

  const mobileConversationList = (
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
      onCreate={() => {
        chat.handleCreateConversation();
        setMobilePanel("chat");
      }}
      onAddProfile={() => {
        chat.handleOpenProfileModal();
        setMobilePanel("profiles");
      }}
      onInsertProfileTag={(tag) => {
        chat.insertProfileTag(tag);
        setMobilePanel("chat");
      }}
      onDeleteProfile={(profileId) => {
        void chat.handleDeleteProfile(profileId).catch(() => {});
      }}
      onSelect={(threadId) => {
        chat.handleSelectConversation(threadId);
        setMobilePanel("chat");
      }}
      onArchiveRequest={chat.setArchiveTarget}
      mode="conversations"
    />
  );

  const mobileProfileList = (
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
      onCreate={() => {
        chat.handleCreateConversation();
        setMobilePanel("chat");
      }}
      onAddProfile={() => {
        chat.handleOpenProfileModal();
        setMobilePanel("profiles");
      }}
      onInsertProfileTag={(tag) => {
        chat.insertProfileTag(tag);
        setMobilePanel("chat");
      }}
      onDeleteProfile={(profileId) => {
        void chat.handleDeleteProfile(profileId).catch(() => {});
      }}
      onSelect={(threadId) => {
        chat.handleSelectConversation(threadId);
        setMobilePanel("chat");
      }}
      onArchiveRequest={chat.setArchiveTarget}
      mode="profiles"
    />
  );

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
        isLightTheme={isLightTheme}
        desktopSidebar={desktopConversationList}
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
            serverTimeContext={chat.debugMeta?.timeContext ?? null}
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
                disabled={
                  chat.isGenerating ||
                  !!chat.blockMessage ||
                  !!chat.profileLimitMessage ||
                  !!chat.timelineLimitMessage ||
                  chat.isLoadingThread ||
                  chat.isBootstrapping
                }
                isSpeechSupported={speech?.isSupported ?? false}
                speechStatus={speech?.status ?? "disabled"}
                speechButtonTitle={speech?.buttonTitle ?? "Speech unavailable"}
                onToggleSpeech={speech?.toggle ?? (() => {})}
                onOpenTimeline={chat.handleOpenTimelineModal}
                isUploadingImage={chat.isUploadingImage}
                isLightTheme={isLightTheme}
                blockMessage={
                  chat.blockMessage ??
                  chat.profileLimitMessage ??
                  chat.timelineLimitMessage ??
                  chat.timelineError
                }
                submitError={chat.sendError}
                activeTimeline={chat.activeTimeline}
                showTimelineButton={mergedCapabilities.showTimelineReading}
                inputRef={chat.composerInputRef}
              />
            }
          />
        }
        mobileConversationList={mobileConversationList}
        mobileProfileList={mobileProfileList}
        mobilePanel={mobilePanel}
        onMobilePanelChange={setMobilePanel}
      />

      {chat.archiveNotice ? (
        <div
          className={classNames(
            "fixed bottom-6 right-6 rounded-xl border px-4 py-2.5 text-sm shadow-lg",
            isLightTheme
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-amber-500/30 bg-slate-950 text-amber-100",
          )}
          style={{ zIndex: "var(--z-toast)" }}
        >
          {chat.archiveNotice}
        </div>
      ) : null}

      {chat.archiveTarget ? (
        <Divin8ModalPortal open>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="divin8-delete-conversation-title"
            className={classNames(
              "w-full max-w-sm rounded-2xl border p-5 shadow-[0_24px_80px_rgba(8,15,30,0.4)]",
              isLightTheme
                ? "border-slate-200 bg-white text-slate-900"
                : "border-white/10 bg-slate-950 text-white",
            )}
          >
            <h3 id="divin8-delete-conversation-title" className="text-base font-semibold">
              Delete conversation?
            </h3>
            <p
              className={classNames(
                "mt-2 text-sm",
                isLightTheme ? "text-slate-600" : "text-white/65",
              )}
            >
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
                  isLightTheme
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    : "bg-white/10 text-white hover:bg-white/15",
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
                  chat.archivingThreadId
                    ? "cursor-not-allowed bg-rose-300/40 text-white/60"
                    : "bg-rose-600 text-white hover:bg-rose-500",
                )}
              >
                {chat.archivingThreadId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </Divin8ModalPortal>
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
