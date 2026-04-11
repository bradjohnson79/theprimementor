const BLOB_CONFIGS = [
  {
    color: "rgba(99, 102, 241, 0.7)",
    size: "55vmax",
    top: "5%",
    left: "5%",
    opacity: 0.25,
    driftDelay: "0s",
    breatheDelay: "0s",
    blobClass: "cosmic-blob-1",
  },
  {
    color: "rgba(139, 92, 246, 0.65)",
    size: "48vmax",
    top: "50%",
    left: "30%",
    opacity: 0.22,
    driftDelay: "-6s",
    breatheDelay: "1.5s",
    blobClass: "cosmic-blob-2",
  },
  {
    color: "rgba(167, 139, 250, 0.7)",
    size: "58vmax",
    top: "10%",
    left: "60%",
    opacity: 0.28,
    driftDelay: "-12s",
    breatheDelay: "3s",
    blobClass: "cosmic-blob-3",
  },
  {
    color: "rgba(192, 38, 211, 0.5)",
    size: "40vmax",
    top: "55%",
    left: "72%",
    opacity: 0.18,
    driftDelay: "-4s",
    breatheDelay: "4.5s",
    blobClass: "cosmic-blob-4",
  },
  {
    color: "rgba(20, 184, 166, 0.6)",
    size: "50vmax",
    top: "65%",
    left: "0%",
    opacity: 0.24,
    driftDelay: "-9s",
    breatheDelay: "6s",
    blobClass: "cosmic-blob-5",
  },
] as const;

export default function CosmicBackground() {
  return (
    <div className="cosmic-bg" aria-hidden="true">
      {/* Layer 1 — Base gradient */}
      <div className="cosmic-bg-base" />

      {/* Layer 2 — Energy blobs */}
      {BLOB_CONFIGS.map((blob, i) => (
        <div
          key={i}
          className={`cosmic-blob ${blob.blobClass}`}
          style={{
            "--blob-color": blob.color,
            "--blob-size": blob.size,
            "--blob-top": blob.top,
            "--blob-left": blob.left,
            "--blob-opacity": blob.opacity,
            "--blob-drift-delay": blob.driftDelay,
            "--blob-breathe-delay": blob.breatheDelay,
          } as React.CSSProperties}
        />
      ))}

      {/* Layer 3 — Energy ribbons */}
      <div className="cosmic-ribbon cosmic-ribbon-1" />
      <div className="cosmic-ribbon cosmic-ribbon-2" />

      {/* Layer 4 — Geometric pattern overlay */}
      <div className="cosmic-geometry" />

      {/* Layer 5 — Particle field */}
      <div className="cosmic-particles" />
    </div>
  );
}
