import { useAuth } from "@clerk/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api";
import {
  adsAgentUserError,
  agentStatusLabel,
  unwrapData,
  type AdsAgentContext,
  type AdsAgentGeneration,
  type AdsAgentHealth,
  type AdsAgentMessage,
} from "../pages/ads/adsApi";
import { adsSectionFromPath, adsSectionLabel, type AdsSection } from "../pages/ads/adsNav";
import { getPmaAgentFilters } from "../pages/ads/pmaAgentContext";

const POLL_MS = 1_000;
const POLL_TIMEOUT_MS = 180_000;
const TOKEN_REFRESH_SKEW_MS = 15_000;

function tokenExpiryMs(token: string | null | undefined) {
  if (!token) return 0;
  const payload = token.split(".")[1];
  if (!payload) return 0;
  try {
    const parsed = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof parsed.exp === "number" ? parsed.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

type AdsAgentStore = {
  open: boolean;
  setOpen: (open: boolean) => void;
  width: number;
  setWidth: (width: number) => void;
  section: AdsSection;
  contextLabel: string;
  health: AdsAgentHealth | null;
  healthLabel: string;
  messages: AdsAgentMessage[];
  sending: boolean;
  error: string | null;
  lastPrompt: string | null;
  conversationId: string | null;
  refreshHealth: (test?: boolean) => Promise<AdsAgentHealth | null>;
  sendMessage: (message: string, images?: Array<{ mimeType: string; data: string }>) => Promise<void>;
  retryLast: () => Promise<void>;
  newConversation: () => Promise<void>;
  clearConversation: () => Promise<void>;
};

const AdsAgentContextValue = createContext<AdsAgentStore | null>(null);

function pageContext(section: AdsSection): AdsAgentContext {
  const filters = section === "keyword_strategy" ? getPmaAgentFilters() : undefined;
  return { section, ...(filters && Object.keys(filters).length ? { filters } : {}) };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AdsAgentProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const location = useLocation();
  const section = adsSectionFromPath(location.pathname);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(420);
  const [health, setHealth] = useState<AdsAgentHealth | null>(null);
  const [messages, setMessages] = useState<AdsAgentMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const lastHealthAt = useRef(0);
  const restoredRef = useRef(false);
  const restoreDoneRef = useRef(false);
  const pollSeq = useRef(0);
  const abortPoll = useRef<AbortController | null>(null);
  const pollTokenRef = useRef<{ token: string; expiresAt: number } | null>(null);

  const pollAuthToken = useCallback(async () => {
    const cached = pollTokenRef.current;
    if (cached?.token && cached.expiresAt - Date.now() > TOKEN_REFRESH_SKEW_MS) {
      return cached.token;
    }
    const token = await getToken({ skipCache: Boolean(cached) });
    if (token) {
      pollTokenRef.current = {
        token,
        expiresAt: tokenExpiryMs(token) || Date.now() + 45_000,
      };
    }
    return token;
  }, [getToken]);

  const refreshHealth = useCallback(async (test = false) => {
    try {
      const token = await getToken();
      const path = test ? "/admin/ads/agent/health/test" : "/admin/ads/agent/health";
      const next = unwrapData<AdsAgentHealth>(
        test ? await api.post(path, {}, token) : await api.get(path, token),
      );
      setHealth(next);
      lastHealthAt.current = Date.now();
      return next;
    } catch (loadError) {
      setHealth({
        provider: "openrouter",
        status: "provider_error",
        model: "z-ai/glm-5.3-flash",
        modelLabel: "GLM 5.3 Flash",
        apiKeyConfigured: false,
        reachable: false,
        message: adsAgentUserError(loadError),
      });
      return null;
    }
  }, [getToken]);

  useEffect(() => {
    if (Date.now() - lastHealthAt.current < 30_000) return;
    void refreshHealth();
  }, [refreshHealth, location.pathname, open]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      try {
        const token = await getToken();
        const listed = unwrapData<{ conversations: Array<{ id: string }> }>(
          await api.get("/admin/ads/agent/conversations", token),
        );
        const latestId = listed.conversations[0]?.id;
        if (!latestId) return;
        const detail = unwrapData<{ id: string; messages: AdsAgentMessage[] }>(
          await api.get(`/admin/ads/agent/conversations/${latestId}`, token),
        );
        setConversationId(detail.id);
        setMessages(detail.messages);
      } catch {
        restoredRef.current = false;
      } finally {
        restoreDoneRef.current = true;
      }
    })();
  }, [getToken]);

  useEffect(() => () => {
    abortPoll.current?.abort();
    pollSeq.current += 1;
  }, []);

  const pollConversation = useCallback(async (
    id: string,
    afterUserId: string | null,
    seq: number,
  ) => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (pollSeq.current !== seq) return;
      await sleep(POLL_MS);
      if (pollSeq.current !== seq) return;
      const token = await pollAuthToken();
      const detail = unwrapData<{
        id: string;
        messages: AdsAgentMessage[];
        generation?: AdsAgentGeneration;
      }>(await api.get(`/admin/ads/agent/conversations/${id}`, token));
      setMessages(detail.messages);
      const assistant = [...detail.messages].reverse().find((item) => item.role === "assistant");
      const user = afterUserId
        ? detail.messages.find((item) => item.id === afterUserId)
        : [...detail.messages].reverse().find((item) => item.role === "user");
      const assistantAfterUser = assistant && user
        ? new Date(assistant.createdAt).getTime() >= new Date(user.createdAt).getTime()
        : Boolean(assistant);
      if (detail.generation?.status === "failed") {
        throw Object.assign(new Error(detail.generation.error || "Ads Agent provider timed out. Please retry."), {
          code: detail.generation.errorCode,
        });
      }
      if (detail.generation?.status !== "generating" && assistantAfterUser) {
        return;
      }
    }
    const token = await pollAuthToken();
    const late = unwrapData<{
      messages: AdsAgentMessage[];
      generation?: AdsAgentGeneration;
    }>(await api.get(`/admin/ads/agent/conversations/${id}`, token));
    setMessages(late.messages);
    const lateAssistant = [...late.messages].reverse().find((item) => item.role === "assistant");
    const lateUser = afterUserId
      ? late.messages.find((item) => item.id === afterUserId)
      : [...late.messages].reverse().find((item) => item.role === "user");
    const lateReady = lateAssistant && lateUser
      ? new Date(lateAssistant.createdAt).getTime() >= new Date(lateUser.createdAt).getTime()
      : Boolean(lateAssistant);
    if (late.generation?.status !== "generating" && lateReady) return;
    throw Object.assign(new Error("Ads Agent provider timed out. Please retry."), {
      code: "ADS_AGENT_TIMEOUT",
    });
  }, [pollAuthToken]);

  const sendMessage = useCallback(async (message: string, images?: Array<{ mimeType: string; data: string }>) => {
    const trimmed = message.trim();
    if ((!trimmed && !images?.length) || sending) return;
    if (!restoreDoneRef.current) {
      setError("Ads Agent is still loading the previous conversation.");
      return;
    }
    abortPoll.current?.abort();
    const seq = ++pollSeq.current;
    abortPoll.current = new AbortController();
    setSending(true);
    setError(null);
    setLastPrompt(trimmed);
    const optimistic: AdsAgentMessage = {
      id: `local-user-${Date.now()}`,
      conversationId: conversationId || "pending",
      role: "user",
      content: trimmed,
      model: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    try {
      const token = await getToken();
      if (token) {
        pollTokenRef.current = {
          token,
          expiresAt: tokenExpiryMs(token) || Date.now() + 45_000,
        };
      }
      const response = unwrapData<{
        conversationId: string;
        status: "generating";
        message: AdsAgentMessage | null;
      }>(await api.post("/admin/ads/agent/chat", {
        message: trimmed || "Analyze the attached screenshot.",
        conversationId,
        context: pageContext(section),
        ...(images?.length ? { images } : {}),
      }, token));
      setConversationId(response.conversationId);
      if (response.message) {
        setMessages((current) => current.map((item) => (
          item.id === optimistic.id ? response.message as AdsAgentMessage : item
        )));
      }
      await pollConversation(response.conversationId, response.message?.id ?? null, seq);
    } catch (sendError) {
      if (pollSeq.current !== seq) return;
      setError(adsAgentUserError(sendError));
    } finally {
      if (pollSeq.current === seq) setSending(false);
    }
  }, [conversationId, getToken, pollConversation, section, sending]);

  const retryLast = useCallback(async () => {
    if (lastPrompt) await sendMessage(lastPrompt);
  }, [lastPrompt, sendMessage]);

  const newConversation = useCallback(async () => {
    pollSeq.current += 1;
    abortPoll.current?.abort();
    setMessages([]);
    setError(null);
    setLastPrompt(null);
    setSending(false);
    try {
      const token = await getToken();
      const created = unwrapData<{ id: string }>(await api.post("/admin/ads/agent/conversations", {
        context: pageContext(section),
      }, token));
      setConversationId(created.id);
    } catch {
      setConversationId(null);
    }
  }, [getToken, section]);

  const clearConversation = useCallback(async () => {
    pollSeq.current += 1;
    abortPoll.current?.abort();
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const token = await getToken();
    await api.post(`/admin/ads/agent/conversations/${conversationId}/clear`, {}, token);
    setMessages([]);
    setError(null);
    setSending(false);
  }, [conversationId, getToken]);

  const value = useMemo<AdsAgentStore>(() => ({
    open,
    setOpen,
    width,
    setWidth,
    section,
    contextLabel: adsSectionLabel(section),
    health,
    healthLabel: agentStatusLabel(health),
    messages,
    sending,
    error,
    lastPrompt,
    conversationId,
    refreshHealth,
    sendMessage,
    retryLast,
    newConversation,
    clearConversation,
  }), [
    clearConversation,
    conversationId,
    error,
    health,
    lastPrompt,
    messages,
    newConversation,
    open,
    refreshHealth,
    retryLast,
    section,
    sendMessage,
    sending,
    width,
  ]);

  return <AdsAgentContextValue.Provider value={value}>{children}</AdsAgentContextValue.Provider>;
}

export function useAdsAgent() {
  const value = useContext(AdsAgentContextValue);
  if (!value) throw new Error("useAdsAgent must be used within AdsAgentProvider");
  return value;
}
