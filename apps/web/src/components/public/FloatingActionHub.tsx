import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

interface MenuItem {
  label: string;
  anchor?: string;
  href?: string;
  external?: boolean;
}

interface MenuSectionProps {
  title: string;
  items: MenuItem[];
  onSelectAnchor: (anchor: string) => void;
  onSelectAny: () => void;
}

interface FloatingActionHubProps {
  onNavigateAnchor: (anchor: string) => void;
}

function MenuSection({ title, items, onSelectAnchor, onSelectAny }: MenuSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between py-2 text-left text-sm text-white/90"
      >
        {title}
        <span className="text-base leading-none text-white/70">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="space-y-1 pb-3 pl-3 text-sm text-white/60">
          {items.map((item) => {
            if (item.anchor) {
              return (
                <button
                  key={`${title}-${item.label}`}
                  onClick={() => {
                    onSelectAnchor(item.anchor!);
                    onSelectAny();
                  }}
                  className="block w-full text-left transition hover:text-white"
                >
                  {item.label}
                </button>
              );
            }

            if (item.external && item.href) {
              return (
                <a
                  key={`${title}-${item.label}`}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onSelectAny}
                  className="block transition hover:text-white"
                >
                  {item.label}
                </a>
              );
            }

            return (
              <Link
                key={`${title}-${item.label}`}
                to={item.href ?? "/"}
                onClick={onSelectAny}
                className="block transition hover:text-white"
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const HUB_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: "Sessions",
    items: [
      { label: "Focus Session", anchor: "#sessions" },
      { label: "Regeneration Monthly Package", anchor: "#sessions" },
      { label: "Mentoring Session", anchor: "#sessions" },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Entry Report", anchor: "#reports" },
      { label: "Deep Dive Report", anchor: "#reports" },
      { label: "Initiate Report", anchor: "#reports" },
    ],
  },
  {
    title: "Subscriptions",
    items: [
      { label: "Membership Tiers", anchor: "#subscriptions" },
      { label: "What's Included", anchor: "#subscriptions" },
    ],
  },
  {
    title: "Events",
    items: [
      { label: "Mentoring Circle Monthly", anchor: "#events" },
      { label: "Prime Mentor Podcast", anchor: "#events" },
    ],
  },
];

export default function FloatingActionHub({ onNavigateAnchor }: FloatingActionHubProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-white/20"
      >
        <span>Prime Mentor</span>
        <span className="inline-block animate-bounce">↑</span>
      </button>

      <div
        className={`absolute bottom-14 right-0 w-[min(90vw,22rem)] rounded-2xl border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out sm:w-80 ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="space-y-3">
          {HUB_SECTIONS.map((section) => (
            <MenuSection
              key={section.title}
              title={section.title}
              items={section.items}
              onSelectAnchor={onNavigateAnchor}
              onSelectAny={() => setOpen(false)}
            />
          ))}
        </div>

        <Link
          to="/contact"
          onClick={() => setOpen(false)}
          className="mt-3 block rounded-lg bg-white/10 py-2 text-center text-white transition hover:bg-white/20"
        >
          Contact
        </Link>
      </div>
    </div>
  );
}
