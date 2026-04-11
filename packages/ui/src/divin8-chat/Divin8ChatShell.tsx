import { useEffect, useState, type ReactNode } from "react";

interface Divin8ChatShellProps {
  conversationList: ReactNode;
  chatWindow: ReactNode;
}

export default function Divin8ChatShell({ conversationList, chatWindow }: Divin8ChatShellProps) {
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex min-h-0 flex-1 gap-4 ${isDesktop ? "flex-row" : "flex-col"}`}>
        <div
          style={
            isDesktop
              ? {
                  flex: "0 0 300px",
                  width: "300px",
                  minWidth: "300px",
                  maxWidth: "300px",
                }
              : undefined
          }
        >
          {conversationList}
        </div>
        <div
          className="flex min-h-0 flex-col overflow-hidden"
          style={
            isDesktop
              ? {
                  flex: "1 1 0%",
                  minWidth: 0,
                }
              : undefined
          }
        >
          {chatWindow}
        </div>
      </div>
    </div>
  );
}
