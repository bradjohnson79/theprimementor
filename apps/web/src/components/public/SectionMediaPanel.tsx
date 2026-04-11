import type { ReactNode } from "react";

interface SectionMediaPanelProps {
  eyebrow: string;
  title: string;
  description?: string;
  imageSrc?: string;
  imageAlt?: string;
  imageClassName?: string;
  /** When set, image is wrapped for aspect-ratio layouts (e.g. portrait 9:16). */
  imageFrameClassName?: string;
  /**
   * When true with imageSrc: image sits in a 16:9 frame (1280×720 style) with object-contain
   * so the full image is visible; letterboxing as needed. When false: inset fill with object-cover.
   */
  imageHd169Frame?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function SectionMediaPanel({
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt,
  imageClassName = "",
  imageFrameClassName = "",
  imageHd169Frame = false,
  className = "",
  children,
}: SectionMediaPanelProps) {
  return (
    <div
      className={[
        "relative flex min-h-[18rem] overflow-hidden rounded-xl border border-white/10",
        "bg-[radial-gradient(circle_at_top,_rgba(80,120,255,0.18),_transparent_42%),linear-gradient(180deg,rgba(10,14,28,0.95),rgba(5,7,16,0.92))]",
        "p-4 shadow-[0_20px_56px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      ].join(" ")}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent,rgba(118,89,255,0.06),transparent)]" />
      <div className="absolute -left-10 top-6 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-violet-500/12 blur-3xl" />

      {imageSrc ? (
        imageHd169Frame ? (
          <div className="absolute inset-3 z-10 flex min-h-0 items-center justify-center">
            <div
              className={[
                "w-full max-h-full overflow-hidden rounded-lg border border-white/6 bg-black/20 aspect-video",
                imageFrameClassName,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <img
                src={imageSrc}
                alt={imageAlt ?? title}
                className={["h-full w-full object-contain object-center", imageClassName].filter(Boolean).join(" ")}
              />
            </div>
          </div>
        ) : (
          <div
            className={[
              "absolute inset-3 z-10 overflow-hidden rounded-lg border border-white/6 bg-black/20",
              imageFrameClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <img
              src={imageSrc}
              alt={imageAlt ?? title}
              className={["h-full w-full object-cover object-center", imageClassName].filter(Boolean).join(" ")}
            />
          </div>
        )
      ) : (
        <div className="absolute inset-3 rounded-lg border border-white/6" />
      )}

      {!imageSrc ? (
        <div className="relative z-10 flex h-full w-full items-end">
          <div className="max-w-[15rem]">
            <p className="text-[0.68rem] uppercase tracking-[0.32em] text-cyan-200/60">{eyebrow}</p>
            <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-white">{title}</h3>
            {description ? (
              <p className="mt-3 text-sm leading-6 text-white/52">{description}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {children ? <div className="pointer-events-none absolute inset-0 z-20">{children}</div> : null}
    </div>
  );
}
