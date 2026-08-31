import { useAdminSettings } from "../../context/AdminSettingsContext";
import { adsCardClass, adsMutedClass, adsTitleClass } from "./adsTheme";

export default function AdsPlaceholderPage({
  title,
  section,
}: {
  title: string;
  section: string;
}) {
  const { resolvedTheme } = useAdminSettings();
  const isLightTheme = resolvedTheme === "light";

  return (
    <div data-ads-placeholder={section} className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-cyan">Ads</p>
        <h1 className={`mt-2 text-3xl font-semibold ${adsTitleClass(isLightTheme)}`}>{title}</h1>
      </div>
      <section className={adsCardClass(isLightTheme)}>
        <p className={`text-sm ${adsMutedClass(isLightTheme)}`}>Connect Google Ads to begin</p>
      </section>
    </div>
  );
}
