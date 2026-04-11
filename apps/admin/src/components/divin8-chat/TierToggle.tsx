import type { Divin8ChatTier } from "@wisdom/ui/divin8-chat";
import { classNames } from "@wisdom/ui/divin8-chat";
import { useI18n } from "../../i18n";

interface TierToggleProps {
  value: Divin8ChatTier;
  onChange: (tier: Divin8ChatTier) => void;
  isLightTheme: boolean;
}

export default function TierToggle({ value, onChange, isLightTheme }: TierToggleProps) {
  const { t } = useI18n();

  return (
    <div
      className={classNames(
        "inline-flex rounded-lg border p-0.5",
        isLightTheme ? "border-slate-200 bg-slate-100" : "border-white/10 bg-white/5",
      )}
    >
      {(["seeker", "initiate"] as const).map((tier) => {
        const active = value === tier;
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            className={classNames(
              "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              active
                ? "bg-accent-cyan text-slate-950"
                : isLightTheme
                  ? "text-slate-600 hover:text-slate-900"
                  : "text-white/70 hover:text-white",
            )}
          >
            {t(`divin8.tier.${tier}`)}
          </button>
        );
      })}
    </div>
  );
}
