import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import Card from "../../components/Card";
import Loading from "../../components/Loading";
import { api } from "../../lib/api";

interface AdminShopProduct {
  id: string;
  name: string;
  slug: string;
}

interface AdminShopTestimonial {
  id: string;
  customerName: string;
  location: string | null;
  title: string | null;
  testimonialText: string;
  sourceLabel: string | null;
  contextLabel: string | null;
  isActive: boolean;
  sortOrder: number;
  productIds: string[];
  productSlugs: string[];
  associations: Array<{ id: string; productId: string | null; productSlug: string }>;
}

const emptyTestimonial: AdminShopTestimonial = {
  id: "",
  customerName: "",
  location: "",
  title: "",
  testimonialText: "",
  sourceLabel: "",
  contextLabel: "",
  isActive: true,
  sortOrder: 0,
  productIds: [],
  productSlugs: [],
  associations: [],
};

export default function ShopTestimonialEditor() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [testimonial, setTestimonial] = useState<AdminShopTestimonial>(emptyTestimonial);
  const [products, setProducts] = useState<AdminShopProduct[]>([]);
  const [extraSlugs, setExtraSlugs] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getToken()
      .then(async (token) => {
        const catalog = await api.get("/admin/shop/products", token) as AdminShopProduct[];
        if (!cancelled) setProducts(catalog);
        if (isNew) return;
        const row = await api.get(`/admin/shop/testimonials/${id}`, token) as AdminShopTestimonial;
        if (cancelled) return;
        setTestimonial(row);
        const knownSlugs = new Set(catalog.map((product) => product.slug));
        setExtraSlugs(row.productSlugs.filter((slug) => !knownSlugs.has(slug)).join(", "));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Unable to load testimonial.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getToken, id, isNew]);

  function extraSlugsFrom(row: AdminShopTestimonial) {
    const knownSlugs = new Set(products.map((product) => product.slug));
    return row.productSlugs.filter((slug) => !knownSlugs.has(slug)).join(", ");
  }

  function applySaved(row: AdminShopTestimonial) {
    setTestimonial(row);
    setExtraSlugs(extraSlugsFrom(row));
  }

  function toggleProduct(slug: string) {
    const selected = new Set(testimonial.productSlugs);
    if (selected.has(slug)) selected.delete(slug);
    else selected.add(slug);
    setTestimonial({ ...testimonial, productSlugs: [...selected] });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      const productSlugs = [
        ...testimonial.productSlugs,
        ...extraSlugs.split(",").map((slug) => slug.trim()).filter(Boolean),
      ];
      const payload = {
        customerName: testimonial.customerName,
        location: testimonial.location,
        title: testimonial.title,
        testimonialText: testimonial.testimonialText,
        sourceLabel: testimonial.sourceLabel,
        contextLabel: testimonial.contextLabel,
        isActive: testimonial.isActive,
        sortOrder: testimonial.sortOrder,
        productSlugs,
      };
      const saved = isNew
        ? await api.post("/admin/shop/testimonials", payload, token) as AdminShopTestimonial
        : await api.patch(`/admin/shop/testimonials/${testimonial.id}`, payload, token) as AdminShopTestimonial;
      applySaved(saved);
      setMessage("Testimonial saved.");
      if (isNew) navigate(`/admin/shop/testimonials/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssociation(associationId: string) {
    if (!testimonial.id) return;
    const token = await getToken();
    try {
      const saved = await api.delete(`/admin/shop/testimonials/${testimonial.id}/associations/${associationId}`, token) as AdminShopTestimonial;
      applySaved(saved);
      setMessage("Product association removed. The testimonial was kept.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove association.");
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Shop</p>
        <h2 className="mt-2 text-2xl font-bold">{isNew ? "Add testimonial" : testimonial.customerName || "Edit testimonial"}</h2>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Customer name</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={testimonial.customerName} onChange={(e) => setTestimonial({ ...testimonial, customerName: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Location (optional)</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={testimonial.location ?? ""} onChange={(e) => setTestimonial({ ...testimonial, location: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Title (optional)</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={testimonial.title ?? ""} onChange={(e) => setTestimonial({ ...testimonial, title: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/60">Sort order</span>
            <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" type="number" value={testimonial.sortOrder} onChange={(e) => setTestimonial({ ...testimonial, sortOrder: Number(e.target.value) || 0 })} />
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Customer testimonial</span>
          <textarea className="min-h-40 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={testimonial.testimonialText} onChange={(e) => setTestimonial({ ...testimonial, testimonialText: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Internal source note (not shown publicly)</span>
          <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={testimonial.sourceLabel ?? ""} onChange={(e) => setTestimonial({ ...testimonial, sourceLabel: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Historical context label</span>
          <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={testimonial.contextLabel ?? ""} onChange={(e) => setTestimonial({ ...testimonial, contextLabel: e.target.value })} />
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={testimonial.isActive} onChange={(e) => setTestimonial({ ...testimonial, isActive: e.target.checked })} />
          Active on public product pages
        </label>
        <div className="mt-6">
          <p className="mb-2 text-sm text-white/60">Associate with Shop products</p>
          <div className="space-y-2">
            {products.map((product) => (
              <label key={product.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={testimonial.productSlugs.includes(product.slug)} onChange={() => toggleProduct(product.slug)} />
                {product.name}
              </label>
            ))}
          </div>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Additional product slugs (for decks not in the catalog yet)</span>
          <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={extraSlugs} onChange={(e) => setExtraSlugs(e.target.value)} placeholder="healing-code-cards-source-deck-body-set, healing-code-cards-source-deck" />
        </label>
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-6 rounded-xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
          {saving ? "Saving..." : "Save"}
        </button>
      </Card>

      {testimonial.associations.length > 0 ? (
        <Card>
          <h3 className="text-lg font-semibold">Associations</h3>
          <p className="mt-2 text-sm text-white/55">Remove a product association without deleting the testimonial.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {testimonial.associations.map((association) => (
              <li key={association.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
                <span>{association.productSlug}{association.productId ? "" : " (pending catalog row)"}</span>
                <button type="button" className="text-rose-200" onClick={() => void removeAssociation(association.id)}>Remove association</button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
