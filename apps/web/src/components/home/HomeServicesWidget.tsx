import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles, Zap } from "lucide-react";
import {
  expressServiceHref,
  formatExpressPrice,
  getExpressService,
  EXPRESS_SERVICES,
  type ExpressServiceId,
} from "@wisdom/utils";
import GuestPayFirstButton from "../guest/GuestPayFirstButton";
import {
  formatGuidedSessionDisplayPrice,
  getGuidedSessionOption,
  type GuidedSessionDurationOption,
} from "../../lib/sessionCatalog";

type ServiceLane = "premium" | "express";
type PremiumId = "star" | "qa" | "mentoring" | "level2";

const PREMIUM_ITEMS: Array<{ id: PremiumId; label: string; summary: string }> = [
  { id: "star", label: "Star Initiation", summary: "Private session with Adronis. About 20–30 minutes on Zoom or by phone." },
  { id: "qa", label: "Q&A", summary: "You lead the conversation. Live on Zoom, with a recording." },
  { id: "mentoring", label: "Mentoring", summary: "A guided mentoring session through the Divin8 system." },
  { id: "level2", label: "Prime Body Healing Level 2", summary: "A comprehensive healing scan with a personalized MP3 and PDF report." },
];

const BUTTON_CLASS = "inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 px-5 py-3 text-sm font-semibold text-[#07111f]";

function premiumFromParam(value: string | null): PremiumId {
  if (value === "qa" || value === "mentoring" || value === "level2") return value;
  return "star";
}

export default function HomeServicesWidget() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const requestedLane: ServiceLane = params.get("serviceType") === "express" ? "express" : "premium";
  const requestedExpress = getExpressService(params.get("service"))?.id ?? "ask";
  const [lane, setLane] = useState<ServiceLane>(requestedLane);
  const [premiumId, setPremiumId] = useState<PremiumId>(premiumFromParam(params.get("premium")));
  const [expressId, setExpressId] = useState<ExpressServiceId>(requestedExpress);
  const baseId = useId();

  useEffect(() => {
    setLane(requestedLane);
    if (requestedLane === "express") setExpressId(requestedExpress);
  }, [requestedLane, requestedExpress]);

  useEffect(() => {
    if (location.hash !== "#services") return;
    document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, location.search]);

  function onLaneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setLane((current) => (current === "premium" ? "express" : "premium"));
  }

  return (
    <section id="services" className="relative scroll-mt-28 border-t border-white/8 py-12 sm:py-16" aria-labelledby="home-services-heading">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 max-w-3xl space-y-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-100/70">Services</p>
          <h2 id="home-services-heading" className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Premium & Express Services
          </h2>
          <p className="text-sm leading-7 text-white/68 sm:text-base">
            Book a live Premium Session, or send an Express request and receive an MP3. No appointment is required for Express.
          </p>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-cyan-200/15 bg-[#070b16]/80 shadow-[0_24px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(125,211,252,0.12)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[minmax(13rem,0.28fr)_minmax(0,1fr)]">
            <div
              role="tablist"
              aria-label="Service type"
              onKeyDown={onLaneKeyDown}
              className="grid grid-cols-2 gap-2 border-b border-white/10 p-3 lg:flex lg:flex-col lg:border-b-0 lg:border-r lg:p-4"
            >
              <LaneTab id={`${baseId}-premium`} selected={lane === "premium"} controls={`${baseId}-panel`} icon={Sparkles} label="Premium" onSelect={() => setLane("premium")} />
              <LaneTab id={`${baseId}-express`} selected={lane === "express"} controls={`${baseId}-panel`} icon={Zap} label="Express" onSelect={() => setLane("express")} />
            </div>
            <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={lane === "premium" ? `${baseId}-premium` : `${baseId}-express`} className="p-4 sm:p-6 lg:p-8">
              {lane === "premium" ? (
                <PremiumPanel selected={premiumId} onSelect={setPremiumId} />
              ) : (
                <ExpressPanel selected={expressId} onSelect={setExpressId} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LaneTab({
  id,
  selected,
  controls,
  icon: Icon,
  label,
  onSelect,
}: {
  id: string;
  selected: boolean;
  controls: string;
  icon: typeof Sparkles;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${
        selected
          ? "border-cyan-200/50 bg-cyan-300/10 text-white shadow-[inset_0_0_24px_rgba(34,211,238,0.12)]"
          : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white"
      }`}
    >
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${selected ? "border-cyan-200/40 text-cyan-100" : "border-white/10 text-white/55"}`} aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

function ServiceButton({ selected, label, onSelect }: { selected: boolean; label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${
        selected ? "border-cyan-200/50 bg-cyan-300/10 text-white" : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function PremiumPanel({ selected, onSelect }: { selected: PremiumId; onSelect: (id: PremiumId) => void }) {
  const item = PREMIUM_ITEMS.find((entry) => entry.id === selected) ?? PREMIUM_ITEMS[0];
  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2">
        {PREMIUM_ITEMS.map((entry) => (
          <ServiceButton key={entry.id} selected={entry.id === selected} label={entry.label} onSelect={() => onSelect(entry.id)} />
        ))}
      </div>
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <h3 className="text-xl font-semibold text-white">{item.label}</h3>
        <p className="text-sm leading-6 text-white/70">{item.summary}</p>
        {selected === "star" ? <StarCheckout /> : null}
        {selected === "qa" ? <DurationCheckout kind="qa" /> : null}
        {selected === "mentoring" ? <DurationCheckout kind="mentoring" /> : null}
        {selected === "level2" ? <Level2Checkout /> : null}
      </div>
    </div>
  );
}

function StarCheckout() {
  return (
    <GuestPayFirstButton
      visibleWhenSignedIn
      endpoint="/guest/bookings"
      extraBody={{ bookingTypeId: "star-initiation-session", deferIntake: true }}
      itemLabel="Star Initiation Session"
      label="Book Star Initiation — $99 CAD"
      className={BUTTON_CLASS}
    />
  );
}

function Level2Checkout() {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-cyan-100">$179 CAD</p>
      <GuestPayFirstButton
        visibleWhenSignedIn
        endpoint="/guest/bookings"
        extraBody={{ bookingTypeId: "prime-body-healing-level-2", deferIntake: true }}
        itemLabel="Prime Body Healing Level 2"
        label="Book Prime Body Healing Level 2 — $179 CAD"
        className={BUTTON_CLASS}
      />
    </div>
  );
}

function DurationCheckout({ kind }: { kind: "qa" | "mentoring" }) {
  const option = getGuidedSessionOption(kind);
  const durations = option?.durations ?? [];
  const [bookingTypeId, setBookingTypeId] = useState(durations[0]?.bookingTypeId ?? "");
  const selected = durations.find((duration) => duration.bookingTypeId === bookingTypeId) ?? durations[0];
  if (!option || !selected) return null;
  const choices = durations.map((duration) => ({
    label: durationLabel(duration),
    extraBody: { bookingTypeId: duration.bookingTypeId, deferIntake: true },
  }));
  const price = formatGuidedSessionDisplayPrice(selected);
  const label = kind === "qa" ? `Book Q&A Session — ${price}` : "Book Your Mentoring Session";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={kind === "qa" ? "Q&A length" : "Mentoring length"}>
        {durations.map((duration) => {
          const active = duration.bookingTypeId === selected.bookingTypeId;
          return (
            <button
              key={duration.bookingTypeId}
              type="button"
              aria-pressed={active}
              onClick={() => setBookingTypeId(duration.bookingTypeId)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-cyan-200/50 bg-cyan-300/15 text-white" : "border-white/15 text-white/70"}`}
            >
              {durationLabel(duration)}
            </button>
          );
        })}
      </div>
      <GuestPayFirstButton
        visibleWhenSignedIn
        endpoint="/guest/bookings"
        extraBody={{ bookingTypeId: selected.bookingTypeId, deferIntake: true }}
        choices={choices}
        choiceLabel="Session length"
        itemLabel={option.label}
        label={label}
        className={BUTTON_CLASS}
      />
    </div>
  );
}

function durationLabel(duration: GuidedSessionDurationOption) {
  const length = duration.durationLabel ?? `${duration.minutes} min`;
  return `${length} — ${formatGuidedSessionDisplayPrice(duration)}`;
}

function ExpressPanel({ selected, onSelect }: { selected: ExpressServiceId; onSelect: (id: ExpressServiceId) => void }) {
  const service = getExpressService(selected) ?? EXPRESS_SERVICES[0];
  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        {EXPRESS_SERVICES.map((entry) => (
          <ServiceButton key={entry.id} selected={entry.id === selected} label={`${entry.name} — ${formatExpressPrice(entry.priceCents)}`} onSelect={() => onSelect(entry.id)} />
        ))}
      </div>
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <h3 className="text-xl font-semibold text-white">{service.name}</h3>
        <p className="text-sm leading-6 text-white/70">{service.detail}</p>
        <p className="text-sm text-cyan-100">{formatExpressPrice(service.priceCents)}. Optional transcription is $9 CAD, added once at checkout.</p>
        <Link to={`/express/${service.id}`} className={BUTTON_CLASS}>
          Continue with {service.name}
        </Link>
        <p className="text-xs text-white/45">
          <Link to={expressServiceHref(service.id)} className="underline-offset-2 hover:underline">Share this selection</Link>
        </p>
      </div>
    </div>
  );
}
