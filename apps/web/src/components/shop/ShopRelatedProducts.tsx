import { Link } from "react-router-dom";
import type { ShopRelatedProduct } from "../../lib/shop";
import { shopMediaSrc } from "../../lib/shop";

export default function ShopRelatedProducts({
  products,
  collection,
}: {
  products: ShopRelatedProduct[];
  collection?: string | null;
}) {
  if (products.length === 0) return null;
  const isHealingCodeCards = collection === "healing-code-cards";

  return (
    <section className="mx-auto mt-16 max-w-6xl border-t border-white/10 pt-12" aria-labelledby="shop-related-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">{isHealingCodeCards ? "Related decks" : "Related products"}</p>
      <h2 id="shop-related-heading" className="mt-3 text-3xl font-semibold">
        {isHealingCodeCards ? "Explore the Other Healing Code Card Decks" : "Explore more digital wellness tools"}
      </h2>
      <p className="mt-3 max-w-3xl text-sm text-white/55">
        {isHealingCodeCards
          ? "Each Healing Code Cards deck explores a different dimension of personal spiritual and energetic practice."
          : "More print-at-home and digital spiritual wellness tools from The Prime Mentor Shop."}
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
          return (
            <Link
              key={product.id}
              to={`/shop/${product.slug}`}
              className="glass-card flex h-full flex-col rounded-3xl p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
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
              <h3 className="mt-4 text-xl font-semibold text-white">{product.name}</h3>
              <p className="mt-2 text-sm font-semibold tabular-nums text-amber-100">{product.priceLabel}</p>
              {product.quickSummary ? (
                <p className="mt-3 line-clamp-4 flex-1 text-sm leading-7 text-white/68">{product.quickSummary}</p>
              ) : (
                <div className="flex-1" />
              )}
              <span className="mt-6 inline-flex justify-center rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-slate-950">
                {isHealingCodeCards ? "View Deck" : "View Product"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
