import { Link, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { pageCanonical } from "../lib/siteMeta";
import { ORGANIZATION_ID } from "../lib/structuredData";
import WebsiteStatusPage from "../components/public/WebsiteStatusPage";
import {
  PRODUCT_CODES,
  formatApparelFromPrice,
  getDesignBySlug,
  getRelatedDesigns,
  getApparelImagePath,
  buildSpreadshopUrl,
  APPAREL_CONFIG,
  type ApparelDesign,
} from "../data/apparel";
import { apparelModelSrc, getApparelModelShots } from "../data/apparelModels";
import { REJUVENATION_LINE, getApparelWriteup } from "../data/apparelWriteups";

export default function ApparelProduct() {
  const { slug } = useParams();
  const design = slug ? getDesignBySlug(slug) : undefined;

  usePageMeta({
    title: design ? `${design.title} | The Prime Mentor Shop` : "Apparel | The Prime Mentor Shop",
    description: design?.description || "Sacred geometry art on premium apparel.",
    canonical: pageCanonical(`/shop/apparel/${slug ?? ""}`),
    ogImage: design ? `https://theprimementor.com${getApparelImagePath(design)}` : undefined,
    jsonLd: design ? [{
      "@context": "https://schema.org",
      "@type": "Product",
      name: design.title,
      description: design.description,
      url: pageCanonical(`/shop/apparel/${design.slug}`),
      brand: { "@type": "Brand", name: "The Prime Mentor" },
      image: [
        `https://theprimementor.com${getApparelImagePath(design)}`,
        ...getApparelModelShots(design.slug)
          .filter((shot) => shot.source === "spreadshop")
          .map((shot) => `https://theprimementor.com${apparelModelSrc(design.slug, shot.file)}`),
      ],
      offers: {
        "@type": "AggregateOffer",
        url: pageCanonical(`/shop/apparel/${design.slug}`),
        availability: "https://schema.org/InStock",
        seller: { "@id": ORGANIZATION_ID },
        ...(APPAREL_CONFIG.showPrices && design.fromPriceCAD != null
          ? { priceCurrency: "CAD", lowPrice: design.fromPriceCAD.toFixed(2) }
          : {}),
      },
    }] : undefined,
  });

  if (!design) {
    return (
      <WebsiteStatusPage
        eyebrow="Apparel"
        code="404"
        title="Design not found"
        description="The apparel design you're looking for doesn't exist or may have been removed."
        actions={[
          { label: "Browse Apparel", href: "/shop/apparel", preserveQuery: true },
          { label: "Back to Shop", href: "/shop", variant: "secondary", preserveQuery: true },
        ]}
      />
    );
  }

  const relatedDesigns = getRelatedDesigns(design, 3);
  const spreadshopUrl = buildSpreadshopUrl(design);
  const fromPrice = formatApparelFromPrice(design);
  const modelShots = getApparelModelShots(design.slug);
  const writeup = getApparelWriteup(design.slug);

  return (
    <main className="min-h-screen px-6 pb-20 pt-[0.6rem] text-white md:pt-[0.8rem]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 md:flex-row md:items-start md:gap-10">
        <img
          src={getApparelImagePath(design)}
          alt={design.title}
          className="w-full max-w-md shrink-0 rounded-3xl border border-cyan-300/25 object-contain shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
          loading="eager"
          decoding="async"
        />

        <div className="min-w-0 w-full md:flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan [text-shadow:-2px_-2px_0_#000,2px_-2px_0_#000,-2px_2px_0_#000,2px_2px_0_#000,0_-2px_0_#000,0_2px_0_#000,-2px_0_#000,2px_0_#000]">
            The Prime Mentor Shop
          </p>
          <div className="mt-4 inline-flex rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
            Sacred Geometry Apparel
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
            {design.title}
          </h1>
          {fromPrice ? (
            <p className="mt-4 text-2xl font-semibold tabular-nums text-amber-100">{fromPrice}</p>
          ) : null}
          <p className="mt-6 text-lg leading-8 text-white/72">
            {design.description}
          </p>

          {design.enableFirst.length > 0 ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">
                Available on
              </h2>
              <ul className="mt-3 space-y-2">
                {design.enableFirst.slice(0, 6).map((code) => (
                  <li key={code} className="flex items-center text-sm text-white/75">
                    <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    {PRODUCT_CODES[code] || code}
                  </li>
                ))}
              </ul>
              {design.enableFirst.length > 6 ? (
                <p className="mt-2 text-xs text-white/60">
                  + {design.enableFirst.length - 6} more product types
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3">
            <a
              href={spreadshopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-600 px-6 py-3.5 text-base font-semibold text-slate-950 hover:from-cyan-300 hover:to-cyan-500 transition-all"
            >
              Buy on Spreadshop
              <ExternalLink className="h-4 w-4" />
            </a>
            <p className="text-center text-sm text-white/60">
              Printed and shipped by Spreadshirt. Checkout completes on Spreadshop.
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs leading-6 text-white/70">
              This design is available on a range of premium apparel. Click "Buy on Spreadshop" to explore all
              product options, sizes, and colors. Purchases are processed securely through our partner Spreadshop,
              and items are printed and shipped directly to you by Spreadshirt.
            </p>
          </div>
        </div>
      </div>

      {modelShots.length > 0 || writeup ? (
        <section className="mx-auto mt-16 max-w-6xl" aria-label="This design printed on apparel">
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
            <div>
              <h2 className="text-2xl font-semibold">Printed on</h2>
              <p className="mt-2 text-sm leading-7 text-white/60">
                Six different pieces this design is sold on. These photos are from the live Spreadshop pages for this artwork.
              </p>
              <div className="glass-card mt-6 rounded-3xl p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-cyan">From this design</p>
                <p className="mt-4 text-base leading-8 text-white/80">{REJUVENATION_LINE}</p>
                {writeup ? <p className="mt-4 text-base leading-8 text-white/72">{writeup}</p> : null}
              </div>
            </div>
            {modelShots.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {modelShots.map((shot) => (
                  <figure key={shot.file} className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#070b16]">
                    <div className="bg-[#ececef]">
                      <img
                        src={apparelModelSrc(design.slug, shot.file)}
                        alt={shot.alt}
                        className="aspect-[4/5] w-full object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <figcaption className="px-4 py-3">
                      <p className="text-sm font-semibold text-white">{shot.label}</p>
                      {shot.source === "mockup" ? (
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/80">Studio preview</p>
                      ) : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {design.tags.length > 0 ? (
        <section className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/60">Tags</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {design.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/75"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {relatedDesigns.length > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl border-t border-white/10 pt-12">
          <h2 className="text-2xl font-semibold">Related Designs</h2>
          <p className="mt-2 text-sm text-white/60">
            More designs from the same collection
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedDesigns.map((related: ApparelDesign) => {
              const relatedPrice = formatApparelFromPrice(related);
              return (
              <article key={related.slug} className="glass-card flex h-full flex-col rounded-3xl p-6">
                <Link to={`/shop/apparel/${related.slug}`} className="group">
                  <div className="overflow-hidden rounded-2xl border border-cyan-300/25 bg-black/30">
                    <img
                      src={getApparelImagePath(related)}
                      alt={related.title}
                      className="aspect-square w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-accent-cyan transition-colors">
                    {related.title}
                  </h3>
                  {relatedPrice ? (
                    <p className="mt-2 text-sm font-semibold tabular-nums text-amber-100">{relatedPrice}</p>
                  ) : null}
                </Link>
                <p className="mt-3 flex-1 text-sm leading-7 text-white/68">
                  {related.description}
                </p>
                <Link
                  to={`/shop/apparel/${related.slug}`}
                  className="mt-6 inline-flex justify-center rounded-xl border border-cyan-300/40 bg-white/5 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-white/10 transition-colors"
                >
                  View Design
                </Link>
              </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mx-auto mt-12 max-w-6xl text-center">
        <Link
          to="/shop/apparel"
          className="inline-flex rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          Browse All Designs
        </Link>
      </section>
    </main>
  );
}
