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
  agentStatusLabel,
  unwrapData,
  type AdsAgentContext,
  type AdsAgentHealth,
  type AdsAgentMessage,
} from "../pages/ads/adsApi";
import { adsSectionFromPath, adsSectionLabel, type AdsSection } from "../pages/ads/adsNav";
import { getPmaAgentFilters } from "../pages/ads/pmaAgentContext";

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
        message: loadError instanceof Error ? loadError.message : "Ads Agent health failed",
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

  const sendMessage = useCallback(async (message: string, images?: Array<{ mimeType: string; data: string }>) => {
    const trimmed = message.trim();
    if ((!trimmed && !images?.length) || sending) return;
    if (!restoreDoneRef.current) {
      setError("Ads Agent is still loading the previous conversation.");
      return;
    }
    setSending(true);
    setError(null);
    setLastPrompt(trimmed);
    try {
      const token = await getToken();
      const response = unwrapData<{
        conversationId: string;
        message: AdsAgentMessage;
      }>(await api.post("/admin/ads/agent/chat", {
        message: trimmed || "Analyze the attached screenshot.",
        conversationId,
        context: pageContext(section),
        ...(images?.length ? { images } : {}),
      }, token));
      setConversationId(response.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: `local-user-${Date.now()}`,
          conversationId: response.conversationId,
          role: "user",
          content: trimmed,
          model: null,
          createdAt: new Date().toISOString(),
        },
        response.message,
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Ads Agent generation failed.");
    } finally {
      setSending(false);
    }
  }, [conversationId, getToken, section, sending]);

  const retryLast = useCallback(async () => {
    if (lastPrompt) await sendMessage(lastPrompt);
  }, [lastPrompt, sendMessage]);

  const newConversation = useCallback(async () => {
    setMessages([]);
    setError(null);
    setLastPrompt(null);
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
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const token = await getToken();
    await api.post(`/admin/ads/agent/conversations/${conversationId}/clear`, {}, token);
    setMessages([]);
    setError(null);
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
