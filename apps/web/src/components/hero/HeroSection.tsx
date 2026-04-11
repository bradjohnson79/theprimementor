import heroHeaderFull from "../../assets/hero-header-full.webp";
import HeroContent from "./HeroContent";
import HeroEnergyRibbons from "./HeroEnergyRibbons";
import HeroSparkleField from "./HeroSparkleField";

interface HeroSectionProps {
  onExploreReports?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

export default function HeroSection({ onExploreReports }: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="relative scroll-mt-24 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      <div className="absolute inset-0">
        <img
          src={heroHeaderFull}
          alt=""
          className="h-full min-h-[100svh] w-full object-cover object-[52%_center] sm:object-center"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#04050f]/94 via-[#0a0d18]/45 to-transparent md:from-[#04050f]/88 md:via-[#080c18]/32"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#04050f]/70 via-transparent to-[#04050f]/25" aria-hidden />
      </div>

      <HeroEnergyRibbons />
      <HeroSparkleField className="z-[2]" />

      <div className="relative z-10 flex min-h-[100svh] flex-col justify-center px-6 py-14 md:px-8 md:py-20 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <HeroContent onExploreReports={onExploreReports} />
        </div>
      </div>
    </section>
  );
}
