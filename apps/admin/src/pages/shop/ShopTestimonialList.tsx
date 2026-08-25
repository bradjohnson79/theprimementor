import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Loading from "../../components/Loading";
import { api } from "../../lib/api";

interface AdminShopTestimonial {
  id: string;
  customerName: string;
  title: string | null;
  isActive: boolean;
  sortOrder: number;
  productSlugs: string[];
}

interface TestimonialSettings {
  heading: string;
  subtitle: string | null;
  disclaimer: string;
}

export default function ShopTestimonialList() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState<AdminShopTestimonial[] | null>(null);
  const [settings, setSettings] = useState<TestimonialSettings>({ heading: "", subtitle: "", disclaimer: "" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getToken()
      .then(async (token) => {
        const [rows, nextSettings] = await Promise.all([
          api.get("/admin/shop/testimonials", token),
          api.get("/admin/shop/testimonial-settings", token),
        ]);
        if (cancelled) return;
        setTestimonials(rows as AdminShopTestimonial[]);
        setSettings(nextSettings as TestimonialSettings);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Unable to load testimonials.");
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function saveSettings() {
    setSavingSettings(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      const saved = await api.patch("/admin/shop/testimonial-settings", settings, token) as TestimonialSettings;
      setSettings(saved);
      setMessage("Testimonial section settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Shop</p>
          <h2 className="mt-2 text-2xl font-bold">Testimonials</h2>
          <p className="mt-1 text-white/60">Shared customer experiences for Healing Code Cards and other Shop products.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/shop/testimonials/new")}
          className="rounded-xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Add testimonial
        </button>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}

      <Card>
        <h3 className="text-lg font-semibold">Section copy</h3>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Heading</span>
          <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={settings.heading} onChange={(e) => setSettings({ ...settings, heading: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Subtitle</span>
          <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={settings.subtitle ?? ""} onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })} />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-white/60">Customer experience disclaimer</span>
          <textarea className="min-h-28 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" value={settings.disclaimer} onChange={(e) => setSettings({ ...settings, disclaimer: e.target.value })} />
        </label>
        <button type="button" disabled={savingSettings} onClick={() => void saveSettings()} className="mt-4 rounded-xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
          {savingSettings ? "Saving..." : "Save section copy"}
        </button>
      </Card>

      {testimonials === null && !error ? <Loading /> : null}
      {testimonials && testimonials.length === 0 ? <EmptyState title="No testimonials" message="Add the first customer experience from Admin." /> : null}
      {testimonials && testimonials.length > 0 ? (
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="text-white/45">
              <tr>
                <th className="py-2">Customer</th>
                <th>Title</th>
                <th>Status</th>
                <th>Products</th>
              </tr>
            </thead>
            <tbody>
              {testimonials.map((testimonial) => (
                <tr
                  key={testimonial.id}
                  className="cursor-pointer border-t border-white/10 hover:bg-white/5"
                  onClick={() => navigate(`/admin/shop/testimonials/${testimonial.id}`)}
                >
                  <td className="py-3 font-medium">{testimonial.customerName}</td>
                  <td>{testimonial.title || "—"}</td>
                  <td>{testimonial.isActive ? "Active" : "Inactive"}</td>
                  <td className="text-xs text-white/55">{testimonial.productSlugs.join(", ") || "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
