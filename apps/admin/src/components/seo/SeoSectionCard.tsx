import type { ReactNode } from "react";
import { classNames } from "./utils";

export default function SeoSectionCard({
  title,
  eyebrow,
  isLightTheme,
  children,
}: {
  title: string;
  eyebrow?: string;
  isLightTheme: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={classNames(
        "rounded-3xl border p-6 shadow-sm backdrop-blur-sm",
        isLightTheme
          ? "border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
          : "border-white/10 bg-white/5 shadow-[0_16px_40px_rgba(2,6,23,0.24)]",
      )}
    >
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">{eyebrow}</p> : null}
      <h2 className={classNames("mt-2 text-xl font-semibold", isLightTheme ? "text-slate-900" : "text-white")}>{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
