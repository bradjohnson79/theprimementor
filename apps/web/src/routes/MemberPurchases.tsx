import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { api } from "../lib/api";
import { resolveApiUrl } from "../lib/apiBase";
import type { ShopPurchase } from "../lib/shop";

export default function MemberPurchases() {
  const { getToken } = useAuth();
  const [purchases, setPurchases] = useState<ShopPurchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => api.get("/shop/purchases", token))
      .then((data) => {
        if (!cancelled) setPurchases(data as ShopPurchase[]);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Unable to load your purchases.");
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function downloadFile(fileId: string, displayName: string) {
    setDownloading(fileId);
    setError(null);
    try {
      const token = await getToken();
      const issued = await api.post(`/shop/downloads/${fileId}/token`, {}, token) as { token: string };
      const res = await fetch(resolveApiUrl(`/shop/downloads/${fileId}?token=${encodeURIComponent(issued.token)}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error || "Download failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = displayName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="dashboard-shell">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Account</p>
        <h1 className="mt-2 text-3xl font-semibold">Purchases</h1>
        <p className="mt-3 text-white/65">Digital editions you have purchased remain available here.</p>
        {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
        {purchases === null && !error ? <p className="mt-6 text-sm text-white/60">Loading purchases...</p> : null}
        {purchases && purchases.length === 0 ? (
          <div className="dashboard-panel mt-6">
            <p>You have not purchased a digital Shop product yet.</p>
            <Link to="/shop" className="mt-4 inline-flex rounded-xl bg-accent-cyan px-4 py-2 text-sm font-semibold text-slate-950">Browse the Shop</Link>
          </div>
        ) : null}
        <ul className="mt-6 space-y-4">
          {purchases?.map((purchase) => (
            <li key={purchase.entitlementId} className="dashboard-panel">
              <p className="text-xs uppercase tracking-[0.16em] text-amber-200">{purchase.formatLabel}</p>
              <h2 className="mt-2 text-xl font-semibold">{purchase.productName}</h2>
              <Link to={`/shop/${purchase.slug}`} className="mt-2 inline-flex text-sm text-accent-cyan">View product</Link>
              {purchase.files.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {purchase.files.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      disabled={downloading === file.id}
                      onClick={() => void downloadFile(file.id, file.displayName)}
                      className="block rounded-xl border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-60"
                    >
                      {downloading === file.id ? "Preparing download..." : `Download ${file.displayName}`}
                    </button>
                  ))}
                </div>
              ) : null}
              {purchase.awaitingAssets ? (
                <p className="mt-3 text-sm text-white/60">Awaiting asset attachment. Your purchase is saved.</p>
              ) : null}
              {purchase.awaitingBooklet ? (
                <p className="mt-3 text-sm text-white/60">Awaiting instruction attachment.</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
