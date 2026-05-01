import { useEffect, useState, type ReactNode } from "react";

type MobilePanel = "chat" | "conversations" | "profiles";

interface Divin8ChatShellProps {
  isLightTheme: boolean;
  desktopSidebar: ReactNode;
  chatWindow: ReactNode;
  mobileConversationList: ReactNode;
  mobileProfileList: ReactNode;
  mobilePanel: MobilePanel;
  onMobilePanelChange: (panel: MobilePanel) => void;
}

const MOBILE_PANEL_LABELS: Record<MobilePanel, string> = {
  chat: "Chat",
  conversations: "Conversations",
  profiles: "Profiles",
};

export default function Divin8ChatShell({
  isLightTheme,
  desktopSidebar,
  chatWindow,
  mobileConversationList,
  mobileProfileList,
  mobilePanel,
  onMobilePanelChange,
}: Divin8ChatShellProps) {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(min-width: 768px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`flex min-h-0 flex-1 gap-4 ${isDesktop ? "flex-row" : "flex-col"}`}>
        {isDesktop ? (
          <div
            className="flex min-h-0 flex-col"
            style={{
              flex: "0 0 300px",
              width: "300px",
              minWidth: "300px",
              maxWidth: "300px",
            }}
          >
            {desktopSidebar}
          </div>
        ) : (
          <div className="shrink-0">
            <div
              className={[
                "rounded-2xl border p-1",
                isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.03]",
              ].join(" ")}
            >
              <div
                className="grid grid-cols-3 gap-1"
                role="tablist"
                aria-label="Divin8 chat sections"
              >
                {(["chat", "conversations", "profiles"] as const).map((panel) => {
                  const isActive = mobilePanel === panel;
                  return (
                    <button
                      key={panel}
                      type="button"
                      role="tab"
                      id={`divin8-mobile-tab-${panel}`}
                      aria-controls={`divin8-mobile-panel-${panel}`}
                      aria-selected={isActive}
                      onClick={() => onMobilePanelChange(panel)}
                      className={[
                        "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                        isActive
                          ? "bg-accent-cyan text-slate-950"
                          : isLightTheme
                            ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            : "text-white/65 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
                    >
                      {MOBILE_PANEL_LABELS[panel]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <div
          className="flex min-h-0 flex-col overflow-hidden"
          role={!isDesktop ? "tabpanel" : undefined}
          id={!isDesktop ? `divin8-mobile-panel-${mobilePanel}` : undefined}
          aria-labelledby={!isDesktop ? `divin8-mobile-tab-${mobilePanel}` : undefined}
          style={
            isDesktop
              ? {
                  flex: "1 1 0%",
                  minWidth: 0,
                }
              : {
                  flex: "1 1 0%",
                  minHeight: 0,
                }
          }
        >
          {isDesktop
            ? chatWindow
            : mobilePanel === "chat"
              ? chatWindow
              : mobilePanel === "conversations"
                ? mobileConversationList
                : mobileProfileList}
        </div>
      </div>
    </div>
  );
}
