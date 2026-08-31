import type { ReportCoverSources } from "../../data/reportLanding";

interface ReportCoverProps {
  cover: ReportCoverSources;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  sizes?: string;
  decorative?: boolean;
}

export default function ReportCover({
  cover,
  className = "",
  imgClassName = "",
  eager = false,
  sizes = "(max-width: 640px) 280px, (max-width: 1024px) 360px, 420px",
  decorative = false,
}: ReportCoverProps) {
  return (
    <picture className={className}>
      <source
        type="image/avif"
        srcSet={`${cover.avif640} 640w, ${cover.avif} 1024w`}
        sizes={sizes}
      />
      <source
        type="image/webp"
        srcSet={`${cover.webp640} 640w, ${cover.webp} 1024w`}
        sizes={sizes}
      />
      <img
        src={cover.webp}
        alt={decorative ? "" : cover.alt}
        width={cover.width}
        height={cover.height}
        loading={eager ? "eager" : "lazy"}
        decoding={eager ? "sync" : "async"}
        fetchPriority={eager ? "high" : "auto"}
        className={`h-auto w-full object-contain ${imgClassName}`.trim()}
      />
    </picture>
  );
}
