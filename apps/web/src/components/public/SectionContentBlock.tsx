import type { ReactNode } from "react";

interface SectionContentBlockProps {
  label: string;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}

export default function SectionContentBlock({
  label,
  title,
  description,
  children,
  className = "",
}: SectionContentBlockProps) {
  return (
    <div className={["text-left", className].join(" ")}>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">{label}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
