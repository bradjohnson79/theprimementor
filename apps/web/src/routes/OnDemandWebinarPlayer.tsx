import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import MuxPlayer from "@mux/mux-player-react";
import { fetchOnDemandPlayback, fetchOnDemandWebinarMe, saveOnDemandProgress } from "../lib/onDemandWebinarApi";

const MAX_AUTH_REFRESHES = 2;

function isAuthorizationPlayerError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = typeof (error as { status?: unknown })?.status === "number"
    ? (error as { status: number }).status
    : typeof (error as { data?: { status?: unknown } })?.data?.status === "number"
      ? (error as { data: { status: number } }).data.status
      : null;
  return status === 401 || status === 403 || /403|401|expired|unauthorized|forbidden|jwt/i.test(message);
}

export default function OnDemandWebinarPlayer() {
  const { webinarId = "" } = useParams();
  const { getToken } = useAuth();
  const playerRef = useRef<HTMLElement | null>(null);
  const refreshCountRef = useRef(0);
  const lastPositionRef = useRef(0);
  const lastSavedPositionRef = useRef(0);
  const [title, setTitle] = useState("On-demand webinar");
  const [poster, setPoster] = useState<string | null>(null);
  const [playbackId, setPlaybackId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokens, setTokens] = useState<{ thumbnail?: string; storyboard?: string }>({});
  const [startTime, setStartTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPlayback = useCallback(async (preservePosition = false) => {
    const authToken = await getToken();
    const [me, playback] = await Promise.all([
      fetchOnDemandWebinarMe(webinarId, authToken),
      fetchOnDemandPlayback(webinarId, authToken),
    ]);
    setTitle(me.title);
    setPoster(me.posterPath);
    setPlaybackId(playback.playbackId);
    setToken(playback.token);
    setTokens({
      thumbnail: playback.tokens?.thumbnail,
      storyboard: playback.tokens?.storyboard,
    });
    setStartTime(preservePosition ? lastPositionRef.current : me.positionSeconds ?? 0);
    lastPositionRef.current = preservePosition ? lastPositionRef.current : me.positionSeconds ?? 0;
  }, [getToken, webinarId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadPlayback(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "This webinar is not available.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPlayback]);

  async function persistProgress(position: number) {
    lastPositionRef.current = position;
    lastSavedPositionRef.current = position;
    const authToken = await getToken();
    await saveOnDemandProgress(webinarId, position, authToken).catch(() => undefined);
  }

  async function handlePlayerError(event: Event) {
    const detail = (event as CustomEvent).detail ?? event;
    if (!isAuthorizationPlayerError(detail) || refreshCountRef.current >= MAX_AUTH_REFRESHES) {
      setError("Playback could not be authorized. Refresh the page or contact support if this continues.");
      return;
    }
    refreshCountRef.current += 1;
    try {
      await loadPlayback(true);
    } catch {
      setError("Playback authorization expired and could not be refreshed.");
    }
  }

  if (loading) {
    return <div className="dashboard-shell"><div className="dashboard-panel text-sm text-white/60">Loading player...</div></div>;
  }

  if (error || !playbackId || !token) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-panel space-y-3">
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="text-sm text-amber-200">{error ?? "Playback is unavailable."}</p>
          <Link to="/dashboard/webinars" className="text-sm text-white/70 underline">Back to My Webinars</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-200/60">On Demand</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">{title}</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              lastPositionRef.current = 0;
              const media = playerRef.current as { currentTime?: number } | null;
              if (media) media.currentTime = 0;
              void persistProgress(0);
            }}
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
          >
            Restart
          </button>
        </div>
        <MuxPlayer
          ref={playerRef as never}
          playbackId={playbackId}
          tokens={{
            playback: token,
            thumbnail: tokens.thumbnail,
            storyboard: tokens.storyboard,
          }}
          poster={poster ?? undefined}
          startTime={startTime}
          autoPlay={false}
          accentColor="#fcd34d"
          className="aspect-video w-full overflow-hidden rounded-3xl"
          onError={handlePlayerError}
          onPause={(event) => {
            const currentTime = Number((event.target as { currentTime?: number } | null)?.currentTime ?? lastPositionRef.current);
            void persistProgress(currentTime);
          }}
          onTimeUpdate={(event) => {
            const currentTime = Number((event.target as { currentTime?: number } | null)?.currentTime ?? 0);
            lastPositionRef.current = currentTime;
            if (Math.abs(currentTime - lastSavedPositionRef.current) >= 15) {
              void persistProgress(currentTime);
            }
          }}
          onEnded={(event) => {
            const currentTime = Number((event.target as { currentTime?: number } | null)?.currentTime ?? lastPositionRef.current);
            void persistProgress(currentTime);
          }}
        />
        <Link to="/dashboard/webinars" className="inline-block text-sm text-white/60 underline">Back to My Webinars</Link>
      </div>
    </div>
  );
}
