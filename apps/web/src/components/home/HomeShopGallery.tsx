import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import type { ShopPublicProduct } from "../../lib/shop";
import { shopMediaSrc, unwrapShopProducts } from "../../lib/shop";

function GalleryCard({ product, eager }: { product: ShopPublicProduct; eager: boolean }) {
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  return (
    <Link
      to={`/shop/${product.slug}`}
      data-shop-gallery-card
      aria-label={`View ${product.name}`}
      className="glass-card flex h-full min-h-[28rem] shrink-0 snap-start flex-col overflow-hidden rounded-3xl p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
    >
      <p data-shop-gallery-format className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">{product.formatLabel}</p>
      {image ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-amber-300/25 bg-black/30">
          <img
            src={shopMediaSrc(image.url)}
            alt={image.altText || product.name}
            className="aspect-[3/4] w-full object-contain"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
      ) : (
        <div className="mt-4 flex aspect-[3/4] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-white/45">
          Digital product
        </div>
      )}
      <h3 className="mt-4 text-xl font-semibold leading-7 text-white">{product.name}</h3>
      {product.quickSummary ? (
        <p data-shop-gallery-summary className="mt-2 line-clamp-3 text-sm leading-6 text-white/68">{product.quickSummary}</p>
      ) : null}
      <p className="mt-3 text-sm font-semibold tabular-nums text-amber-100">{product.priceLabel}</p>
      <span className="mt-auto inline-flex justify-center rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-slate-950">
        View Product
      </span>
    </Link>
  );
}

function GallerySkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="glass-card min-h-[28rem] w-[min(18.75rem,82vw)] shrink-0 rounded-3xl p-5 md:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]"
        >
          <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
          <div className="mt-4 aspect-[3/4] animate-pulse rounded-2xl bg-white/8" />
          <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-16 animate-pulse rounded bg-white/8" />
          <div className="mt-4 h-4 w-20 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export default function HomeShopGallery() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<ShopPublicProduct[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get("/shop/products?featured=true")
      .then((payload) => {
        if (!cancelled) setProducts(unwrapShopProducts(payload));
      })
      .catch((error: unknown) => {
        console.error("HomeShopGallery failed to load featured products", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    setCanPrev(scroller.scrollLeft > 8);
    setCanNext(maxScroll > 8 && scroller.scrollLeft < maxScroll - 8);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    updateScrollState();
    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      scroller.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [products, updateScrollState]);

  function scrollByPage(direction: -1 | 1) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth, behavior: "smooth" });
  }

  if (failed || (products && products.length === 0)) {
    return null;
  }

  return (
    <section
      id="home-shop-gallery"
      className="relative scroll-mt-28 border-t border-white/8 py-12 sm:py-16"
      aria-labelledby="home-shop-gallery-heading"
    >
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-white/40">The Prime Mentor Shop</p>
          <h2 id="home-shop-gallery-heading" className="max-w-3xl text-3xl font-semibold text-white">
            Explore the Prime Mentor Shop
          </h2>
          <p className="max-w-3xl text-base leading-8 text-white/66">
            Discover digital tools, Healing Code Cards, and spiritual wellness resources available through The Prime Mentor.
          </p>
        </div>

        <div className="mt-8">
          {products === null ? (
            <GallerySkeleton />
          ) : (
            <div className="relative">
              <div className="mb-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  aria-label="Previous products"
                  aria-disabled={!canPrev}
                  onClick={() => {
                    if (canPrev) scrollByPage(-1);
                  }}
                  className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-white/15 bg-slate-950/70 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${canPrev ? "" : "cursor-not-allowed opacity-35"}`}
                >
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
                    <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Next products"
                  aria-disabled={!canNext}
                  onClick={() => {
                    if (canNext) scrollByPage(1);
                  }}
                  className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-white/15 bg-slate-950/70 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${canNext ? "" : "cursor-not-allowed opacity-35"}`}
                >
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
                    <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div
                ref={scrollerRef}
                data-shop-gallery-scroller
                className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {products.map((product, index) => (
                  <GalleryCard key={product.id} product={product} eager={index === 0} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
