export function GoldDivider({ className = "" }: { className?: string }) {
  return <div className={`reports-gold-rule ${className}`.trim()} aria-hidden="true" />;
}

export function SystemsConstellation({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 420"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="reports-orb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e4c36a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
        </radialGradient>
      </defs>
      <circle cx="210" cy="210" r="168" fill="none" stroke="rgba(228,195,106,0.28)" strokeWidth="1" />
      <circle cx="210" cy="210" r="118" fill="none" stroke="rgba(139,92,246,0.28)" strokeWidth="1" />
      <circle cx="210" cy="210" r="64" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
      <line x1="210" y1="28" x2="210" y2="392" stroke="rgba(228,195,106,0.2)" strokeWidth="1" />
      <line x1="28" y1="210" x2="392" y2="210" stroke="rgba(228,195,106,0.2)" strokeWidth="1" />
      <polygon points="210,58 248,178 370,178 270,248 308,368 210,298 112,368 150,248 50,178 172,178" fill="none" stroke="rgba(212,162,76,0.35)" strokeWidth="1" />
      <circle cx="210" cy="58" r="4" fill="url(#reports-orb)" />
      <circle cx="370" cy="178" r="3.5" fill="#e4c36a" />
      <circle cx="308" cy="368" r="3.5" fill="#c4b5fd" />
      <circle cx="112" cy="368" r="3.5" fill="#e4c36a" />
      <circle cx="50" cy="178" r="3.5" fill="#c4b5fd" />
      <circle cx="210" cy="210" r="8" fill="url(#reports-orb)" />
      <text x="210" y="214" textAnchor="middle" fill="rgba(248,245,238,0.72)" fontSize="11" fontFamily="Georgia, serif">8</text>
    </svg>
  );
}
