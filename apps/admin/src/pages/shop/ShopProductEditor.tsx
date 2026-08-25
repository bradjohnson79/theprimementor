import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import Card from "../../components/Card";
import Loading from "../../components/Loading";
import { api } from "../../lib/api";
import { resolveApiUrl } from "../../lib/apiBase";

interface AdminShopProduct {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "archived";
  isActive: boolean;
  featured: boolean;
  sortOrder: number;
  priceCents: number;
  currency: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  formatLabel: string;
  subtitle: string | null;
  quickSummary: string | null;
  fullDescription: string | null;
  includedItems: string | null;
  videoUrl: string | null;
  videoHeading: string | null;
  videoIntro: string | null;
  wellnessNotice: string | null;
  collection: string | null;
  fulfillmentType: string | null;
  fulfillmentDownloadUrl: string | null;
  fulfillmentDownloadLabel: string | null;
  fulfillmentEmailEnabled: boolean;
  fulfillmentInstructions: string | null;
  awaitingAssets: boolean;
  awaitingDeckAssets?: boolean;
  awaitingBooklet?: boolean;
  images: Array<{ id: string; url: string; altText: string | null }>;
  files: Array<{ id: string; displayName: string; kind: string; isAvailable: boolean }>;
}

const emptyProduct: AdminShopProduct = {
  id: "",
  name: "",
  slug: "",
  status: "draft",
  isActive: false,
  featured: false,
  sortOrder: 0,
  priceCents: 2499,
  currency: "CAD",
  stripeProductId: "",
  stripePriceId: "",
  formatLabel: "Digital Edition",
  subtitle: "",
  quickSummary: "",
  fullDescription: "",
  includedItems: "",
  videoUrl: "",
  videoHeading: "",
  videoIntro: "",
  wellnessNotice: "",
  collection: "",
  fulfillmentType: "external_download",
  fulfillmentDownloadUrl: "",
  fulfillmentDownloadLabel: "Download Your Product",
  fulfillmentEmailEnabled: true,
  fulfillmentInstructions: "",
  awaitingAssets: true,
  awaitingDeckAssets: true,
  awaitingBooklet: true,
  images: [],
  files: [],
};

export default function ShopProductEditor() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [product, setProduct] = useState<AdminShopProduct>(emptyProduct);
  const [priceDollars, setPriceDollars] = useState("24.99");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<"deck" | "booklet" | "manual" | "other">("other");

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    getToken()
      .then((token) => api.get(`/admin/shop/products/${id}`, token))
      .then((data) => {
        if (cancelled) return;
        const next = data as AdminShopProduct;
        setProduct(next);
        setPriceDollars((next.priceCents / 100).toFixed(2));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Unable to load product.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getToken, id, isNew]);

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      const priceCents = Math.round(Number.parseFloat(priceDollars) * 100);
      const payload = {
        name: product.name,
        slug: product.slug,
        status: product.isActive ? "active" : product.status,
        isActive: product.isActive,
        featured: product.featured,
        sortOrder: Number(product.sortOrder) || 0,
        priceCents,
        currency: "CAD",
        stripeProductId: product.stripeProductId || null,
        stripePriceId: product.stripePriceId || null,
        formatLabel: product.formatLabel,
        subtitle: product.subtitle,
        quickSummary: product.quickSummary,
        fullDescription: product.fullDescription,
        includedItems: product.includedItems,
        videoUrl: product.videoUrl,
        videoHeading: product.videoHeading,
        videoIntro: product.videoIntro,
        wellnessNotice: product.wellnessNotice,
        collection: product.collection,
        fulfillmentType: product.fulfillmentType || null,
        fulfillmentDownloadUrl: product.fulfillmentDownloadUrl || null,
        fulfillmentDownloadLabel: product.fulfillmentDownloadLabel || null,
        fulfillmentEmailEnabled: product.fulfillmentEmailEnabled !== false,
        fulfillmentInstructions: product.fulfillmentInstructions || null,
        ...extra,
      };
      const saved = isNew
        ? await api.post("/admin/shop/products", payload, token) as AdminShopProduct
        : await api.patch(`/admin/shop/products/${product.id}`, payload, token) as AdminShopProduct;
      setProduct(saved);
      setPriceDollars((saved.priceCents / 100).toFixed(2));
      setMessage("Product saved.");
      if (isNew) navigate(`/admin/shop/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function upload(kind: "images" | "files", file: File) {
    if (!product.id) {
      setError("Save the product before uploading files.");
      return;
    }
    const token = await getToken();
    const form = new FormData();
    form.append("file", file);
    const kindQuery = kind === "files" ? `?kind=${fileKind}` : "";
    const res = await fetch(resolveApiUrl(`/admin/shop/products/${product.id}/${kind}${kindQuery}`), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((body as { error?: string }).error || "Upload failed.");
    }
    const refreshed = await api.get(`/admin/shop/products/${product.id}`, token) as AdminShopProduct;
    setProduct(refreshed);
  }

  async function remove(kind: "images" | "files", itemId: string) {
    const token = await getToken();
    const path = kind === "images" ? `/admin/shop/images/${itemId}` : `/admin/shop/files/${itemId}`;
    await api.delete(path, token);
    const refreshed = await api.get(`/admin/shop/products/${product.id}`, token) as AdminShopProduct;
    setProduct(refreshed);
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Shop</p>
        <h2 className="mt-2 text-2xl font-bold">{isNew ? "Create product" : product.name || "Edit product"}</h2>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Product name</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Slug</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.slug} onChange={(e) => setProduct({ ...product, slug: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Format</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.formatLabel} onChange={(e) => setProduct({ ...product, formatLabel: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Subtitle</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.subtitle ?? ""} onChange={(e) => setProduct({ ...product, subtitle: e.target.value })} placeholder="Personal & Environmental Safeguard Sets" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Price (CAD)</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Stripe Product ID</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs" value={product.stripeProductId ?? ""} onChange={(e) => setProduct({ ...product, stripeProductId: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Active Stripe Price ID</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs" value={product.stripePriceId ?? ""} onChange={(e) => setProduct({ ...product, stripePriceId: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Sort order</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" type="number" value={product.sortOrder} onChange={(e) => setProduct({ ...product, sortOrder: Number(e.target.value) || 0 })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Collection</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.collection ?? ""} onChange={(e) => setProduct({ ...product, collection: e.target.value })} placeholder="healing-code-cards" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={product.isActive} onChange={(e) => setProduct({ ...product, isActive: e.target.checked, status: e.target.checked ? "active" : "draft" })} />
            Active in public Shop
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={product.featured} onChange={(e) => setProduct({ ...product, featured: e.target.checked })} />
            Featured on Homepage
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Quick summary</span>
          <textarea className="min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.quickSummary ?? ""} onChange={(e) => setProduct({ ...product, quickSummary: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Full description</span>
          <textarea className="min-h-40 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.fullDescription ?? ""} onChange={(e) => setProduct({ ...product, fullDescription: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Included items</span>
          <textarea className="min-h-20 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.includedItems ?? ""} onChange={(e) => setProduct({ ...product, includedItems: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Video URL</span>
          <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.videoUrl ?? ""} onChange={(e) => setProduct({ ...product, videoUrl: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Video heading</span>
          <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.videoHeading ?? ""} onChange={(e) => setProduct({ ...product, videoHeading: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Video intro</span>
          <textarea className="min-h-20 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.videoIntro ?? ""} onChange={(e) => setProduct({ ...product, videoIntro: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Wellness notice</span>
          <textarea className="min-h-24 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.wellnessNotice ?? ""} onChange={(e) => setProduct({ ...product, wellnessNotice: e.target.value })} />
        </label>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Delivery type</span>
            <select className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.fulfillmentType ?? ""} onChange={(e) => setProduct({ ...product, fulfillmentType: e.target.value || null })}>
              <option value="">Not configured</option>
              <option value="external_download">External Download</option>
              <option value="none">None</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Download button label</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.fulfillmentDownloadLabel ?? ""} onChange={(e) => setProduct({ ...product, fulfillmentDownloadLabel: e.target.value })} placeholder="Download Your Product" />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-white/60">Download URL</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs" value={product.fulfillmentDownloadUrl ?? ""} onChange={(e) => setProduct({ ...product, fulfillmentDownloadUrl: e.target.value })} placeholder="https://drive.google.com/..." />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={product.fulfillmentEmailEnabled} onChange={(e) => setProduct({ ...product, fulfillmentEmailEnabled: e.target.checked })} />
            Email fulfillment
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Customer fulfillment instructions</span>
          <textarea className="min-h-20 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={product.fulfillmentInstructions ?? ""} onChange={(e) => setProduct({ ...product, fulfillmentInstructions: e.target.value })} />
        </label>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" disabled={saving} onClick={() => void save({ associateStripe: true })} className="rounded-xl border border-white/15 px-4 py-2 text-sm">
            Associate existing Stripe IDs
          </button>
          <button type="button" disabled={saving} onClick={() => void save({ createStripe: true })} className="rounded-xl border border-white/15 px-4 py-2 text-sm">
            Create Stripe Product & Price
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold">Product images</h3>
        <input className="mt-3 text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload("images", file).catch((err) => setError(err instanceof Error ? err.message : "Upload failed")); }} />
        <div className="mt-4 flex flex-wrap gap-3">
          {product.images.map((image) => (
            <div key={image.id} className="w-32">
              <img src={image.url.startsWith("http") ? image.url : resolveApiUrl(image.url.replace(/^\/api/, ""))} alt={image.altText || product.name} className="h-24 w-full rounded-lg object-cover" />
              <button type="button" className="mt-2 text-xs text-rose-200" onClick={() => void remove("images", image.id)}>Remove</button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold">Downloadable files</h3>
        {product.awaitingAssets ? <p className="mt-2 text-sm text-amber-100">Awaiting asset attachment. Purchasers will see this state until downloadable files are uploaded.</p> : null}
        {product.awaitingBooklet ? <p className="mt-2 text-sm text-amber-100">Awaiting instruction attachment.</p> : <p className="mt-2 text-sm text-white/55">Public booklets appear as a free download. Manual files are purchaser-only.</p>}
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-white/60">File kind</span>
          <select className="rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={fileKind} onChange={(e) => setFileKind(e.target.value as "deck" | "booklet" | "manual" | "other")}>
            <option value="deck">Deck</option>
            <option value="booklet">Public booklet</option>
            <option value="manual">Purchaser-only manual</option>
            <option value="other">Other</option>
          </select>
        </label>
        <input className="mt-3 text-sm" type="file" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload("files", file).catch((err) => setError(err instanceof Error ? err.message : "Upload failed")); }} />
        <ul className="mt-4 space-y-2 text-sm">
          {product.files.map((file) => (
            <li key={file.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
              <span>{file.displayName} <span className="text-white/45">({file.kind})</span></span>
              <button type="button" className="text-rose-200" onClick={() => void remove("files", file.id)}>Remove</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
