import { trackCtaClick } from "../../lib/analytics";

const PATREON_URL = "https://www.patreon.com/adronis";
const BANNER_SRC = "/images/adronis-patreon-banner.jpg";

export default function AdronisPatreonHomeBanner() {
  return (
    <section
      id="adronis-patreon"
      aria-labelledby="adronis-patreon-heading"
      className="relative px-4 py-10 sm:px-6 sm:py-14"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-[1.75rem] border border-amber-200/30 shadow-[0_0_0_1px_rgba(212,175,55,0.16),0_0_42px_rgba(34,211,238,0.16),0_24px_70px_rgba(0,0,0,0.35)]">
          <img
            src={BANNER_SRC}
            alt="Adronis Patreon. $25 per month includes a bi-weekly Sunday class with Brad Johnson and Adronis, a weekly Adronis Answers video, and the chance to ask questions. $99 per month adds a 30-minute Q&A session once each month."
            width={1024}
            height={438}
            className="aspect-[21/9] h-auto w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <h2 id="adronis-patreon-heading" className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            Go Deeper with Brad Johnson &amp; Adronis
          </h2>
          <p className="text-sm leading-7 text-white/68 sm:text-base">
            Join the Adronis Patreon community for bi-weekly Sunday classes, exclusive weekly Adronis Answers videos, and opportunities to submit your questions.
          </p>
          <p className="text-sm leading-7 text-white/68 sm:text-base">
            Choose the $25/month membership or the $99/month tier featuring a monthly 30-minute Q&amp;A session with Brad Johnson and Adronis.
          </p>
        </div>

        <div className="flex justify-center">
          <a
            href={PATREON_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackCtaClick("join_adronis_patreon", "home_adronis_patreon", { href: PATREON_URL })}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold tracking-[0.08em] text-slate-950 shadow-[0_18px_45px_rgba(251,191,36,0.18)] transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            JOIN ADRONIS ON PATREON
          </a>
        </div>
      </div>
    </section>
  );
}
