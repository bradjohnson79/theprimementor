import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { formatPacificTime } from "@wisdom/utils";
import { api } from "../lib/api";

interface MemberRecording {
  orderId: string;
  orderNumber: string;
  sessionDate: string | null;
  recordingLink: string;
  createdAt: string;
}

interface MemberRecordingsResponse {
  recordings: MemberRecording[];
}

export default function Recordings() {
  const { getToken } = useAuth();
  const [recordings, setRecordings] = useState<MemberRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRecordings() {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        const response = (await api.get("/me/recordings", token)) as MemberRecordingsResponse;
        if (!cancelled) {
          setRecordings(response.recordings ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load recordings.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRecordings();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="dashboard-shell"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="dashboard-panel">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Recordings</h1>
          <p className="mt-2 text-sm text-white/60">
            Session recordings appear here as soon as your mentor adds them.
          </p>
        </section>

        {loading ? (
          <section className="dashboard-panel text-sm text-white/60">Loading recordings...</section>
        ) : error ? (
          <section className="dashboard-panel">
            <h2 className="text-lg font-semibold text-white">Unable to load recordings</h2>
            <p className="mt-2 text-sm text-rose-200">{error}</p>
          </section>
        ) : recordings.length === 0 ? (
          <section className="dashboard-panel">
            <h2 className="text-lg font-semibold text-white">No recordings yet</h2>
            <p className="mt-2 text-sm text-white/60">
              You don’t have any recordings yet. Your session recordings will appear here once available.
            </p>
            <Link to="/sessions" className="dashboard-action-primary mt-4 inline-flex">
              Book a Session
            </Link>
          </section>
        ) : (
          <section className="space-y-4">
            {recordings.map((recording) => (
              <article key={recording.orderId} className="dashboard-panel">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Order</p>
                    <p className="mt-2 text-lg font-semibold text-white">{recording.orderNumber}</p>
                    <p className="mt-2 text-sm text-white/65">
                      Session: {recording.sessionDate ? formatPacificTime(recording.sessionDate) : "Date pending"}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      Added {formatPacificTime(recording.createdAt)}
                    </p>
                  </div>
                  <a
                    href={recording.recordingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="dashboard-action-primary inline-flex"
                  >
                    Watch Recording
                  </a>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </motion.div>
  );
}
