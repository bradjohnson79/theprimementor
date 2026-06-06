import { classNames } from "./utils";

interface CategorySelectorButtonProps {
  disabled: boolean;
  isLightTheme: boolean;
  onClick: () => void;
}

export default function CategorySelectorButton({
  disabled,
  isLightTheme,
  onClick,
}: CategorySelectorButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Categories"
      aria-label="Categories"
      className={classNames(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70",
        disabled
          ? "pointer-events-none opacity-40"
          : isLightTheme
            ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            : "text-white/50 hover:bg-white/10 hover:text-white/80",
      )}
      style={{ width: "28px", height: "28px" }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        style={{ width: "16px", height: "16px" }}
        aria-label="Categories"
        role="img"
      >
        <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" />
        <path d="M14 3.5V8h4" />
        <path d="M9 11h6" />
        <path d="M9 14.5h6" />
        <path d="M9 18h3.5" />
      </svg>
    </button>
  );
}
