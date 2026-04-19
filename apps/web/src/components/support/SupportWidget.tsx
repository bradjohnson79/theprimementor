import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import SupportButton from "./SupportButton";
import SupportChat from "./SupportChat";
import { getResponse } from "./supportLogic";
import type { SupportMessage } from "./supportTypes";

const RESPONSE_DELAY_MS = 300;
const INITIAL_MESSAGE = "Hi - need help navigating the site?";
const rootBaseClassName = "fixed bottom-6 z-[9999]";

function shouldUseLeftAnchor(pathname: string) {
  return pathname === "/dashboard"
    || pathname.startsWith("/dashboard/")
    || pathname === "/sessions"
    || pathname === "/bookings"
    || pathname === "/reports"
    || pathname.startsWith("/reports/")
    || pathname === "/mentoring-circle"
    || pathname === "/events/mentoring-circle"
    || pathname === "/mentor-training"
    || pathname === "/settings"
    || pathname === "/member/contact";
}

export default function SupportWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showTooltip, setShowTooltip] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);
  const responseTimeoutRef = useRef<number | null>(null);
  const align = shouldUseLeftAnchor(pathname) ? "left" : "right";

  function getNextMessageId() {
    messageIdRef.current += 1;
    return `support-message-${messageIdRef.current}`;
  }

  function queueAssistantResponse(prompt: string) {
    const response = getResponse(prompt);
    setLoading(true);

    if (responseTimeoutRef.current) {
      window.clearTimeout(responseTimeoutRef.current);
    }

    responseTimeoutRef.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: getNextMessageId(),
          role: "assistant",
          text: response.answer,
          links: response.links,
        },
      ]);
      setLoading(false);
      responseTimeoutRef.current = null;
    }, RESPONSE_DELAY_MS);
  }

  function ensureInitialized() {
    if (hasInitialized) return;
    setHasInitialized(true);
    setMessages((current) => {
      if (current.length > 0) return current;

      return [
        {
          id: getNextMessageId(),
          role: "assistant",
          text: INITIAL_MESSAGE,
        },
      ];
    });
  }

  function handleToggle() {
    setShowTooltip(false);

    if (!open) {
      ensureInitialized();
      setOpen(true);
      return;
    }

    setOpen(false);
  }

  function submitPrompt(prompt: string) {
    const normalized = prompt.trim();
    if (!normalized || loading) return;

    ensureInitialized();
    setMessages((current) => [
      ...current,
      {
        id: getNextMessageId(),
        role: "user",
        text: normalized,
      },
    ]);
    setInputValue("");
    setOpen(true);
    queueAssistantResponse(normalized);
  }

  useEffect(() => {
    const tooltipTimeoutId = window.setTimeout(() => {
      setShowTooltip(false);
    }, 2400);

    return () => {
      window.clearTimeout(tooltipTimeoutId);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (responseTimeoutRef.current) {
        window.clearTimeout(responseTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div ref={rootRef} className={`${rootBaseClassName} ${align === "left" ? "left-6" : "right-6"}`}>
      <SupportChat
        isOpen={open}
        messages={messages}
        loading={loading}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={() => submitPrompt(inputValue)}
        onQuickAction={submitPrompt}
        onClose={() => setOpen(false)}
        align={align}
      />
      <SupportButton isOpen={open} showTooltip={showTooltip && !open} onClick={handleToggle} align={align} />
    </div>
  );
}
