import type { MembershipSignupPlan } from "../../config/membershipSignupPlans";

interface MembershipPlanCardProps {
  plan: MembershipSignupPlan;
  onSelect: (plan: MembershipSignupPlan) => void;
  busyTier: string | null;
  selected: boolean;
}

export default function MembershipPlanCard({ plan, onSelect, busyTier, selected }: MembershipPlanCardProps) {
  const isBusy = busyTier === plan.tier;
  const isPremium = plan.recommended;

  return (
    <div
      className={[
        "relative flex h-full flex-col rounded-2xl border p-6 sm:p-8",
        "bg-white/[0.04] backdrop-blur-md transition duration-300",
        selected
          ? "border-cyan-300/45 shadow-[0_0_0_1px_rgba(103,232,249,0.12),0_22px_56px_rgba(0,0,0,0.34),0_0_42px_rgba(34,211,238,0.08)]"
          : isPremium
          ? "border-cyan-400/35 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_24px_56px_rgba(0,0,0,0.35),0_0_40px_rgba(34,211,238,0.08)] md:scale-[1.02] md:shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_28px_64px_rgba(0,0,0,0.4),0_0_48px_rgba(34,211,238,0.1)]"
          : "border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.28)] hover:border-white/16",
      ].join(" ")}
    >
      {isPremium ? (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
          <span className="rounded-full border border-cyan-300/30 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.25),_rgba(5,8,20,0.95))] px-4 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-cyan-100/95">
            Most popular
          </span>
        </div>
      ) : null}

      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{plan.name}</h2>
        <p className="text-sm font-medium text-cyan-200/85">{plan.tagline}</p>
        <p className="pt-1 text-sm tabular-nums text-white/75">{plan.priceLabel}</p>
      </div>

      <p className="mt-5 flex-1 text-sm leading-relaxed text-white/62">{plan.description}</p>

      <ul className="mt-6 space-y-3 text-sm text-white/78">
        {plan.features.map((line) => (
          <li key={line} className="flex gap-3 leading-snug">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/70" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={isBusy}
        onClick={() => onSelect(plan)}
        className={[
          "mt-8 w-full rounded-xl py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04050f] disabled:cursor-not-allowed disabled:opacity-60",
          isPremium
            ? "bg-gradient-to-r from-cyan-400 to-teal-500 text-[#050816] shadow-[0_8px_28px_rgba(34,211,238,0.35)] hover:brightness-105"
            : "border border-white/14 bg-white/10 text-white hover:bg-white/16",
        ].join(" ")}
      >
        {isBusy ? "Redirecting…" : plan.ctaLabel}
      </button>
    </div>
  );
}
