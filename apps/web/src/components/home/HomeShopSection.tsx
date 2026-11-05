import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { trackCtaClick } from "../../lib/analytics";
import { PURCHASE_REASSURANCE } from "../../lib/purchaseReassurance";
import { shopMediaSrc, unwrapShopProducts, type ShopPublicProduct } from "../../lib/shop";
import {
  APPAREL_DESIGNS,
  formatApparelFromPrice,
  type ApparelDesign,
} from "../../data/apparel";
import { getApparelCardImage } from "../../data/apparelModels";

const FEATURED_APPAREL_COUNT = 4;
const FEATURED_DIGITAL_COUNT = 4;

const featuredApparel = [...APPAREL_DESIGNS]
  .sort((a, b) => a.featuredRank - b.featuredRank)
  .slice(0, FEATURED_APPAREL_COUNT);

function apparelShortTitle(title: string) {
  const [name] = title.split(" – ");
  return name?.trim() || title;
}

function ShopProductCard({
  href,
  eyebrow,
  title,
  imageSrc,
  imageAlt,
  price,
  summary,
  cta,
  badge,
  frameClassName = "bg-black/35",
  onClick,
}: {
  href: string;
  eyebrow: string;
  title: string;
  imageSrc: string | null;
  imageAlt: string;
  price: string | null;
  summary: string;
  cta: string;
  badge?: string;
  frameClassName?: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={href}
      onClick={onClick}
      aria-label={`${cta}: ${title}`}
      className="glass-card group flex h-full flex-col rounded-3xl p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:p-5"
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-amber-200/80">{eyebrow}</p>
      <div className={`mt-3 overflow-hidden rounded-2xl border border-white/10 ${frameClassName}`}>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={imageAlt}
            className="aspect-[4/5] w-full object-contain object-top transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center text-sm text-white/45">Digital product</div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-2">
        <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-white">{title}</h3>
        {badge ? (
          <span className="inline-flex rounded-full border border-amber-200/45 bg-amber-300/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-amber-100">
            {badge}
          </span>
        ) : null}
      </div>
      {price ? <p className="mt-2 text-sm font-semibold tabular-nums text-amber-100">{price}</p> : null}
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-white/62">{summary}</p>
      <span className="mt-4 inline-flex justify-center rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-slate-950">
        {cta}
      </span>
      <span className="mt-2 text-center text-xs leading-5 text-white/55">{PURCHASE_REASSURANCE}</span>
    </Link>
  );
}

function DigitalCardSkeleton() {
  return (
    <div className="glass-card rounded-3xl p-4 sm:p-5" aria-hidden="true">
      <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
      <div className="mt-3 aspect-square animate-pulse rounded-2xl bg-white/8" />
      <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-4 w-20 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-16 animate-pulse rounded bg-white/8" />
    </div>
  );
}

function ApparelCard({ design }: { design: ApparelDesign }) {
  const href = `/shop/apparel/${design.slug}`;
  const title = apparelShortTitle(design.title);
  const card = getApparelCardImage(design.slug);
  return (
    <ShopProductCard
      href={href}
      eyebrow="Sacred Apparel"
      title={title}
      imageSrc={card?.src ?? null}
      imageAlt={card?.alt ?? design.title}
      frameClassName="bg-[#ececef]"
      price={formatApparelFromPrice(design)}
      summary={design.description}
      cta="View design"
      badge={design.featuredRank === 1 ? "Best seller" : undefined}
      onClick={() => trackCtaClick("home_shop_apparel", "home_shop", {
        href,
        title: design.title,
      })}
    />
  );
}

function DigitalCard({ product }: { product: ShopPublicProduct }) {
  const href = `/shop/${product.slug}`;
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  return (
    <ShopProductCard
      href={href}
      eyebrow={product.formatLabel || "Digital"}
      title={product.name}
      imageSrc={image ? shopMediaSrc(image.url) : null}
      imageAlt={image?.altText || product.name}
      price={product.priceLabel}
      summary={product.quickSummary || product.subtitle || "Digital edition from The Prime Mentor Shop."}
      cta="View product"
      onClick={() => trackCtaClick("home_shop_digital", "home_shop", {
        href,
        title: product.name,
      })}
    />
  );
}

export default function HomeShopSection() {
  const [products, setProducts] = useState<ShopPublicProduct[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get("/shop/products?featured=true")
      .then((payload) => {
        if (cancelled) return;
        setProducts(unwrapShopProducts(payload).slice(0, FEATURED_DIGITAL_COUNT));
      })
      .catch((error: unknown) => {
        console.error("HomeShopSection failed to load featured products", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Shop</p>
          <h2 id="home-shop-heading" className="text-3xl font-semibold tracking-[-0.035em] text-white">
            The Prime Mentor Shop
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
            Sacred apparel and digital tools for personal practice. These are the designs and editions most people start with.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/shop"
            onClick={() => trackCtaClick("browse_shop", "home_shop", { href: "/shop" })}
            className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Browse the full shop
          </Link>
          <Link
            to="/shop/apparel"
            onClick={() => trackCtaClick("browse_apparel", "home_shop", { href: "/shop/apparel" })}
            className="inline-flex items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/8"
          >
            View all apparel
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-cyan-200/62">Sacred Apparel</h3>
          <p className="mt-1 text-sm text-white/50">Four best-selling designs on premium tees and more.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredApparel.map((design) => (
            <ApparelCard key={design.slug} design={design} />
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t border-white/10 pt-8">
        <div>
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-amber-100/70">Digital products</h3>
          <p className="mt-1 text-sm text-white/50">Featured editions from the shop, in catalog order.</p>
        </div>
        {failed ? (
          <p className="text-sm leading-7 text-white/65">
            Digital products could not be loaded just now.{" "}
            <Link to="/shop" className="text-cyan-100 underline-offset-4 hover:underline">
              Browse the shop
            </Link>
            .
          </p>
        ) : null}
        {products === null && !failed ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
            {Array.from({ length: FEATURED_DIGITAL_COUNT }, (_, index) => (
              <DigitalCardSkeleton key={index} />
            ))}
          </div>
        ) : null}
        {products && products.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <DigitalCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}
        {products && products.length === 0 ? (
          <p className="text-sm leading-7 text-white/65">
            <Link to="/shop" className="text-cyan-100 underline-offset-4 hover:underline">
              Browse digital products
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
