import { useCallback, useEffect, useRef, useState, type FormEvent, type UIEvent } from "react";
import type {
  Divin8ProfileCreateRequest,
  Divin8ProfileResponse,
  Divin8ProfilesResponse,
  Divin8ConversationDetailResponse,
  Divin8ConversationMessageResponse,
  Divin8ConversationPostResponse,
  Divin8ConversationSummaryResponse,
  Divin8ConversationsResponse,
  Divin8MessageMetaResponse,
  Divin8TimelineEventResponse,
  Divin8TimelineRequest,
} from "@wisdom/utils";
import {
  DIVIN8_LIMITS,
  MAX_DIVIN8_PROFILES_PER_MESSAGE,
  MAX_DIVIN8_TIMELINES_PER_MESSAGE,
  extractDivin8ProfileTags,
  extractDivin8TimelineTags,
} from "@wisdom/utils";
import type {
  Divin8ChatMessage,
  Divin8ChatMeta,
  Divin8Profile,
  Divin8ChatTier,
  Divin8ConversationThread,
  Divin8RetryPayload,
  Divin8ServerTimeContext,
  Divin8TimelineEvent,
  Divin8TimelineDraft,
} from "./types";

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface Divin8ChatApiAdapter {
  get(path: string, token: string | null): Promise<unknown>;
  post(path: string, body: unknown | undefined, token: string | null): Promise<unknown>;
  del(path: string, token: string | null): Promise<unknown>;
  downloadBlobPost?(path: string, body: unknown, token: string | null, filename: string): Promise<void>;
}

export interface UseDivin8ChatConfig {
  basePath: string;
  getToken: () => Promise<string | null>;
  api: Divin8ChatApiAdapter;
  tier: Divin8ChatTier;
  language?: string;
  hideSummaryInPreviews?: boolean;
}

export interface UseDivin8ChatReturn {
  threads: Divin8ConversationThread[];
  messages: Divin8ChatMessage[];
  activeThreadId: string | null;
  searchQuery: string;
  searchResults: Divin8ConversationThread[] | null;
  displayedThreads: Divin8ConversationThread[];
  chatTitle: string;

  isGenerating: boolean;
  isLoadingThread: boolean;
  isBootstrapping: boolean;
  isCreatingThread: boolean;
  isSearching: boolean;

  inputText: string;
  setInputText: (value: string) => void;
  showScrollToBottom: boolean;
  liveAnnouncement: string;

  archiveTarget: Divin8ConversationThread | null;
  setArchiveTarget: (target: Divin8ConversationThread | null) => void;
  archivingThreadId: string | null;
  archiveNotice: string | null;

  debugMeta: Divin8ChatMeta | null;
  timelineEvents: Divin8TimelineEvent[];
  profiles: Divin8Profile[];
  isLoadingProfiles: boolean;
  isSavingProfile: boolean;
  deletingProfileId: string | null;
  isProfileModalOpen: boolean;
  isTimelineModalOpen: boolean;
  profileError: string | null;
  timelineError: string | null;
  profileLimitMessage: string | null;
  timelineLimitMessage: string | null;
  activeTimeline: Divin8TimelineDraft | null;
  usageCount: number;
  threadError: string | null;
  sendError: string | null;

  handleCreateConversation: () => void;
  handleSelectConversation: (threadId: string) => void;
  handleArchiveConversation: () => void;
  handleRetryMessage: (messageId: string) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleOpenProfileModal: () => void;
  handleCloseProfileModal: () => void;
  handleOpenTimelineModal: () => void;
  handleCloseTimelineModal: () => void;
  handleGenerateTimeline: (timeline: Divin8TimelineRequest) => void;
  handleCreateProfile: (input: Divin8ProfileCreateRequest) => Promise<void>;
  handleDeleteProfile: (profileId: string) => Promise<void>;
  insertProfileTag: (tag: string) => void;
  handleViewportScroll: (event: UIEvent<HTMLDivElement>) => void;
  scrollToBottom: (behavior: ScrollBehavior) => void;
  setSearchQuery: (query: string) => void;
  handleExport: (format: "pdf" | "docx") => void;

  messageViewportRef: React.RefObject<HTMLDivElement | null>;
  composerInputRef: React.RefObject<HTMLTextAreaElement | null>;
  activeThreadIdRef: React.RefObject<string | null>;

  isExporting: "pdf" | "docx" | null;
  blockMessage: string | null;

  clearImageSelection: () => void;
  imageRef: string | null;
  setImageRef: (ref: string | null) => void;
  imageName: string | null;
  setImageName: (name: string | null) => void;
  imagePreviewUrl: string | null;
  setImagePreviewUrl: (url: string | null) => void;
  imageError: string | null;
  setImageError: (error: string | null) => void;
  isUploadingImage: boolean;
  setIsUploadingImage: (uploading: boolean) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers (message mapping, meta builders)
// ---------------------------------------------------------------------------

const GPT_LIVE_TAG_REGEX = /\[DIVIN8_GPT_LIVE_[^\]]+\]/g;
const NEAR_BOTTOM_THRESHOLD = 100;
const TIMELINE_LIMIT_MESSAGE = "⚠️ Only one timeline range can be used per reading.";
const SEEKER_TIMELINE_MESSAGE = "⚠️ Timeline readings are available for Initiate members only.";

function replaceTimelineTagInDraft(
  inputText: string,
  nextTimeline: Divin8TimelineRequest,
  previousTimeline: Divin8TimelineRequest | null,
) {
  const existingTags = extractDivin8TimelineTags(inputText);
  const stripped = existingTags
    .reduce((draft, tag) => draft.replace(tag, " "), inputText)
    .replace(/\s+/g, " ")
    .trim();
  const base = previousTimeline && inputText.includes(previousTimeline.tag)
    ? inputText.replace(previousTimeline.tag, "").replace(/\s+/g, " ").trim()
    : stripped;
  return base ? `${base} ${nextTimeline.tag}` : nextTimeline.tag;
}

function createMessage(
  role: "user" | "assistant",
  text: string,
  extra?: Partial<Divin8ChatMessage>,
): Divin8ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

function mapThread(
  thread: Divin8ConversationSummaryResponse,
  hideSummary?: boolean,
): Divin8ConversationThread {
  return {
    id: thread.id,
    title: thread.title,
    summary: hideSummary ? null : thread.summary,
    preview: thread.preview,
    messageCount: thread.message_count,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
  };
}

function mapProfile(profile: Divin8ProfileResponse): Divin8Profile {
  return {
    id: profile.id,
    fullName: profile.fullName,
    tag: profile.tag,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime,
    birthPlace: profile.birthPlace,
    lat: profile.lat,
    lng: profile.lng,
    timezone: profile.timezone,
    createdAt: profile.createdAt,
  };
}

function mapStoredMessage(message: Divin8ConversationMessageResponse): Divin8ChatMessage {
  const extra: Partial<Divin8ChatMessage> = {
    id: message.id,
    createdAt: message.created_at,
  };
  if (message.role === "assistant" && message.meta?.stages) {
    const meta = message.meta as Divin8MessageMetaResponse;
    const stages = meta.stages!;
    extra.engineUsed = meta.engine_used;
    extra.systemsUsed = meta.systems_used;
    extra.meta = {
      gptLive: true,
      engineTriggered: stages.engine_required,
      engineCalled: stages.engine_run !== "SKIPPED",
      engineSuccess: stages.engine_run === "SUCCESS",
      pipelineStatus: (meta.pipeline_status as Divin8ChatMeta["pipelineStatus"]) ?? "ok",
      routeType: meta.route_type as "ASTROLOGY" | "GENERAL",
      timeContext: mapTimeContext(meta.time_context),
      stages: {
        inputReceived: stages.input_received,
        routed: stages.routed,
        engineRequired: stages.engine_required,
        engineRun: stages.engine_run,
        responseSent: stages.response_sent,
      },
      verificationTag: null,
      ...(meta.divin8
        ? {
            divin8: {
              action: meta.divin8.action,
              confidence: meta.divin8.confidence,
              intentSignal: meta.divin8.intent_signal,
            },
          }
        : {}),
      ...(meta.telemetry
        ? {
            telemetry: {
              usedSwissEph: meta.telemetry.used_swiss_eph,
              usedWebSearch: meta.telemetry.used_web_search,
              searchInputUsed: meta.telemetry.search_input_used,
              queryType: meta.telemetry.query_type,
            },
          }
        : {}),
    };
  }
  return createMessage(message.role, message.content, extra);
}

function mapTimelineEvent(event: Divin8TimelineEventResponse): Divin8TimelineEvent {
  return {
    id: event.id,
    summary: event.summary,
    systemsUsed: Array.isArray(event.systems_used)
      ? event.systems_used.filter((v): v is string => typeof v === "string")
      : [],
    tags: Array.isArray(event.tags)
      ? event.tags.filter((v): v is string => typeof v === "string")
      : [],
    type: event.type,
    createdAt: event.created_at,
  };
}

function mapTimeContext(
  context: {
    current_date: string;
    current_time: string;
    current_date_time: string;
    timezone: string;
  } | null | undefined,
): Divin8ServerTimeContext | undefined {
  if (!context) {
    return undefined;
  }
  return {
    currentDate: context.current_date,
    currentTime: context.current_time,
    currentDateTime: context.current_date_time,
    timezone: context.timezone,
  };
}

type StoredPipelineMeta = NonNullable<Divin8ConversationDetailResponse["last_pipeline_meta"]>;

function rehydratePipelineMeta(stored: StoredPipelineMeta): Divin8ChatMeta {
  return {
    gptLive: stored.gpt_live,
    engineTriggered: stored.engine_triggered,
    engineCalled: stored.engine_called,
    engineSuccess: stored.engine_success,
    pipelineStatus: stored.pipeline_status,
    routeType: stored.route_type,
    routeConfidence: stored.route_confidence,
    routeStrict: stored.route_strict,
    systemDecision: stored.system_decision,
    timeContext: mapTimeContext(stored.time_context),
    stages: {
      inputReceived: stored.stages.input_received,
      routed: stored.stages.routed,
      engineRequired: stored.stages.engine_required,
      engineRun: stored.stages.engine_run,
      responseSent: stored.stages.response_sent,
    },
    verificationTag: null,
    ...(stored.divin8
      ? {
          divin8: {
            action: stored.divin8.action,
            confidence: stored.divin8.confidence,
            intentSignal: stored.divin8.intent_signal,
          },
        }
      : {}),
    ...(stored.telemetry
      ? {
          telemetry: {
            usedSwissEph: stored.telemetry.used_swiss_eph,
            usedWebSearch: stored.telemetry.used_web_search,
            searchInputUsed: stored.telemetry.search_input_used,
            queryType: stored.telemetry.query_type,
          },
        }
      : {}),
  };
}

function buildPendingMeta(): Divin8ChatMeta {
  return {
    gptLive: false,
    engineTriggered: false,
    engineCalled: false,
    engineSuccess: false,
    pipelineStatus: "running",
    routeType: undefined,
    routeConfidence: undefined,
    routeStrict: undefined,
    systemDecision: "Routing...",
    stages: {
      inputReceived: true,
      routed: undefined as unknown as "ASTROLOGY" | "GENERAL",
      engineRequired: undefined as unknown as boolean,
      engineRun: undefined as unknown as "SKIPPED" | "SUCCESS" | "FAIL",
      responseSent: false,
    },
    verificationTag: null,
  };
}

function buildFailedMeta(): Divin8ChatMeta {
  return {
    gptLive: false,
    engineTriggered: false,
    engineCalled: false,
    engineSuccess: false,
    pipelineStatus: "engine_failed",
    routeType: undefined,
    routeConfidence: undefined,
    routeStrict: undefined,
    systemDecision: "Pipeline failed",
    stages: {
      inputReceived: true,
      routed: undefined as unknown as "ASTROLOGY" | "GENERAL",
      engineRequired: undefined as unknown as boolean,
      engineRun: "FAIL" as const,
      responseSent: false,
    },
    verificationTag: null,
  };
}

export function classifySendError(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : null;
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : null;
  const message = error instanceof Error ? error.message : "";

  if (code === "LIMIT_REACHED" || message.includes("LIMIT_REACHED")) {
    return {
      message: "You've reached your monthly limit.",
      isLimitReached: true,
    };
  }

  if (code === "AUTH_EXPIRED" || status === 401) {
    return {
      message: "Your session expired. Please log in again.",
      isLimitReached: false,
    };
  }

  if (
    error instanceof TypeError
    || /Failed to fetch|Load failed|NetworkError|network request failed/i.test(message)
  ) {
    return {
      message: "Connection issue. Check your internet.",
      isLimitReached: false,
    };
  }

  return {
    message: "Something went wrong. Please try again.",
    isLimitReached: false,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDivin8Chat(config: UseDivin8ChatConfig): UseDivin8ChatReturn {
  const { basePath, getToken, api, tier, language = "en", hideSummaryInPreviews } = config;

  const [threads, setThreads] = useState<Divin8ConversationThread[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Divin8ConversationThread[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Divin8ChatMessage[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<Divin8TimelineEvent[]>([]);
  const [draftsByThread, setDraftsByThread] = useState<Record<string, string>>({});
  const [usageCount, setUsageCount] = useState(0);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [debugMeta, setDebugMeta] = useState<Divin8ChatMeta | null>(null);
  const [generatingThreadId, setGeneratingThreadId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Divin8ConversationThread | null>(null);
  const [archivingThreadId, setArchivingThreadId] = useState<string | null>(null);
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [exportingThreadId, setExportingThreadId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Divin8Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineDraftsByThread, setTimelineDraftsByThread] = useState<Record<string, Divin8TimelineRequest | null>>({});

  const [imageRef, setImageRef] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const pendingScrollRestoreRef = useRef<{ threadId: string; mode: "restore" | "bottom" } | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);
  const previousMessageStateRef = useRef<{ threadId: string | null; count: number; generating: boolean }>({
    threadId: null,
    count: 0,
    generating: false,
  });
  const latestAssistantIdRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const inputText = activeThreadId ? draftsByThread[activeThreadId] ?? "" : "";
  const activeTimeline = activeThreadId ? timelineDraftsByThread[activeThreadId] ?? null : null;
  const isGenerating = generatingThreadId === activeThreadId;
  const isExporting = exportingThreadId === activeThreadId ? exporting : null;

  const maxUsage = tier === "seeker" ? DIVIN8_LIMITS.seeker : Number.POSITIVE_INFINITY;
  const isBlocked = tier === "seeker" && usageCount >= maxUsage;
  const blockMessage = isBlocked ? `You've reached your monthly limit of ${DIVIN8_LIMITS.seeker} prompts.` : null;
  const activeProfileTags = extractDivin8ProfileTags(inputText);
  const activeTimelineTags = extractDivin8TimelineTags(inputText);
  const profileLimitMessage = activeProfileTags.length > MAX_DIVIN8_PROFILES_PER_MESSAGE
    ? `Maximum of ${MAX_DIVIN8_PROFILES_PER_MESSAGE} profiles allowed per reading.`
    : null;
  const timelineLimitMessage = activeTimelineTags.length > MAX_DIVIN8_TIMELINES_PER_MESSAGE
    ? TIMELINE_LIMIT_MESSAGE
    : null;
  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;
  const chatTitle = activeThread?.title && activeThread.title !== "New Conversation"
    ? activeThread.title
    : "Divin8 Chat";
  const displayedThreads = searchQuery.trim() ? (searchResults ?? []) : threads;

  // -- Derived setter --
  const setInputText = useCallback((value: string) => {
    if (!activeThreadIdRef.current) return;
    const threadId = activeThreadIdRef.current;
    setSendError(null);
    setTimelineError(null);
    setDraftsByThread((cur) => ({ ...cur, [threadId]: value }));
    setTimelineDraftsByThread((current) => {
      const existing = current[threadId];
      if (!existing || value.includes(existing.tag)) {
        return current;
      }
      return { ...current, [threadId]: null };
    });
  }, []);

  // -- Image helpers --
  const clearImageSelection = useCallback(() => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageRef(null);
    setImageName(null);
    setImagePreviewUrl(null);
    setImageError(null);
  }, [imagePreviewUrl]);

  // -- Sync refs --
  useEffect(() => { activeThreadIdRef.current = activeThreadId; }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId || !activeTimeline) {
      return;
    }
    if (inputText.includes(activeTimeline.tag)) {
      return;
    }
    setTimelineDraftsByThread((current) => ({ ...current, [activeThreadId]: null }));
  }, [activeThreadId, activeTimeline, inputText]);

  // -- Archive notice auto-clear --
  useEffect(() => {
    if (!archiveNotice) return;
    const t = window.setTimeout(() => setArchiveNotice(null), 3000);
    return () => window.clearTimeout(t);
  }, [archiveNotice]);


  // -- Archive escape key --
  useEffect(() => {
    if (!archiveTarget) return;
    function handleEsc(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape" && !archivingThreadId) setArchiveTarget(null);
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [archiveTarget, archivingThreadId]);

  // -- Live announcements --
  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (isGenerating) {
      setLiveAnnouncement("Generating response...");
      return;
    }
    if (last && last.id !== latestAssistantIdRef.current) {
      latestAssistantIdRef.current = last.id;
      setLiveAnnouncement("New assistant message");
    }
  }, [isGenerating, messages]);

  // -- Scroll helpers --
  const updateNearBottomState = useCallback((element: HTMLDivElement) => {
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    const nextNearBottom = remaining <= NEAR_BOTTOM_THRESHOLD;
    isNearBottomRef.current = nextNearBottom;
    setShowScrollToBottom(!nextNearBottom);
    if (activeThreadIdRef.current) {
      scrollPositionsRef.current[activeThreadIdRef.current] = element.scrollTop;
    }
  }, []);

  const handleViewportScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (scrollRafRef.current) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      updateNearBottomState(el);
    });
  }, [updateNearBottomState]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    window.requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
      window.requestAnimationFrame(() => updateNearBottomState(viewport));
    });
  }, [updateNearBottomState]);

  useEffect(() => () => {
    if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current);
  }, []);

  // -- Scroll restore after thread load --
  useEffect(() => {
    const viewport = messageViewportRef.current;
    const pending = pendingScrollRestoreRef.current;
    if (!viewport || !activeThreadId || isLoadingThread || !pending || pending.threadId !== activeThreadId) return;
    pendingScrollRestoreRef.current = null;
    if (pending.mode === "restore" && scrollPositionsRef.current[activeThreadId] !== undefined) {
      viewport.scrollTop = scrollPositionsRef.current[activeThreadId];
    } else {
      viewport.scrollTop = viewport.scrollHeight;
    }
    updateNearBottomState(viewport);
  }, [activeThreadId, isLoadingThread, messages.length, updateNearBottomState]);

  // -- Auto-scroll on new messages --
  useEffect(() => {
    const viewport = messageViewportRef.current;
    const prev = previousMessageStateRef.current;
    const threadChanged = prev.threadId !== activeThreadId;
    const countIncreased = messages.length > prev.count;
    const generatingStarted = isGenerating && !prev.generating;
    previousMessageStateRef.current = { threadId: activeThreadId, count: messages.length, generating: isGenerating };
    if (!viewport || !activeThreadId || isLoadingThread || threadChanged) return;
    if ((countIncreased || generatingStarted) && isNearBottomRef.current) {
      scrollToBottom("instant");
    }
  }, [activeThreadId, isGenerating, isLoadingThread, messages.length, scrollToBottom]);

  // -- Search --
  useEffect(() => {
    let cancelled = false;
    const normalized = searchQuery.trim();
    if (!normalized) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      void (async () => {
        setIsSearching(true);
        try {
          const token = await getToken();
          const res = (await api.get(
            `${basePath}/conversations/search?q=${encodeURIComponent(normalized)}`,
            token,
          )) as { threads: Divin8ConversationSummaryResponse[] };
          if (!cancelled) setSearchResults(res.threads.map((t) => mapThread(t, hideSummaryInPreviews)));
        } catch {
          if (!cancelled) setSearchResults([]);
        } finally {
          if (!cancelled) setIsSearching(false);
        }
      })();
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [api, basePath, getToken, hideSummaryInPreviews, searchQuery]);

  // -- Thread CRUD --
  const refreshProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    try {
      const token = await getToken();
      const res = (await api.get(`${basePath}/profiles`, token)) as Divin8ProfilesResponse;
      setProfiles((res.profiles ?? []).map(mapProfile));
      setProfileError(null);
    } catch (error) {
      setProfiles([]);
      setProfileError(error instanceof Error ? error.message : "Unable to load profiles.");
    } finally {
      setIsLoadingProfiles(false);
    }
  }, [api, basePath, getToken]);

  const refreshThreads = useCallback(async (preferredThreadId?: string) => {
    const token = await getToken();
    const res = (await api.get(`${basePath}/conversations`, token)) as Divin8ConversationsResponse;
    const next = res.threads.map((t) => mapThread(t, hideSummaryInPreviews));
    setThreads(next);
    setUsageCount(res.usage.month_used ?? res.usage.used ?? 0);
    return preferredThreadId ?? next[0]?.id ?? null;
  }, [api, basePath, getToken, hideSummaryInPreviews]);

  const loadConversation = useCallback(async (threadId: string) => {
    if (activeThreadIdRef.current && messageViewportRef.current) {
      scrollPositionsRef.current[activeThreadIdRef.current] = messageViewportRef.current.scrollTop;
    }
    activeThreadIdRef.current = threadId;
    setActiveThreadId(threadId);
    setIsLoadingThread(true);
    setThreadError(null);
    setSendError(null);
    setDebugMeta(null);
    pendingScrollRestoreRef.current = {
      threadId,
      mode: scrollPositionsRef.current[threadId] !== undefined ? "restore" : "bottom",
    };
    const requestId = ++loadRequestIdRef.current;
    try {
      const token = await getToken();
      const detail = (await api.get(`${basePath}/conversations/${threadId}`, token)) as Divin8ConversationDetailResponse;
      if (loadRequestIdRef.current !== requestId || activeThreadIdRef.current !== threadId) return;
      const mapped = detail.messages.map(mapStoredMessage);
      setMessages(mapped);
      setTimelineEvents(detail.timeline.map(mapTimelineEvent));
      if (detail.last_pipeline_meta) {
        setDebugMeta(rehydratePipelineMeta(detail.last_pipeline_meta));
      } else {
        const lastWithMeta = [...mapped].reverse().find((m) => m.role === "assistant" && m.meta);
        if (lastWithMeta?.meta) setDebugMeta(lastWithMeta.meta);
      }
      const updated = mapThread(detail.thread, hideSummaryInPreviews);
      setThreads((cur) =>
        cur.some((t) => t.id === updated.id)
          ? cur.map((t) => (t.id === updated.id ? updated : t))
          : [updated, ...cur],
      );
      setSearchResults((cur) => {
        if (!cur) return cur;
        const u = mapThread(detail.thread, hideSummaryInPreviews);
        return cur.some((t) => t.id === u.id) ? cur.map((t) => (t.id === u.id ? u : t)) : cur;
      });
    } catch (err) {
      if (loadRequestIdRef.current !== requestId || activeThreadIdRef.current !== threadId) return;
      setMessages([]);
      setTimelineEvents([]);
      setThreadError(err instanceof Error ? err.message : "Unable to load conversation");
    } finally {
      if (loadRequestIdRef.current === requestId && activeThreadIdRef.current === threadId) {
        setIsLoadingThread(false);
      }
    }
  }, [api, basePath, getToken, hideSummaryInPreviews]);

  const handleCreateConversation = useCallback(async () => {
    setIsCreatingThread(true);
    setDebugMeta(null);
    clearImageSelection();
    setSearchQuery("");
    setSearchResults(null);
    setThreadError(null);
    setSendError(null);
    try {
      if (activeThreadIdRef.current && messageViewportRef.current) {
        scrollPositionsRef.current[activeThreadIdRef.current] = messageViewportRef.current.scrollTop;
      }
      const token = await getToken();
      const created = mapThread(
        (await api.post(`${basePath}/conversations`, undefined, token)) as Divin8ConversationSummaryResponse,
        hideSummaryInPreviews,
      );
      activeThreadIdRef.current = created.id;
      pendingScrollRestoreRef.current = { threadId: created.id, mode: "bottom" };
      setThreads((cur) => [created, ...cur.filter((t) => t.id !== created.id)]);
      setActiveThreadId(created.id);
      setMessages([]);
      setTimelineEvents([]);
      setDraftsByThread((cur) => ({ ...cur, [created.id]: "" }));
      setTimelineDraftsByThread((cur) => ({ ...cur, [created.id]: null }));
    } finally {
      setIsCreatingThread(false);
    }
  }, [api, basePath, clearImageSelection, getToken, hideSummaryInPreviews]);

  const insertProfileTag = useCallback((tag: string) => {
    const current = inputText.trim();
    setInputText(current ? `${current} ${tag}` : tag);
    window.requestAnimationFrame(() => composerInputRef.current?.focus());
  }, [inputText, setInputText]);

  const handleOpenTimelineModal = useCallback(() => {
    setTimelineError(null);
    if (tier !== "initiate") {
      setTimelineError(SEEKER_TIMELINE_MESSAGE);
      return;
    }
    setIsTimelineModalOpen(true);
  }, [tier]);

  const handleCloseTimelineModal = useCallback(() => {
    setTimelineError(null);
    setIsTimelineModalOpen(false);
  }, []);

  const handleGenerateTimeline = useCallback((timeline: Divin8TimelineRequest) => {
    const threadId = activeThreadIdRef.current;
    if (!threadId) {
      return;
    }
    if (tier !== "initiate") {
      setTimelineError(SEEKER_TIMELINE_MESSAGE);
      setIsTimelineModalOpen(false);
      return;
    }
    setTimelineError(null);
    setTimelineDraftsByThread((current) => ({ ...current, [threadId]: timeline }));
    setInputText(replaceTimelineTagInDraft(draftsByThread[threadId] ?? "", timeline, timelineDraftsByThread[threadId] ?? null));
    setIsTimelineModalOpen(false);
    window.requestAnimationFrame(() => composerInputRef.current?.focus());
  }, [draftsByThread, setInputText, tier, timelineDraftsByThread]);

  const handleCreateProfile = useCallback(async (input: Divin8ProfileCreateRequest) => {
    setIsSavingProfile(true);
    try {
      const token = await getToken();
      const created = (await api.post(`${basePath}/profiles`, input, token)) as Divin8ProfileResponse;
      setProfiles((cur) => [...cur, mapProfile(created)]);
      setProfileError(null);
      setIsProfileModalOpen(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to save profile.");
      throw error;
    } finally {
      setIsSavingProfile(false);
    }
  }, [api, basePath, getToken]);

  const handleDeleteProfile = useCallback(async (profileId: string) => {
    setDeletingProfileId(profileId);
    try {
      const token = await getToken();
      await api.del(`${basePath}/profiles/${profileId}`, token);
      setProfiles((cur) => cur.filter((profile) => profile.id !== profileId));
      setProfileError(null);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to delete profile.");
      throw error;
    } finally {
      setDeletingProfileId(null);
    }
  }, [api, basePath, getToken]);

  // -- Bootstrap --
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setIsBootstrapping(true);
      try {
        const [preferred] = await Promise.all([
          refreshThreads(),
          refreshProfiles(),
        ]);
        if (cancelled) return;
        if (preferred) {
          await loadConversation(preferred);
        } else {
          await handleCreateConversation();
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }
    void boot();
    return () => { cancelled = true; };
  }, [handleCreateConversation, loadConversation, refreshProfiles, refreshThreads]);

  // -- Send message --
  const sendMessageInternal = useCallback(
    async (threadId: string, messageId: string, payload: Divin8RetryPayload) => {
      setGeneratingThreadId(threadId);
      setDebugMeta(buildPendingMeta());
      setThreadError(null);
      setSendError(null);

      setMessages((cur) => {
        const idx = cur.findIndex((m) => m.id === messageId);
        const next = createMessage("user", payload.text, {
          id: messageId,
          imagePreviewUrl: payload.imagePreviewUrl,
          deliveryState: "sending",
          retryPayload: payload,
        });
        if (idx >= 0) return cur.map((m) => (m.id === messageId ? { ...m, ...next } : m));
        return [...cur, next];
      });

      try {
        const token = await getToken();
        const res = (await api.post(
          `${basePath}/conversations/${threadId}/message`,
          {
            message: payload.text,
            image_ref: payload.imageRef,
            profile_tags: payload.profileTags,
            timeline: payload.timeline,
            tier: payload.tier,
            language: payload.language,
            request_id: payload.requestId,
          },
          token,
        )) as Divin8ConversationPostResponse;

        const verificationTag = res.chat.message.match(GPT_LIVE_TAG_REGEX)?.[0] ?? null;
        const visibleMessage = res.assistant_message.content
          || res.chat.message.replace(GPT_LIVE_TAG_REGEX, "").trim();
        const meta: Divin8ChatMeta = {
          gptLive: res.chat.meta.gpt_live,
          engineTriggered: res.chat.meta.engine_triggered,
          engineCalled: res.chat.meta.engine_called,
          engineSuccess: res.chat.meta.engine_success,
          pipelineStatus: res.chat.meta.pipeline_status,
          routeType: res.chat.meta.route_type,
          routeConfidence: res.chat.meta.route_confidence,
          routeStrict: res.chat.meta.route_strict,
          systemDecision: res.chat.meta.system_decision,
          timeContext: mapTimeContext(res.chat.meta.time_context),
          stages: {
            inputReceived: res.chat.meta.stages.input_received,
            routed: res.chat.meta.stages.routed,
            engineRequired: res.chat.meta.stages.engine_required,
            engineRun: res.chat.meta.stages.engine_run,
            responseSent: res.chat.meta.stages.response_sent,
          },
          verificationTag,
          ...(res.chat.meta.divin8
            ? {
                divin8: {
                  action: res.chat.meta.divin8.action,
                  confidence: res.chat.meta.divin8.confidence,
                  intentSignal: res.chat.meta.divin8.intent_signal,
                },
              }
            : {}),
        ...(res.chat.meta.telemetry
          ? {
              telemetry: {
                usedSwissEph: res.chat.meta.telemetry.used_swiss_eph,
                usedWebSearch: res.chat.meta.telemetry.used_web_search,
                searchInputUsed: res.chat.meta.telemetry.search_input_used,
                queryType: res.chat.meta.telemetry.query_type,
              },
            }
          : {}),
        };

        const updatedThread = mapThread(res.thread, hideSummaryInPreviews);
        setThreads((cur) => [updatedThread, ...cur.filter((t) => t.id !== updatedThread.id)]);
        setSearchResults((cur) => {
          if (!cur) return cur;
          return cur.some((t) => t.id === updatedThread.id)
            ? [updatedThread, ...cur.filter((t) => t.id !== updatedThread.id)]
            : cur;
        });
        setUsageCount(res.usage.month_used ?? res.usage.used ?? 0);

        if (activeThreadIdRef.current === threadId) {
          setDebugMeta(meta);
          setSendError(null);
          setMessages((cur) => [
            ...cur.map((m) =>
              m.id === messageId
                ? { ...m, deliveryState: undefined, deliveryError: null, retryPayload: payload }
                : m,
            ),
            createMessage("assistant", visibleMessage, {
              id: res.assistant_message.id,
              createdAt: res.assistant_message.created_at,
              engineUsed: res.chat.engine_used,
              systemsUsed: res.chat.systems_used,
              meta,
            }),
          ]);
          setTimelineEvents(res.timeline.map(mapTimelineEvent));
        }
      } catch (error) {
        const nextError = classifySendError(error);
        if (activeThreadIdRef.current === threadId) {
          if (nextError.isLimitReached) {
            setUsageCount(maxUsage);
          }
          setSendError(nextError.message);
          setMessages((cur) =>
            cur.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    deliveryState: "failed",
                    deliveryError: nextError.message,
                    retryPayload: payload,
                  }
                : m,
            ),
          );
          setDebugMeta(buildFailedMeta());
        }
      } finally {
        setGeneratingThreadId((cur) => (cur === threadId ? null : cur));
      }
    },
    [api, basePath, getToken, hideSummaryInPreviews],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isGenerating || isBlocked || profileLimitMessage || timelineLimitMessage || !activeThreadId || (!inputText.trim() && !imageRef)) {
      return;
    }
    if (tier !== "initiate" && activeTimeline) {
      setTimelineError(SEEKER_TIMELINE_MESSAGE);
      return;
    }
    if (activeTimelineTags.length === 1 && !activeTimeline) {
      setTimelineError("Use the calendar icon to generate a valid timeline range.");
      return;
    }

    const nextText = inputText.trim() || "Please interpret the uploaded image symbolically.";
    const messageId = createMessage("user", nextText).id;
    const payload: Divin8RetryPayload = {
      text: nextText,
      imageRef,
      imageName,
      imagePreviewUrl,
      profileTags: extractDivin8ProfileTags(nextText),
      timeline: activeTimeline,
      tier,
      language,
      requestId: messageId,
    };
    setInputText("");
    setTimelineDraftsByThread((current) => ({ ...current, [activeThreadId]: null }));
    clearImageSelection();
    void sendMessageInternal(activeThreadId, messageId, payload);
  }

  function handleRetryMessage(messageId: string) {
    if (!activeThreadId || isGenerating) return;
    const failed = messages.find((m) => m.id === messageId);
    if (!failed?.retryPayload) return;
    setSendError(null);
    void sendMessageInternal(activeThreadId, messageId, failed.retryPayload);
  }

  function handleSelectConversation(threadId: string) {
    if (threadId === activeThreadId) return;
    clearImageSelection();
    void loadConversation(threadId);
  }

  function handleArchiveConversation() {
    if (!archiveTarget || archivingThreadId) return;
    setArchivingThreadId(archiveTarget.id);
    void (async () => {
      try {
        const token = await getToken();
        await api.del(`${basePath}/conversations/${archiveTarget.id}`, token);
        setThreads((cur) => cur.filter((t) => t.id !== archiveTarget.id));
        setSearchResults((cur) => cur?.filter((t) => t.id !== archiveTarget.id) ?? null);
        if (activeThreadId === archiveTarget.id) {
          setActiveThreadId(null);
          activeThreadIdRef.current = null;
          setMessages([]);
          setTimelineEvents([]);
          setDebugMeta(null);
          setThreadError(null);
        }
        clearImageSelection();
        setArchiveNotice("Conversation deleted");
        setArchiveTarget(null);
      } finally {
        setArchivingThreadId(null);
      }
    })();
  }

  function handleExport(format: "pdf" | "docx") {
    if (!activeThreadId || messages.length === 0 || exporting || !api.downloadBlobPost) return;
    setExportingThreadId(activeThreadId);
    setExporting(format);
    void (async () => {
      try {
        const token = await getToken();
        await api.downloadBlobPost!(
          `${basePath}/export`,
          { threadId: activeThreadId, format },
          token,
          `divin8-conversation.${format}`,
        );
      } finally {
        setExporting(null);
        setExportingThreadId(null);
      }
    })();
  }

  return {
    threads,
    messages,
    activeThreadId,
    searchQuery,
    searchResults,
    displayedThreads,
    chatTitle,
    isGenerating,
    isLoadingThread,
    isBootstrapping,
    isCreatingThread,
    isSearching,
    inputText,
    setInputText,
    showScrollToBottom,
    liveAnnouncement,
    archiveTarget,
    setArchiveTarget,
    archivingThreadId,
    archiveNotice,
    debugMeta,
    timelineEvents,
    profiles,
    isLoadingProfiles,
    isSavingProfile,
    deletingProfileId,
    isProfileModalOpen,
    isTimelineModalOpen,
    profileError,
    timelineError,
    profileLimitMessage,
    timelineLimitMessage,
    activeTimeline,
    usageCount,
    threadError,
    sendError,
    handleCreateConversation: () => { void handleCreateConversation(); },
    handleSelectConversation,
    handleArchiveConversation,
    handleRetryMessage,
    handleSubmit,
    handleOpenProfileModal: () => {
      setProfileError(null);
      setIsProfileModalOpen(true);
    },
    handleCloseProfileModal: () => {
      if (!isSavingProfile) {
        setProfileError(null);
        setIsProfileModalOpen(false);
      }
    },
    handleOpenTimelineModal,
    handleCloseTimelineModal,
    handleGenerateTimeline,
    handleCreateProfile,
    handleDeleteProfile,
    insertProfileTag,
    handleViewportScroll,
    scrollToBottom,
    setSearchQuery,
    handleExport,
    messageViewportRef,
    composerInputRef,
    activeThreadIdRef,
    isExporting,
    blockMessage,
    clearImageSelection,
    imageRef,
    setImageRef,
    imageName,
    setImageName,
    imagePreviewUrl,
    setImagePreviewUrl,
    imageError,
    setImageError,
    isUploadingImage,
    setIsUploadingImage,
  };
}
