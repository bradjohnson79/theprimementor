/**
 * Soft luminous bands aligned with the curved light ribbons in the hero photograph
 * (upper sweep toward center / right). CSS animates a slow glow + gentle inward contraction.
 */
export default function HeroEnergyRibbons() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      <div className="hero-energy-ribbon hero-energy-ribbon-1" />
      <div className="hero-energy-ribbon hero-energy-ribbon-2" />
      <div className="hero-energy-ribbon hero-energy-ribbon-3" />
      <div className="hero-energy-ribbon hero-energy-ribbon-4" />
    </div>
  );
}
