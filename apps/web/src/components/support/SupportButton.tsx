import { useState } from "react";

interface SupportButtonProps {
  isOpen: boolean;
  showTooltip: boolean;
  onClick: () => void;
}

const buttonClassName =
  "relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-slate-950/95 text-xl font-semibold text-white shadow-[0_12px_35px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70";
const tooltipClassName =
  "pointer-events-none absolute bottom-14 right-0 rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 text-xs font-medium text-white shadow-[0_12px_30px_rgba(15,23,42,0.5)] transition duration-200";

export default function SupportButton({ isOpen, showTooltip, onClick }: SupportButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const shouldShowTooltip = showTooltip || isHovered || isFocused;

  return (
    <button
      type="button"
      aria-label="Open support chat"
      aria-expanded={isOpen}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={buttonClassName}
    >
      <span aria-hidden="true">?</span>
      <span
        className={`${tooltipClassName} ${
          shouldShowTooltip ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        Need help?
      </span>
    </button>
  );
}
