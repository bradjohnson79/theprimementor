import {
  STAR_FAMILY_WEBINAR_LANDSCAPE_POSTER_PATH,
  STAR_FAMILY_WEBINAR_PORTRAIT_POSTER_PATH,
  STAR_FAMILY_WEBINAR_POSTER_ALT,
} from "@wisdom/utils";

export default function StarFamilyPoster({
  priority = false,
  portrait = false,
  className = "",
}: {
  priority?: boolean;
  portrait?: boolean;
  className?: string;
}) {
  if (portrait) {
    return (
      <img
        src={STAR_FAMILY_WEBINAR_PORTRAIT_POSTER_PATH}
        alt={STAR_FAMILY_WEBINAR_POSTER_ALT}
        width={941}
        height={1672}
        className={`aspect-[9/16] h-auto w-full object-contain ${className}`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  return (
    <picture className={`block ${className}`}>
      <source media="(min-width: 768px)" srcSet={STAR_FAMILY_WEBINAR_LANDSCAPE_POSTER_PATH} />
      <img
        src={STAR_FAMILY_WEBINAR_PORTRAIT_POSTER_PATH}
        alt={STAR_FAMILY_WEBINAR_POSTER_ALT}
        width={1080}
        height={1920}
        className="aspect-[9/16] h-auto w-full object-contain md:aspect-video"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}
