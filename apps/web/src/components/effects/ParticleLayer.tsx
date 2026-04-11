import type { CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";

const PARTICLES = Array.from({ length: 42 }, (_, index) => {
  const left = (index * 17 + 11) % 100;
  const top = (index * 29 + 7) % 100;
  const size = 1.2 + (index % 4) * 0.7;
  const duration = 12 + (index % 7) * 3;
  const delay = (index % 9) * -1.6;
  const opacity = 0.14 + (index % 5) * 0.06;

  return {
    id: `particle-${index}`,
    style: {
      "--particle-left": `${left}%`,
      "--particle-top": `${top}%`,
      "--particle-size": `${size}px`,
      "--particle-duration": `${duration}s`,
      "--particle-delay": `${delay}s`,
      "--particle-opacity": opacity,
    } as CSSProperties,
  };
});

export default function ParticleLayer() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return null;

  return (
    <div className="hero-particle-layer" aria-hidden="true">
      {PARTICLES.map((particle) => (
        <span key={particle.id} className="hero-particle" style={particle.style} />
      ))}
    </div>
  );
}
