interface WebsiteStatusPageAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  preserveQuery?: boolean;
}

interface WebsiteStatusPageProps {
  eyebrow: string;
  code?: string;
  title: string;
  description: string;
  actions: WebsiteStatusPageAction[];
}

function getActionHref(href: string, preserveQuery: boolean) {
  if (!preserveQuery || typeof window === "undefined" || !window.location.search || /^https?:\/\//i.test(href)) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const queryIndex = href.indexOf("?");
  if (queryIndex >= 0) {
    return href;
  }

  if (hashIndex >= 0) {
    return `${href.slice(0, hashIndex)}${window.location.search}${href.slice(hashIndex)}`;
  }

  return `${href}${window.location.search}`;
}

function WebsiteStatusAction({ label, href, onClick, variant = "primary", preserveQuery = false }: WebsiteStatusPageAction) {
  const className = variant === "primary"
    ? "inline-flex items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
    : "inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/88 transition hover:bg-white/10 hover:text-white";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {label}
      </button>
    );
  }

  return (
    <a href={getActionHref(href ?? "/", preserveQuery)} className={className}>
      {label}
    </a>
  );
}

export default function WebsiteStatusPage({
  eyebrow,
  code,
  title,
  description,
  actions,
}: WebsiteStatusPageProps) {
  return (
    <section className="relative flex min-h-[calc(100vh-5rem)] items-center overflow-hidden bg-[#050816] px-6 py-20 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_38%),radial-gradient(circle_at_70%_20%,rgba(168,85,247,0.14),transparent_30%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_42%)]" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,24rem)] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/70">{eyebrow}</p>
          {code ? (
            <p className="mt-5 text-6xl font-semibold tracking-tight text-white/18 sm:text-7xl">
              {code}
            </p>
          ) : null}
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/68 sm:text-lg">
            {description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {actions.map((action) => (
              <WebsiteStatusAction
                key={`${action.label}:${action.href ?? "action"}`}
                {...action}
              />
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 backdrop-blur-xl">
          <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">Guidance</p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-white/70">
              <p>If you followed an old link, the page may have moved or been retired.</p>
              <p>If this happened unexpectedly, return to the main site and navigate from the current menu.</p>
              <p>If you still cannot reach what you need, use the contact page and let us know which link failed.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
