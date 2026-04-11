import { useI18n } from "../../i18n";
import { classNames } from "@wisdom/ui/divin8-chat";

interface Divin8GuideProps {
  isLightTheme: boolean;
}

export default function Divin8Guide({ isLightTheme }: Divin8GuideProps) {
  const { t } = useI18n();
  const cards = [
    {
      title: t("divin8.guide.astrology.title"),
      body: t("divin8.guide.astrology.body"),
    },
    {
      title: t("divin8.guide.systems.title"),
      body: t("divin8.guide.systems.body"),
    },
    {
      title: t("divin8.guide.timeline.title"),
      body: t("divin8.guide.timeline.body"),
    },
    {
      title: t("divin8.guide.image.title"),
      body: t("divin8.guide.image.body"),
    },
    {
      title: t("divin8.guide.synthesis.title"),
      body: t("divin8.guide.synthesis.body"),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-accent-cyan">{t("divin8.guide.title")}</p>
        <p className={classNames("mt-1 text-xs leading-5", isLightTheme ? "text-slate-500" : "text-white/55")}>
          {t("divin8.guide.subtitle")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.title}
            className={classNames(
              "rounded-xl border p-3",
              isLightTheme ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.04]",
            )}
          >
            <p className="text-sm font-semibold">{card.title}</p>
            <p className={classNames("mt-1.5 text-sm leading-5", isLightTheme ? "text-slate-600" : "text-white/65")}>
              {card.body}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
