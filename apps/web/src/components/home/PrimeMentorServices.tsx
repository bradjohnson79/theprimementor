import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { HeartPulse, Mail, Sparkles, Video } from "lucide-react";
import { getActiveSessionOfferingByBookingTypeId } from "@wisdom/utils";
import { trackEvent, trackEventOnce } from "../../lib/analytics";
import {
  GUIDED_SESSION_OPTIONS,
  buildGuidedSessionBookingPath,
  formatGuidedSessionDisplayPrice,
  type GuidedSessionDurationOption,
  type GuidedSessionOption,
} from "../../lib/sessionCatalog";
import {
  EMAIL_SESSION_BOOKING_PATH,
  PAST_LIFE_AKASHIC_BOOKING_PATH,
  PRIME_BODY_HEALING_BOOKING_PATH,
  PRIME_BODY_HEALING_LANDING_PATH,
  REGENERATION_BOOKING_PATH,
  REGENERATION_LANDING_PATH,
} from "../../lib/sessionLandingPaths";

type ServiceCategoryId = "live" | "offline" | "healing" | "manifestation";

const CATEGORIES: Array<{
  id: ServiceCategoryId;
  label: string;
  icon: typeof Video;
}> = [
  { id: "live", label: "Live Sessions", icon: Video },
  { id: "offline", label: "Offline Sessions", icon: Mail },
  { id: "healing", label: "Healing Sessions", icon: HeartPulse },
  { id: "manifestation", label: "Manifestation", icon: Sparkles },
];

const PURCHASE_NOTE = "Create a Free Account or Sign-in to Purchase";

function formatOfferingPrice(bookingTypeId: string, suffix = "") {
  const offering = getActiveSessionOfferingByBookingTypeId(bookingTypeId);
  if (!offering) return "";
  const amount = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: offering.currency,
    maximumFractionDigits: 0,
  }).format(offering.amountCents / 100);
  return `${amount} ${offering.currency}${suffix}`;
}

function trackCategory(category: ServiceCategoryId) {
  trackEventOnce(`analytics:services-category:${category}`, "services_category_view", {
    category,
    service_type: category,
  });
}

function useTabOrientation() {
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const apply = () => setOrientation(query.matches ? "vertical" : "horizontal");
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return orientation;
}

export default function PrimeMentorServices() {
  const [active, setActive] = useState<ServiceCategoryId>("live");
  const orientation = useTabOrientation();
  const baseId = useId();
  const panelId = `${baseId}-panel`;

  useEffect(() => {
    trackCategory(active);
  }, [active]);

  function selectCategory(next: ServiceCategoryId) {
    setActive(next);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = CATEGORIES.findIndex((category) => category.id === active);
    const lastIndex = CATEGORIES.length - 1;
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    const next = CATEGORIES[nextIndex];
    if (!next) return;
    setActive(next.id);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  }

  return (
    <section id="sessions" className="relative scroll-mt-28 border-t border-white/8 py-12 sm:py-16" aria-labelledby="prime-mentor-services-heading">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 max-w-3xl space-y-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-100/70">Services</p>
          <h2 id="prime-mentor-services-heading" className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Prime Mentor Services
          </h2>
          <p className="text-sm leading-7 text-white/68 sm:text-base">
            Choose the type of support you are looking for.
          </p>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-cyan-200/15 bg-[#070b16]/80 shadow-[0_24px_80px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(125,211,252,0.12)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[minmax(13rem,0.28fr)_minmax(0,1fr)]">
            <div
              role="tablist"
              aria-label="Prime Mentor Services"
              aria-orientation={orientation}
              onKeyDown={onTabKeyDown}
              className="grid grid-cols-2 gap-2 border-b border-white/10 p-3 sm:grid-cols-4 lg:flex lg:flex-col lg:gap-2 lg:border-b-0 lg:border-r lg:p-4"
            >
              {CATEGORIES.map((category) => {
                const selected = category.id === active;
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    id={`${baseId}-tab-${category.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectCategory(category.id)}
                    className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${
                      selected
                        ? "border-cyan-200/50 bg-cyan-300/10 text-white shadow-[inset_0_0_24px_rgba(34,211,238,0.12)]"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${selected ? "border-cyan-200/40 text-cyan-100" : "border-white/10 text-white/55"}`} aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold leading-5">{category.label}</span>
                    {selected ? <span className="ml-auto hidden h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.8)] lg:inline-block" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>

            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${active}`}
              className="p-4 sm:p-6 lg:p-8"
            >
              {active === "live" ? <LiveSessionsPanel /> : null}
              {active === "offline" ? <OfflineSessionsPanel /> : null}
              {active === "healing" ? <HealingSessionsPanel /> : null}
              {active === "manifestation" ? <ManifestationPanel /> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PanelIntro({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-5 max-w-3xl space-y-2">
      <h3 className="text-xl font-semibold text-white sm:text-2xl">{title}</h3>
      <p className="text-sm leading-7 text-white/68">{body}</p>
    </div>
  );
}

function LiveSessionsPanel() {
  return (
    <div>
      <PanelIntro
        title="Live Sessions"
        body="Connect privately with Brad through a live Q&A or a deeper mentoring session."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {GUIDED_SESSION_OPTIONS.map((option) => (
          <LiveSessionCard key={option.sessionType} option={option} />
        ))}
      </div>
    </div>
  );
}

function LiveSessionCard({ option }: { option: GuidedSessionOption }) {
  const [selectedId, setSelectedId] = useState(option.durations[0]?.bookingTypeId ?? "");
  const selected = option.durations.find((duration) => duration.bookingTypeId === selectedId) ?? option.durations[0];
  const href = selected
    ? buildGuidedSessionBookingPath({
      intakeType: option.intakeType,
      minutes: selected.minutes,
      bookingTypeId: selected.bookingTypeId,
      productKey: selected.productKey,
    })
    : "/sessions";
  const cta = option.sessionType === "qa_session" ? "Book Q&A Session" : "Book Mentoring Session";

  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h4 className="text-lg font-semibold text-white">{option.label}</h4>
      <p className="mt-2 flex-1 text-sm leading-6 text-white/68">{option.description}</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={`${option.label} durations`}>
        {option.durations.map((duration) => (
          <DurationChoice
            key={duration.bookingTypeId}
            duration={duration}
            selected={duration.bookingTypeId === selected?.bookingTypeId}
            onSelect={() => setSelectedId(duration.bookingTypeId)}
          />
        ))}
      </div>
      {selected ? (
        <p className="mt-3 text-sm font-medium text-amber-100/90">{formatGuidedSessionDisplayPrice(selected)}</p>
      ) : null}
      <Link
        to={href}
        onClick={() => trackEvent("service_cta_click", {
          category: "live",
          service_type: option.sessionType,
          service_name: option.label,
          duration: selected?.minutes,
          price: selected ? selected.priceCents / 100 : undefined,
        })}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
      >
        {cta}
      </Link>
      <p className="mt-2 text-center text-xs text-white/50">{PURCHASE_NOTE}</p>
    </article>
  );
}

function DurationChoice({
  duration,
  selected,
  onSelect,
}: {
  duration: GuidedSessionDurationOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`min-h-10 rounded-full border px-3 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${
        selected ? "border-cyan-200/60 bg-cyan-300/15 text-white" : "border-white/12 text-white/70 hover:border-white/25 hover:text-white"
      }`}
    >
      {duration.minutes} min
    </button>
  );
}

function OfflineSessionsPanel() {
  const emailPrice = formatOfferingPrice("email-session");
  const readingPrice = formatOfferingPrice("past-life-akashic-reading");
  return (
    <div>
      <PanelIntro
        title="Offline Sessions"
        body="Private recorded sessions with a clear deliverable. No scheduling and no Zoom appointment."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <OfflineCard
          title="Email Session"
          price={emailPrice}
          imageSrc="/images/email-session.png"
          imageAlt="Email Session artwork"
          description="Ask up to three questions for Brad or Adronis and receive a privately recorded MP3 response by email."
          facts={["Up to 3 questions", "Brad / Adronis", "MP3 delivery", "No appointment required"]}
          cta="Start Email Session"
          href={EMAIL_SESSION_BOOKING_PATH}
          serviceType="email_session"
        />
        <OfflineCard
          title="Past Life Akashic Reading"
          price={readingPrice}
          imageSrc="/images/past-life-akashic-reading.png"
          imageAlt="Past Life Akashic Reading artwork"
          description="Explore and interpret one past life within your Akashic Records through a private reading with Brad Johnson."
          facts={["One past-life exploration", "Akashic Records", "Private reading", "MP3 delivery"]}
          cta="Request Reading"
          href={PAST_LIFE_AKASHIC_BOOKING_PATH}
          serviceType="past_life_akashic"
        />
      </div>
    </div>
  );
}

function OfflineCard({
  title,
  price,
  imageSrc,
  imageAlt,
  description,
  facts,
  cta,
  href,
  serviceType,
}: {
  title: string;
  price: string;
  imageSrc: string;
  imageAlt: string;
  description: string;
  facts: string[];
  cta: string;
  href: string;
  serviceType: string;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-cyan-200/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_42%),rgba(255,255,255,0.03)]">
      <img src={imageSrc} alt={imageAlt} className="aspect-[16/9] w-full object-cover" loading="lazy" decoding="async" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-lg font-semibold text-white">{title}</h4>
          <p className="shrink-0 text-sm font-semibold text-amber-100">{price}</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-white/70">{description}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-white/75">
          {facts.map((fact) => (
            <li key={fact} className="flex gap-2">
              <span className="text-cyan-200" aria-hidden="true">✓</span>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
        <Link
          to={href}
          onClick={() => trackEvent("service_cta_click", {
            category: "offline",
            service_type: serviceType,
            service_name: title,
            price,
          })}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          {cta}
        </Link>
        <p className="mt-2 text-center text-xs text-white/50">{PURCHASE_NOTE}</p>
      </div>
    </article>
  );
}

function HealingSessionsPanel() {
  return (
    <div>
      <PanelIntro
        title="Healing Sessions"
        body="Deeper energetic, intuitive, and restorative rejuvenation across the physical and subtle body."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <HealingCard
          level="Level 1"
          price={formatOfferingPrice("prime-body-healing-level-1-live")}
          imageSrc="/images/prime-body-healing-level-1.png"
          imageAlt="Prime Body Healing Level 1 artwork"
          description="Work with up to five selected areas. Choose a live 15-minute session or a personalized pre-recorded MP3."
          href={`${PRIME_BODY_HEALING_BOOKING_PATH}?level=1`}
          serviceName="Prime Body Healing Level 1"
        />
        <HealingCard
          level="Level 2"
          price={formatOfferingPrice("prime-body-healing-level-2")}
          imageSrc="/images/prime-body-healing-level-2.png"
          imageAlt="Prime Body Healing Level 2 artwork"
          description="A full energetic scan and healing, plus a personalized MP3 and PDF report."
          href={`${PRIME_BODY_HEALING_BOOKING_PATH}?level=2`}
          serviceName="Prime Body Healing Level 2"
        />
      </div>
      <Link
        to={PRIME_BODY_HEALING_LANDING_PATH}
        className="mt-4 inline-flex text-sm text-cyan-100/80 underline-offset-4 hover:underline"
      >
        Explore Prime Body Healing
      </Link>
    </div>
  );
}

function HealingCard({
  level,
  price,
  imageSrc,
  imageAlt,
  description,
  href,
  serviceName,
}: {
  level: string;
  price: string;
  imageSrc: string;
  imageAlt: string;
  description: string;
  href: string;
  serviceName: string;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
      <img src={imageSrc} alt={imageAlt} className="aspect-[4/3] w-full object-contain p-2" loading="lazy" decoding="async" />
      <div className="space-y-3 border-t border-white/8 p-4">
        <p className="text-sm font-semibold text-amber-100">Prime Body Healing — {level}</p>
        <p className="text-sm text-white/80">{price}</p>
        <p className="text-sm leading-6 text-white/65">{description}</p>
        <Link
          to={href}
          onClick={() => trackEvent("service_cta_click", {
            category: "healing",
            service_type: "prime_body_healing",
            service_name: serviceName,
            price,
          })}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
        >
          Book Now
        </Link>
        <p className="text-center text-xs text-white/50">{PURCHASE_NOTE}</p>
      </div>
    </article>
  );
}

function ManifestationPanel() {
  const price = formatOfferingPrice("regeneration-session", " / month");
  const facts = [
    "Monthly private consultation",
    "Safeguarded manifestation work",
    "Offline anti-goal clearing",
    "Personalized MP3 clearing exercises",
    "Priority email support",
  ];
  return (
    <div>
      <PanelIntro
        title="Manifestation"
        body="Ongoing 1-to-1 manifestation support with Brad Johnson."
      />
      <article className="grid overflow-hidden rounded-2xl border border-amber-200/20 bg-white/[0.04] lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <img
          src="/images/manifestation-monthly-package.png"
          alt="Manifestation Monthly Package artwork"
          className="aspect-[4/3] h-full w-full object-cover lg:aspect-auto"
          loading="lazy"
          decoding="async"
        />
        <div className="space-y-4 p-5">
          <div>
            <h4 className="text-lg font-semibold text-white">Manifestation Monthly Package</h4>
            <p className="mt-1 text-sm font-semibold text-amber-100">{price}</p>
          </div>
          <p className="text-sm leading-6 text-white/70">
            Ongoing 1-to-1 manifestation support with Brad Johnson for maintaining your preferred state, clearing resistance and supporting the life changes you are actively creating.
          </p>
          <ul className="space-y-1.5 text-sm text-white/75">
            {facts.map((fact) => (
              <li key={fact} className="flex gap-2">
                <span className="text-amber-200" aria-hidden="true">✓</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-white/70">Additional Manifestation Request +$29 CAD for the first month, if you choose it during intake.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to={REGENERATION_BOOKING_PATH}
              onClick={() => trackEvent("service_cta_click", {
                category: "manifestation",
                service_type: "regeneration",
                service_name: "Manifestation Monthly Package",
                price,
              })}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-amber-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
            >
              Begin Monthly Cycle
            </Link>
            <Link
              to={REGENERATION_LANDING_PATH}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/8"
            >
              Learn More
            </Link>
          </div>
          <p className="text-xs text-white/50">{PURCHASE_NOTE}</p>
        </div>
      </article>
    </div>
  );
}
