import { useEffect } from "react";

interface YouTubeLessonPlayerProps {
  videoUrl: string;
  title: string;
  onProgressChange?: (progress: number) => void;
}

function isValidYouTubeEmbedUrl(videoUrl: string) {
  try {
    const parsed = new URL(videoUrl);
    return parsed.protocol === "https:"
      && parsed.hostname === "www.youtube.com"
      && parsed.pathname.startsWith("/embed/")
      && parsed.pathname.length > "/embed/".length;
  } catch {
    return false;
  }
}

export default function YouTubeLessonPlayer({
  videoUrl,
  title,
  onProgressChange,
}: YouTubeLessonPlayerProps) {
  const playerError =
    typeof videoUrl === "string" && isValidYouTubeEmbedUrl(videoUrl)
      ? null
      : "A valid YouTube lesson URL has not been configured yet.";

  useEffect(() => {
    onProgressChange?.(0);
  }, [onProgressChange, videoUrl]);

  if (playerError) {
    return (
      <div className="dashboard-panel border-rose-400/20 bg-rose-400/10 text-rose-100">
        <div className="flex aspect-video items-center justify-center rounded-2xl border border-rose-400/15 bg-slate-950/40 px-6 text-center text-sm">
          {playerError}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-[0_24px_80px_rgba(8,15,30,0.32)]">
      <div className="aspect-video w-full bg-slate-950">
        <iframe
          src={videoUrl}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  );
}
