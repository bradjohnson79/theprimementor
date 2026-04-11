import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { formatPacificDateOnly } from "@wisdom/utils";
import { api } from "../lib/api";
import Table from "../components/Table";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";
import Card from "../components/Card";

interface Client {
  id: string;
  full_birth_name: string;
  email: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const columns = [
  { key: "full_birth_name" as const, label: "Name" },
  { key: "email" as const, label: "Email" },
  {
    key: "created_at" as const,
    label: "Created",
    render: (value: string) => formatPacificDateOnly(value),
  },
];

export default function Clients() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const token = await getToken();
        const result = await api.get(`/clients?page=${page}&limit=20`, token);
        if (!cancelled) {
          setClients(result.data);
          setPagination(result.pagination);
        }
      } catch (err) {
        console.error("[Clients] fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [getToken, page]);

  if (loading) return <Loading />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="text-2xl font-bold text-white">Clients</h2>
      <p className="mt-1 text-white/50">
        All registered clients.
        {pagination && pagination.total > 0 && (
          <span className="ml-2 text-white/30">({pagination.total} total)</span>
        )}
      </p>

      <div className="mt-6">
        <Card className="p-0 overflow-hidden">
          {clients.length === 0 ? (
            <EmptyState
              title="No clients yet"
              message="Clients will appear here once they sign up."
            />
          ) : (
            <Table
              columns={columns}
              data={clients}
              onRowClick={(row) => navigate(`/clients/${row.id}`)}
            />
          )}
        </Card>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg bg-glass px-4 py-2 text-sm text-white/70 transition-colors hover:bg-glass-hover disabled:cursor-not-allowed disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-white/50">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="rounded-lg bg-glass px-4 py-2 text-sm text-white/70 transition-colors hover:bg-glass-hover disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </motion.div>
  );
}
