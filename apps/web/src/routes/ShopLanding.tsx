import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { ShopPublicProduct } from "../lib/shop";
import { shopMediaSrc } from "../lib/shop";

export default function ShopLanding() {
  const [products, setProducts] = useState<ShopPublicProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get("/shop/products")
      .then((data) => {
        if (!cancelled) setProducts(data as ShopPublicProduct[]);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Unable to load the Shop.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main id="top" className="min-h-screen text-white">
      <section className="relative overflow-hidden px-6 pb-16 pt-[0.6rem] md:pt-[0.8rem]">
        <div className="absolute inset-x-0 top-20 -z-10 mx-auto h-72 max-w-4xl rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">The Prime Mentor Shop</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-tight md:text-7xl">Digital tools for personal spiritual wellness practice.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/72">
            Explore digital editions created by Brad Johnson for focused intention, energetic connection, and at-home spiritual practice.
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          {error ? (
            <p role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
          ) : null}
          {products === null && !error ? (
            <p className="text-sm text-white/60">Loading Shop products...</p>
          ) : null}
          {products && products.length === 0 ? (
            <div className="glass-card rounded-3xl p-8">
              <h2 className="text-2xl font-semibold">No digital products are available yet.</h2>
              <p className="mt-3 text-white/68">Please check back soon, or explore sessions and reports in the meantime.</p>
              <Link to="/reports" className="mt-6 inline-flex rounded-xl bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-slate-950">Explore Reports</Link>
            </div>
          ) : null}
          {products && products.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
                return (
                  <article key={product.id} className="glass-card flex h-full flex-col rounded-3xl p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">{product.formatLabel}</p>
                    {image ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-amber-300/25 bg-black/30">
                        <img
                          src={shopMediaSrc(image.url)}
                          alt={image.altText || product.name}
                          className="aspect-[3/4] w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 flex aspect-[3/4] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-white/45">Digital product</div>
                    )}
                    <h2 className="mt-4 text-xl font-semibold text-white">{product.name}</h2>
                    {product.subtitle ? <p className="mt-1 text-sm font-medium text-white/75">{product.subtitle}</p> : null}
                    <p className="mt-2 text-sm font-semibold tabular-nums text-amber-100">{product.priceLabel}</p>
                    <p className="mt-3 flex-1 text-sm leading-7 text-white/68">{product.quickSummary}</p>
                    <Link
                      to={`/shop/${product.slug}`}
                      className="mt-6 inline-flex justify-center rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-slate-950"
                    >
                      View Product
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
