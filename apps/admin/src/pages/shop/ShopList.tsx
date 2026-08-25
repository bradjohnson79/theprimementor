import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Loading from "../../components/Loading";
import { api } from "../../lib/api";

interface AdminShopProduct {
  id: string;
  name: string;
  slug: string;
  status: string;
  isActive: boolean;
  priceLabel: string;
  stripePriceId: string | null;
  awaitingAssets: boolean;
  awaitingDeckAssets?: boolean;
  awaitingBooklet?: boolean;
}

export default function ShopList() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<AdminShopProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getToken()
      .then((token) => api.get("/admin/shop/products", token))
      .then((data) => {
        if (!cancelled) setProducts(data as AdminShopProduct[]);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Unable to load Shop products.");
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Shop</p>
          <h2 className="mt-2 text-2xl font-bold">Digital products</h2>
          <p className="mt-1 text-white/60">Catalog, Stripe association, and downloadable files.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/shop/testimonials")}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm"
          >
            Testimonials
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/shop/new")}
            className="rounded-xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Create product
          </button>
        </div>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      {products === null && !error ? <Loading /> : null}
      {products && products.length === 0 ? <EmptyState title="No Shop products" message="Create the first digital product from Admin." /> : null}
      {products && products.length > 0 ? (
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="text-white/45">
              <tr>
                <th className="py-2">Product</th>
                <th>Price</th>
                <th>Status</th>
                <th>Stripe Price</th>
                <th>Files</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="cursor-pointer border-t border-white/10 hover:bg-white/5"
                  onClick={() => navigate(`/admin/shop/${product.id}`)}
                >
                  <td className="py-3">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-white/45">{product.slug}</div>
                  </td>
                  <td>{product.priceLabel}</td>
                  <td>{product.isActive ? "Active" : product.status}</td>
                  <td className="font-mono text-xs">{product.stripePriceId || "—"}</td>
                  <td>
                    {product.awaitingAssets ? "Awaiting asset attachment" : "Files attached"}
                    {product.awaitingBooklet ? " · Awaiting instructions" : " · Instructions attached"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
