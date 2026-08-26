import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import WebsiteStatusPage from "../components/public/WebsiteStatusPage";
import PromoCodeInput from "../components/checkout/PromoCodeInput";
import { usePromoCode } from "../hooks/usePromoCode";
import { api } from "../lib/api";
import type { ShopPublicProduct, ShopPurchase } from "../lib/shop";
import { shopMediaSrc } from "../lib/shop";
import { shopCheckoutErrorMessage, shopPurchaseReturnPath, startShopCheckout } from "../lib/shopCheckout";
import ShopRelatedProducts from "../components/shop/ShopRelatedProducts";
import ShopTestimonials from "../components/shop/ShopTestimonials";

function formatInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={`${part}-${index}`} className="font-semibold text-white/88">{part.slice(2, -2)}</strong>
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

function ShopCopy({ text, className = "mt-6 space-y-4 text-base leading-8 text-white/72" }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {text.split(/\n\n+/).map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        if (lines[0]?.startsWith("### ")) {
          return <h4 key={`${lines[0]}-${index}`} className="pt-1 text-xl font-semibold text-white">{formatInline(lines[0].slice(4))}</h4>;
        }
        if (lines[0]?.startsWith("## ")) {
          return <h3 key={`${lines[0]}-${index}`} className="pt-2 text-2xl font-semibold text-white">{formatInline(lines[0].slice(3))}</h3>;
        }
        if (lines.every((line) => line.startsWith("* ") || line.startsWith("- "))) {
          return (
            <ul key={`list-${index}`} className="list-disc space-y-1 pl-6">
              {lines.map((line) => <li key={line}>{formatInline(line.slice(2))}</li>)}
            </ul>
          );
        }
        return <p key={`p-${index}`}>{lines.map((line, lineIndex) => <span key={`${line}-${lineIndex}`}>{formatInline(line)}{lineIndex < lines.length - 1 ? <br /> : null}</span>)}</p>;
      })}
    </div>
  );
}

export default function ShopProduct() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSignedIn, getToken } = useAuth();
  const promo = usePromoCode(getToken);
  const [product, setProduct] = useState<ShopPublicProduct | null>(null);
  const [purchased, setPurchased] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const purchaseInFlight = useRef(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    api.get(`/shop/products/${slug}`)
      .then((data) => {
        if (!cancelled) setProduct(data as ShopPublicProduct);
      })
      .catch((err: Error & { status?: number }) => {
        if (cancelled) return;
        if (err.status === 404) setMissing(true);
        else setError(err.message || "Unable to load this product.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!isSignedIn || !product) return;
    let cancelled = false;
    getToken().then((token) => api.get("/shop/purchases", token))
      .then((data) => {
        if (!cancelled) {
          setPurchased((data as ShopPurchase[]).some((item) => item.productId === product.id));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn, product]);

  useEffect(() => {
    promo.reset();
  }, [product?.id, promo.reset]);

  useEffect(() => {
    if (missing) return;
    if (searchParams.get("purchase") !== "1") return;
    if (!product || !isSignedIn || purchased || product.purchased || product.canPurchase === false) return;
    const next = new URLSearchParams(searchParams);
    next.delete("purchase");
    setSearchParams(next, { replace: true });
    void handlePurchase();
  }, [isSignedIn, missing, product, purchased, searchParams, setSearchParams]);

  async function handlePurchase() {
    if (!product || purchaseInFlight.current) return;
    if (product.canPurchase === false) {
      setError("This product is not available for purchase yet.");
      return;
    }
    purchaseInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!isSignedIn) {
        navigate(`/sign-in?redirect_url=${encodeURIComponent(shopPurchaseReturnPath(product.slug))}`);
        return;
      }
      const token = await getToken();
      if (!token?.trim()) {
        navigate(`/sign-in?redirect_url=${encodeURIComponent(shopPurchaseReturnPath(product.slug))}`);
        setError("Please sign in to continue checkout.");
        return;
      }
      const result = await startShopCheckout(product.id, token, promo.validation?.code);
      if (result.alreadyPaid) {
        navigate("/dashboard/purchases");
      }
    } catch (err) {
      setError(shopCheckoutErrorMessage(err));
    } finally {
      purchaseInFlight.current = false;
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <WebsiteStatusPage
        eyebrow="Shop"
        code="404"
        title="This Shop product is not available."
        description="The product may be inactive, or the link may be incorrect."
        actions={[
          { label: "Back to Shop", href: "/shop", preserveQuery: true },
          { label: "Go Home", href: "/", variant: "secondary", preserveQuery: true },
        ]}
      />
    );
  }

  const image = product?.images.find((item) => item.isPrimary) ?? product?.images[0];
  const canceled = searchParams.get("checkout") === "canceled";
  const unavailable = Boolean(product && product.canPurchase === false);

  return (
    <main className="min-h-screen px-6 pb-20 pt-[0.6rem] text-white md:pt-[0.8rem]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 md:flex-row md:items-center md:gap-10">
        {image ? (
          <img
            src={shopMediaSrc(image.url)}
            alt={image.altText || product?.name || "Product image"}
            className="w-[15rem] shrink-0 rounded-3xl border border-amber-300/25 object-contain shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
          />
        ) : (
          <div className="flex h-64 w-[15rem] shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-white/45">Digital Edition</div>
        )}
        <div className="min-w-0 w-full md:flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan [text-shadow:-2px_-2px_0_#000,2px_-2px_0_#000,-2px_2px_0_#000,2px_2px_0_#000,0_-2px_0_#000,0_2px_0_#000,-2px_0_#000,2px_0_#000]">The Prime Mentor Shop</p>
          <div className="mt-4 inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
            {product?.formatLabel || "Digital Edition"}
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">{product?.name || "Loading..."}</h1>
          {product?.subtitle ? <p className="mt-3 text-lg font-medium text-white/80">{product.subtitle}</p> : null}
          {product ? <p className="mt-4 text-2xl font-semibold tabular-nums text-amber-100">{product.priceLabel}</p> : null}
          {product?.quickSummary ? <p className="mt-6 text-lg leading-8 text-white/72">{product.quickSummary}</p> : null}
          {canceled ? (
            <p role="status" className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              Checkout was canceled. Your pending purchase was kept so you can try again.
            </p>
          ) : null}
          {unavailable ? (
            <p role="status" className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/70">
              This product is not available for purchase yet.
            </p>
          ) : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
          {product && !purchased && !product.purchased && product.canPurchase !== false ? (
            <div className="mt-6 max-w-xl">
              <PromoCodeInput
                code={promo.code}
                onCodeChange={promo.setCode}
                onApply={() => {
                  void promo.apply({
                    type: "shop",
                    shopProductId: product.id,
                    shopSlug: product.slug,
                  });
                }}
                onRemove={promo.clear}
                applying={promo.applying}
                error={promo.error}
                appliedCode={promo.validation?.code ?? null}
                estimatedDiscount={promo.validation?.estimatedDiscount ?? null}
                finalEstimate={promo.validation?.finalEstimate ?? null}
                currency={promo.validation?.currency ?? null}
              />
            </div>
          ) : null}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {purchased || product?.purchased ? (
              <Link to="/dashboard/purchases" className="inline-flex min-h-12 rounded-xl bg-accent-cyan px-5 py-3 text-sm font-semibold text-slate-950">
                Open your digital download
              </Link>
            ) : (
              <button
                type="button"
                disabled={!product || busy || unavailable}
                onClick={() => void handlePurchase()}
                className="inline-flex min-h-12 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {busy
                  ? "Preparing Checkout…"
                  : product
                    ? `Purchase ${product.formatLabel} — ${product.priceLabel}`
                    : "Loading..."}
              </button>
            )}
            {product?.publicBooklet ? (
              <a
                href={shopMediaSrc(product.publicBooklet.url)}
                className="inline-flex rounded-xl border border-amber-300/40 bg-white/5 px-5 py-3 text-sm font-semibold text-amber-100"
              >
                {`Download ${product.publicBooklet.displayName}`}
              </a>
            ) : product?.hasSecureManual ? (
              <p className="text-sm text-white/55">Instruction manual is included with purchase.</p>
            ) : product ? (
              <button
                type="button"
                disabled
                className="inline-flex rounded-xl border border-amber-300/40 bg-white/5 px-5 py-3 text-sm font-semibold text-amber-100 disabled:opacity-60"
              >
                Download instruction manual
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/40">This is a digital edition, not a physical product.</p>
        </div>
      </div>

      {product?.fullDescription ? (
        <section className="mx-auto mt-16 max-w-6xl border-t border-white/10 pt-12">
          <h2 className="text-3xl font-semibold">About this product</h2>
          <ShopCopy text={product.fullDescription} />
        </section>
      ) : null}

      {product?.includedItems ? (
        <section className="mx-auto mt-12 max-w-6xl">
          <h2 className="text-2xl font-semibold">Included</h2>
          <ShopCopy className="mt-3 space-y-3 text-base leading-8 text-white/72" text={product.includedItems} />
        </section>
      ) : null}

      {product?.videoEmbedUrl ? (
        <section className="mx-auto mt-12 max-w-6xl">
          <h2 className="text-3xl font-semibold">{product.videoHeading || "Instructional video"}</h2>
          {product.videoIntro ? <p className="mt-3 max-w-3xl text-white/72">{product.videoIntro}</p> : null}
          <div className="mt-6 aspect-video overflow-hidden rounded-3xl border border-white/10 bg-black/40">
            <iframe
              title={product.videoHeading || "Instructional video"}
              src={product.videoEmbedUrl}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      ) : null}

      {product?.wellnessNotice ? (
        <section className="mx-auto mt-12 max-w-6xl rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Wellness notice</h2>
          <p className="mt-3 text-sm leading-7 text-white/68">{product.wellnessNotice}</p>
        </section>
      ) : null}

      {product?.testimonials && product.testimonials.length > 0 && product.testimonialSection ? (
        <ShopTestimonials
          heading={product.testimonialSection.heading}
          subtitle={product.testimonialSection.subtitle}
          disclaimer={product.testimonialSection.disclaimer}
          testimonials={product.testimonials}
        />
      ) : null}

      {product?.relatedProducts && product.relatedProducts.length > 0 ? (
        <ShopRelatedProducts products={product.relatedProducts} collection={product.collection} />
      ) : null}
    </main>
  );
}
