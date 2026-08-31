import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { useAdminSettings } from "../../context/AdminSettingsContext";
import { api } from "../../lib/api";
import { unwrapData, type Divin8KnowledgeResponse } from "./adsApi";
import { adsCardClass, adsMutedClass, adsTitleClass } from "./adsTheme";

export default function AdsDivin8Intelligence() {
  const { getToken } = useAuth();
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";
  const [data, setData] = useState<Divin8KnowledgeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getToken()
      .then((token) => api.get("/admin/ads/divin8-knowledge", token))
      .then((response) => setData(unwrapData<Divin8KnowledgeResponse>(response)))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load Divin8 knowledge."));
  }, [getToken]);

  return (
    <div data-ads-divin8-intelligence className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">Ads</p>
        <h1 className={`mt-2 text-3xl font-semibold ${adsTitleClass(isLightTheme)}`}>Divin8 Intelligence</h1>
        <p className={`mt-2 max-w-2xl text-sm ${adsMutedClass(isLightTheme)}`}>
          Canonical Divin8 Reports facts from Prime Mentor product sources. Future approved statements, landing-page copy, and PDFs can be added here. The Ads Agent must not invent product facts.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {(data?.catalog ?? []).map((entry) => (
          <article key={entry.key} className={adsCardClass(isLightTheme)}>
            <p className="text-xs uppercase tracking-[0.18em] text-accent-cyan">{entry.price}</p>
            <h2 className={`mt-2 text-lg font-semibold ${adsTitleClass(isLightTheme)}`}>{entry.displayName}</h2>
            <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>{entry.shortDescription}</p>
            <p className={`mt-3 text-xs ${adsMutedClass(isLightTheme)}`}>
              Systems: {entry.systems.join(" · ")}
            </p>
          </article>
        ))}
      </div>

      <section className={adsCardClass(isLightTheme)}>
        <h2 className={`text-lg font-semibold ${adsTitleClass(isLightTheme)}`}>Approved custom statements</h2>
        {data?.customEntries.length ? (
          <ul className="mt-3 space-y-3">
            {data.customEntries.map((entry) => (
              <li key={entry.id}>
                <p className={adsTitleClass(isLightTheme)}>{entry.title}</p>
                <p className={`text-sm ${adsMutedClass(isLightTheme)}`}>{entry.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`mt-2 text-sm ${adsMutedClass(isLightTheme)}`}>
            No custom advertising statements yet. This is the place for future approved marketing copy, testimonials, and sample notes.
          </p>
        )}
      </section>
    </div>
  );
}
