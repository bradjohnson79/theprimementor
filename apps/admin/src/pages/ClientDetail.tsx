import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import Card from "../components/Card";
import Loading from "../components/Loading";

interface ClientData {
  id: string;
  full_birth_name: string;
  email: string;
  birth_date: string | null;
  birth_time: string | null;
  birth_location: string | null;
  goals: string | null;
  challenges: string | null;
  created_at: string;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getToken();
        const data = await api.get(`/clients/${id}`, token);
        if (!cancelled) setClient(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, getToken]);

  if (loading) return <Loading />;

  if (error || !client) {
    return (
      <div className="text-center text-white/60">
        <p>{error || "Client not found"}</p>
        <Link to="/clients" className="mt-4 inline-block text-accent-cyan hover:underline">
          Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Link to="/clients" className="text-sm text-accent-cyan hover:underline">
        ← Back to Clients
      </Link>

      <h2 className="mt-4 text-2xl font-bold text-white">
        {client.full_birth_name}
      </h2>
      <p className="mt-1 text-white/50">{client.email}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/50">
            Birth Data
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-white/40">Date</dt>
              <dd className="text-white/80">{client.birth_date || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Time</dt>
              <dd className="text-white/80">{client.birth_time || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Location</dt>
              <dd className="text-white/80">{client.birth_location || "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/50">
            Goals & Challenges
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-white/40">Goals</dt>
              <dd className="text-white/80">{client.goals || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Challenges</dt>
              <dd className="text-white/80">{client.challenges || "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </motion.div>
  );
}
