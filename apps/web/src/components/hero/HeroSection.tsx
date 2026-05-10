import heroHeaderFull from "../../assets/hero-header-full.webp";
import mobileHeroHeader from "../../assets/mobile-hero-header.webp";
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
      className="relative scroll-mt-24 overflow-hidden bg-[#04050f]"
      aria-labelledby="hero-heading"
    >
      <div className="absolute inset-0">
        {/* Regeneration artwork: contained accent on the right — avoids full-viewport cover dominating the CTA copy */}
        <div
          className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6 pt-[38vh] sm:items-center sm:justify-end sm:pb-10 sm:pt-0 sm:pr-6 md:pr-10 lg:pr-14"
          aria-hidden
        >
          <img
            src={mobileHeroHeader}
            alt=""
            className="h-auto max-h-[38vh] w-full max-w-[min(100%,420px)] object-contain object-bottom sm:hidden"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          <img
            src={heroHeaderFull}
            alt=""
            className="hidden h-auto max-h-[min(46vh,440px)] w-auto max-w-[min(88vw,400px)] object-contain object-right opacity-[0.92] sm:block md:max-h-[min(50vh,480px)] md:max-w-[min(42vw,440px)] lg:max-h-[min(52vh,500px)] lg:max-w-[min(36vw,460px)]"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#04050f] from-0% via-[#04050f]/95 via-40% to-transparent sm:via-[#060814]/82 sm:via-48% md:via-[#060814]/68 md:via-52%"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#04050f]/55 via-transparent to-[#04050f]/30 sm:from-[#04050f]/40" aria-hidden />
      </div>

      <HeroEnergyRibbons />
      <HeroSparkleField className="z-[2]" />

      <div className="relative z-10 flex min-h-[min(100svh,56rem)] flex-col justify-center px-6 py-14 md:px-8 md:py-20 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <HeroContent onExploreReports={onExploreReports} />
        </div>
      </div>
    </section>
  );
}
