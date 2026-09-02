import { useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { useAdsAgent } from "../../context/AdsAgentProvider";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { AdsAgentMarkdown } from "./AdsAgentMarkdown";

const QUICK_ACTIONS = [
  { label: "What should I do next?", prompt: "What should I do next for Divin8 Google Ads while the account is disconnected?" },
  { label: "Explain Google Ads", prompt: "Explain Google Ads in clear language for a business owner." },
  { label: "Build a Divin8 campaign strategy", prompt: "Build a Divin8 Reports campaign strategy as an experiment, without inventing metrics." },
  { label: "Suggest Divin8 keywords", prompt: "Suggest high-intent keyword themes for Divin8 Reports using only catalog facts." },
  { label: "Create an ad angle", prompt: "Create a Divin8 Reports ad angle that stays factual and avoids guaranteed outcomes." },
  { label: "Explain this page", prompt: "Explain this Ads page and what data will appear after Google Ads is connected." },
];

export default function AdsAgentDrawer() {
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const agent = useAdsAgent();
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<Array<{ name: string; mimeType: string; data: string }>>([]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text && !images.length) return;
    setDraft("");
    const attachments = images.map(({ mimeType, data }) => ({ mimeType, data }));
    setImages([]);
    void agent.sendMessage(text || "Analyze the attached screenshot.", attachments);
  }

  async function addFiles(fileList: FileList | File[]) {
    const files = [...fileList]
      .filter((file) => file.size <= 5 * 1024 * 1024)
      .slice(0, 4 - images.length);
    const next = await Promise.all(files.map(async (file) => {
      const data = await fileToBase64(file);
      return { name: file.name, mimeType: file.type || "image/png", data };
    }));
    setImages((current) => [...current, ...next].slice(0, 4));
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    const startX = event.clientX;
    const startWidth = agent.width;
    function onMove(moveEvent: globalThis.PointerEvent) {
      const next = Math.min(Math.max(startWidth + (startX - moveEvent.clientX), 320), 640);
      agent.setWidth(next);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (!agent.open) {
    return (
      <button
        type="button"
        data-ads-agent-rail
        aria-label="Open Ads Agent"
        onClick={() => agent.setOpen(true)}
        className={`absolute right-0 top-1/3 z-20 flex h-36 w-8 items-center justify-center rounded-l-lg border-y border-l text-[10px] font-semibold tracking-[0.24em] ${
          isLightTheme
            ? "border-slate-200 bg-white text-slate-600"
            : "border-white/10 bg-navy-medium text-white/70"
        }`}
      >
        <span className="rotate-180" style={{ writingMode: "vertical-rl" }}>ADS AI</span>
      </button>
    );
  }

  return (
    <aside
      data-ads-agent-drawer
      className={`absolute inset-y-0 right-0 z-20 flex ads-drawer-enter ${
        isLightTheme ? "bg-white shadow-2xl" : "bg-navy-medium shadow-2xl"
      }`}
      style={{ width: `min(${agent.width}px, 100vw)` }}
    >
      <button
        type="button"
        aria-label="Resize Ads Agent"
        onPointerDown={startResize}
        className={`w-1.5 shrink-0 cursor-ew-resize ${isLightTheme ? "bg-slate-200" : "bg-white/10"}`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className={`border-b px-4 py-3 ${isLightTheme ? "border-slate-200" : "border-white/10"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className={`text-base font-semibold ${isLightTheme ? "text-slate-900" : "text-white"}`}>Ads Agent</h2>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-accent-cyan">GLM 5.3 Flash</p>
              <p className={`text-xs ${isLightTheme ? "text-slate-600" : "text-white/65"}`}>
                {agent.health?.status === "connected" ? "OpenRouter Connected" : agent.healthLabel}
              </p>
              <p className={`mt-2 text-xs ${isLightTheme ? "text-slate-600" : "text-white/65"}`}>
                Context: {agent.contextLabel}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button type="button" onClick={() => agent.setOpen(false)} className="text-xs text-accent-cyan">
                Collapse
              </button>
              <button type="button" onClick={() => void agent.newConversation()} className="text-xs text-accent-cyan">
                New conversation
              </button>
              <button type="button" onClick={() => void agent.clearConversation()} className="text-xs text-accent-cyan">
                Clear
              </button>
              <Link to="/admin/ads/settings" className="text-xs text-accent-cyan">Agent settings</Link>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-4 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => void agent.sendMessage(action.prompt)}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  isLightTheme
                    ? "border-slate-200 text-slate-600 hover:bg-slate-100"
                    : "border-white/10 text-white/70 hover:bg-white/5"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
          {agent.messages.length === 0 ? (
            <p className={`text-sm ${isLightTheme ? "text-slate-500" : "text-white/50"}`}>
              Ask about Google Ads or Divin8 strategy. When Google Ads is connected in Settings, the agent can read live account metrics.
            </p>
          ) : (
            <div className="space-y-3">
              {agent.messages.map((message) => (
                <div
                  key={message.id}
                  data-ads-agent-message={message.role}
                  data-ads-agent-assistant={message.role === "assistant" ? "true" : undefined}
                  className={`rounded-2xl px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-accent-cyan/10 text-accent-cyan"
                      : isLightTheme
                        ? "bg-slate-50 text-slate-800"
                        : "bg-white/5 text-white/85"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <AdsAgentMarkdown markdown={message.content} isLightTheme={isLightTheme} />
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          {agent.sending ? (
            <p data-ads-agent-progress className="mt-3 text-xs text-accent-cyan">Ads Agent is thinking…</p>
          ) : null}
          {agent.error ? (
            <div
              data-ads-agent-error
              className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
              isLightTheme ? "border-rose-200 bg-rose-50 text-rose-700" : "border-rose-400/25 bg-rose-400/10 text-rose-100"
            }`}>
              <p>{agent.error}</p>
              <button type="button" className="mt-2 text-xs underline" onClick={() => void agent.retryLast()}>
                Retry
              </button>
            </div>
          ) : null}
        </div>

        <form onSubmit={submit} className={`border-t p-3 ${isLightTheme ? "border-slate-200" : "border-white/10"}`}>
          {images.length ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {images.map((image, index) => (
                <button
                  key={`${image.name}-${index}`}
                  type="button"
                  onClick={() => setImages((current) => current.filter((_, item) => item !== index))}
                  className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/10"
                  aria-label={`Remove ${image.name}`}
                >
                  <img src={`data:${image.mimeType};base64,${image.data}`} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          {images.length ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {["Analyze Performance", "Find Problems", "Review Search Terms", "Compare Screenshots"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setDraft(label === "Compare Screenshots" ? "Compare these screenshots in order." : `${label} from the attached screenshot.`);
                  }}
                  className="rounded-full border border-accent-cyan/30 px-2 py-0.5 text-[11px] text-accent-cyan"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <label className="shrink-0 cursor-pointer rounded-lg border border-accent-cyan/30 px-2 py-2 text-sm text-accent-cyan">
              +
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) void addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              onPaste={(event) => {
                const files = [...event.clipboardData.files].filter((file) => file.type.startsWith("image/"));
                if (files.length) {
                  event.preventDefault();
                  void addFiles(files);
                }
              }}
              rows={3}
              placeholder="Ask the Ads Agent…"
              className={`w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none ${
                isLightTheme
                  ? "border-slate-200 bg-white text-slate-900"
                  : "border-white/10 bg-white/5 text-white"
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={agent.sending || (!draft.trim() && !images.length)}
            className="mt-2 rounded-lg bg-accent-cyan/20 px-3 py-1.5 text-sm font-medium text-accent-cyan disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </aside>
  );
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
