import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { fetchGuestIntake, guestIntakePath, type GuestIntakeKind, type GuestIntakeView } from "../lib/guestIntake";

/**
 * Public post-purchase page for guest checkout (sessions, Divin8 reports, Manifestation
 * Monthly). Shows both intake links — Services and Divin8 Reports — and highlights the one that
 * matches this order. Mentoring Circle, shop and webinar purchases keep their own success pages
 * and never land here, so they never show intake links.
 */
export default function GuestThankYouPage() {
  const [params] = useSearchParams();
  const token = params.get("intake") ?? "";
  const kindParam = params.get("kind");
  const expectedKind: GuestIntakeKind | null = kindParam === "reports" || kindParam === "services" ? kindParam : null;
  const [view, setView] = useState<GuestIntakeView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  usePageMeta({
    title: "Thank you for your purchase | The Prime Mentor",
    description: "Your purchase is confirmed. Complete your intake form so everything is ready.",
    canonical: "",
  });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const next = await fetchGuestIntake(token);
        if (cancelled) return;
        setView(next);
        // Stripe can redirect a moment before the payment webhook lands; poll briefly.
        if (next.paymentStatus !== "paid" && attempts < 10) {
          attempts += 1;
          timer = setTimeout(() => void load(), 3000);
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "This link has expired or is no longer valid.");
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token]);

  const matchingKind: GuestIntakeKind | null = view?.kind ?? expectedKind;
  const submitted = view?.intakeStatus === "submitted";

  const cards = useMemo(() => ([
    {
      kind: "services" as const,
      title: "Services Intake Form",
      body: "For Q&A, Mentoring, Healing, Offline sessions and the Manifestation Monthly Package: your full name, birth details, availability and an optional photo.",
    },
    {
      kind: "reports" as const,
      title: "Divin8 Reports Intake Form",
      body: "For Divin8 Reports: your full name and birth details. No availability needed.",
    },
  ]), []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">Purchase confirmed</p>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Thank you for your purchase</h1>
      {view ? (
        <p className="mt-3 text-white/70">
          {view.productLabel}
          {view.email ? <> · confirmation sent to <span className="text-white">{view.email}</span></> : null}
        </p>
      ) : (
        <p className="mt-3 text-white/70">Your payment went through. We've emailed your receipt and these links.</p>
      )}
      {view && view.paymentStatus !== "paid" ? (
        <p className="mt-3 text-sm text-amber-100/80">Your payment is still being confirmed. You can start your intake now.</p>
      ) : null}

      {loadError ? (
        <div className="mt-8 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-5 text-sm text-amber-50/90">
          <p>{loadError}</p>
          <p className="mt-2">Use the link in your confirmation email, or <Link to="/contact" className="underline">contact us</Link>.</p>
        </div>
      ) : null}

      {submitted ? (
        <div className="mt-8 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-5 text-sm text-emerald-50">
          We have your intake form. There is nothing else you need to do right now.
        </div>
      ) : (
        <>
          <h2 className="mt-10 text-lg font-semibold">Next step: complete your intake form</h2>
          <p className="mt-2 text-sm text-white/60">
            This gets everything ready for your session or report. You can also do it later from the link in your email.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {cards.map((card) => {
              const isMatch = matchingKind === card.kind;
              const href = token ? guestIntakePath(card.kind, token) : null;
              return (
                <div
                  key={card.kind}
                  data-testid={`intake-card-${card.kind}`}
                  className={`rounded-2xl border p-5 transition ${
                    isMatch
                      ? "border-cyan-300/60 bg-cyan-400/10 shadow-[0_0_28px_rgba(34,211,238,0.14)]"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {isMatch ? (
                    <span className="inline-flex rounded-full bg-cyan-300/20 px-3 py-1 text-xs font-semibold text-cyan-100">For this order</span>
                  ) : null}
                  <h3 className="mt-3 text-base font-semibold">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">{card.body}</p>
                  {href ? (
                    <Link
                      to={href}
                      className={`mt-4 inline-flex rounded-xl px-5 py-3 text-sm font-semibold ${
                        isMatch
                          ? "bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 text-slate-950"
                          : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
                      }`}
                    >
                      Open {card.title}
                    </Link>
                  ) : (
                    <p className="mt-4 text-xs text-white/45">Use the link in your confirmation email.</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-10 text-sm text-white/50">
        Questions? Reply to your confirmation email or <Link to="/contact" className="underline">contact us</Link>.
      </p>
    </main>
  );
}
