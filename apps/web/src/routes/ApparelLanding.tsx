import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { pageCanonical, DEFAULT_OG_IMAGE } from "../lib/siteMeta";
import {
  APPAREL_DESIGNS,
  APPAREL_TOPICS,
  formatApparelFromPrice,
  getDesignsByTopic,
  type ApparelTopic,
} from "../data/apparel";
import { getBalancedCardImages } from "../data/apparelModels";
import ApparelInstructionManual from "../components/shop/ApparelInstructionManual";

export default function ApparelLanding() {
  usePageMeta({
    title: "Apparel | Sacred Geometry Art | The Prime Mentor Shop",
    description: "Sacred geometry mandalas, dragon and phoenix designs, and kids' artwork on premium apparel. Printed and shipped by Spreadshirt.",
    canonical: pageCanonical("/shop/apparel"),
    ogImage: DEFAULT_OG_IMAGE,
  });

  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const displayedDesigns = activeTopic
    ? getDesignsByTopic(activeTopic)
    : [...APPAREL_DESIGNS].sort((a, b) => a.featuredRank - b.featuredRank);
  
  const cardImages = useMemo(() => {
    const slugs = displayedDesigns.map(d => d.slug);
    return getBalancedCardImages(slugs);
  }, [displayedDesigns]);

  return (
    <main id="top" className="min-h-screen text-white">
      <section className="relative overflow-hidden px-6 pb-16 pt-[0.6rem] md:pt-[0.8rem]">
        <div className="absolute inset-x-0 top-20 -z-10 mx-auto h-72 max-w-4xl rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">
            The Prime Mentor Shop
          </p>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-tight md:text-7xl">
            Sacred Geometry Apparel
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/72">
            Explore original sacred geometry mandalas, dragon and phoenix designs, and kids' artwork on premium apparel.
            Printed and shipped by Spreadshirt.
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTopic(null)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                activeTopic === null
                  ? "bg-accent-cyan text-slate-950"
                  : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              All Designs
            </button>
            {APPAREL_TOPICS.map((topic: ApparelTopic) => (
              <button
                key={topic.slug}
                type="button"
                onClick={() => setActiveTopic(topic.slug)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                  activeTopic === topic.slug
                    ? "bg-accent-cyan text-slate-950"
                    : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {topic.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayedDesigns.map((design) => {
              const fromPrice = formatApparelFromPrice(design);
              const card = cardImages.get(design.slug);
              const isKids = design.slug.startsWith("kids-");
              return (
              <article key={design.slug} className="glass-card flex h-full flex-col rounded-3xl p-6">
                <Link to={`/shop/apparel/${design.slug}`} className="group">
                  <div className="overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#ececef]">
                    <img
                      src={card?.src}
                      alt={card?.alt ?? design.title}
                      className="aspect-[4/5] w-full object-contain object-top transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="mt-4 flex items-start gap-2">
                    <h2 className="min-w-0 flex-1 text-xl font-semibold leading-snug text-white group-hover:text-accent-cyan transition-colors">
                      {design.title}
                    </h2>
                    {!isKids && (
                      <span className="shrink-0 rounded-full bg-cyan-400/15 border border-cyan-300/40 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-cyan-100">
                        Unisex
                      </span>
                    )}
                  </div>
                  {fromPrice ? (
                    <p className="mt-2 text-sm font-semibold tabular-nums text-amber-100">{fromPrice}</p>
                  ) : null}
                </Link>
                <p className="mt-3 flex-1 text-sm leading-7 text-white/68">
                  {design.description}
                </p>
                <Link
                  to={`/shop/apparel/${design.slug}`}
                  className="mt-6 inline-flex justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:from-cyan-300 hover:to-cyan-500 transition-all"
                >
                  View Design
                </Link>
              </article>
              );
            })}
          </div>

          {displayedDesigns.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center">
              <h2 className="text-2xl font-semibold">No designs found</h2>
              <p className="mt-3 text-white/68">Try selecting a different category.</p>
              <button
                type="button"
                onClick={() => setActiveTopic(null)}
                className="mt-6 inline-flex rounded-xl bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-slate-950"
              >
                Show All Designs
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-semibold">About Our Apparel</h2>
          <p className="mt-4 text-base leading-8 text-white/72">
            Each design is printed on-demand on premium apparel, including women's and men's t-shirts, tank tops,
            hoodies, and kids' and baby pieces. When you click "Buy on Spreadshop," you'll be taken to our partner Spreadshop to
            complete your purchase. All items are printed and shipped directly by Spreadshirt.
          </p>
          <p className="mt-4 text-base leading-8 text-white/72">
            All our designs are AI free. All designs on The Prime Mentor Shop were built with natural geometric artistry.
          </p>
          <ApparelInstructionManual className="mx-auto mt-8 max-w-md" />
          <Link
            to="/shop"
            className="mt-8 inline-flex rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Back to Shop
          </Link>
        </div>
      </section>
    </main>
  );
}
