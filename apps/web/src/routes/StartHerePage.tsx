import { Link } from "react-router-dom";
import StartHereDoors from "../components/home/StartHereDoors";
import HomeFaq from "../components/home/HomeFaq";
import { usePageMeta } from "../hooks/usePageMeta";
import { DEFAULT_OG_IMAGE, pageCanonical } from "../lib/siteMeta";

export default function StartHerePage() {
  usePageMeta({
    title: "Start here | The Prime Mentor",
    description:
      "Not sure where to begin? Choose a $39–$69 Divin8 report, a live Q&A from $139, or a Mentoring Session.",
    canonical: pageCanonical("/start-here"),
    ogImage: DEFAULT_OG_IMAGE,
  });

  return (
    <main className="relative text-white">
      <section className="px-6 pb-8 pt-12 sm:pt-16">
        <div className="mx-auto max-w-6xl space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">New here</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
            Start here
          </h1>
          <p className="max-w-2xl text-base leading-8 text-white/70">
            The site has many offers. You only need one first step: a written report, a live question, or a full mentoring session.
          </p>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <StartHereDoors showChooserLink={false} heading="Choose the door that matches this week" />
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <HomeFaq />
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm text-white/60">
            Prefer to browse?{" "}
            <Link to="/reports" className="text-cyan-100 underline-offset-4 hover:underline">All reports</Link>
            {" · "}
            <Link to="/#sessions" className="text-cyan-100 underline-offset-4 hover:underline">All sessions</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
