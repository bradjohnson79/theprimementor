import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import Card from "../components/Card";
import { api } from "../lib/api";

type AvailabilityDay = "monday" | "tuesday" | "wednesday" | "thursday";

interface BookingType {
  id: string;
  name: string;
  session_type: string;
  duration_minutes: number;
  price_cents: number;
  currency: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
}

interface BookingAvailability {
  monday: string[];
  tuesday: string[];
  wednesday: string[];
  thursday: string[];
}

interface BookingSummary {
  id: string;
  user_id: string;
  archived: boolean;
  session_type: string;
  start_time_utc: string | null;
  end_time_utc: string | null;
  timezone: string;
  status: "pending_payment" | "paid" | "scheduled" | "completed" | "cancelled";
  availability: BookingAvailability | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  can_cancel: boolean;
  booking_type: BookingType;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

const AVAILABILITY_DAYS: AvailabilityDay[] = ["monday", "tuesday", "wednesday", "thursday"];

const AVAILABILITY_DAY_LABELS: Record<AvailabilityDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
};

function formatAvailabilityTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatScheduledDateTime(value: string | null, timeZone: string) {
  if (!value) return "Unscheduled";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function titleCaseStatus(status: BookingSummary["status"]) {
  return status.replace(/_/g, " ");
}

export default function Bookings() {
  const { getToken } = useAuth();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const metrics = useMemo(() => {
    const counts = {
      total: bookings.length,
      pending_payment: 0,
      paid: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const booking of bookings) {
      counts[booking.status] += 1;
    }

    return counts;
  }, [bookings]);

  async function loadBookings() {
    setLoadingBookings(true);
    try {
      const token = await getToken();
      const response = (await api.get(`/admin/bookings?showArchived=${showArchived ? "true" : "false"}`, token)) as {
        data: BookingSummary[];
      };
      setBookings(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings.");
    } finally {
      setLoadingBookings(false);
    }
  }

  useEffect(() => {
    void loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  async function handleConfirmAvailability(bookingId: string, availabilityDay: AvailabilityDay, availabilityTime: string) {
    const actionKey = `${bookingId}:${availabilityDay}:${availabilityTime}`;
    setActingId(actionKey);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();
      await api.patch(
        `/admin/bookings/${bookingId}/confirm`,
        { availabilityDay, availabilityTime },
        token,
      );
      setSuccess(`Scheduled ${AVAILABILITY_DAY_LABELS[availabilityDay]} ${formatAvailabilityTime(availabilityTime)}.`);
      await loadBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm booking.");
    } finally {
      setActingId(null);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    setActingId(bookingId);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();
      await api.delete(`/bookings/${bookingId}`, token);
      setSuccess("Booking cancelled.");
      await loadBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellation failed.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white">Bookings</h2>
        <p className="mt-1 text-white/50">
          Review client-submitted availability, confirm final session times, and manage booking status.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <p className="text-sm font-medium text-white/50">Total</p>
          <p className="mt-2 text-3xl font-bold text-white">{metrics.total}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Pending Payment</p>
          <p className="mt-2 text-3xl font-bold text-amber-200">{metrics.pending_payment}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Paid</p>
          <p className="mt-2 text-3xl font-bold text-cyan-200">{metrics.paid}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Scheduled</p>
          <p className="mt-2 text-3xl font-bold text-accent-cyan">{metrics.scheduled}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Completed</p>
          <p className="mt-2 text-3xl font-bold text-emerald-300">{metrics.completed}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-white/50">Cancelled</p>
          <p className="mt-2 text-3xl font-bold text-rose-300">{metrics.cancelled}</p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Booking Queue</h3>
            <p className="mt-1 text-sm text-white/50">
              Confirm only the times clients submitted in their availability.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-white/65">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Show Archived
          </label>
        </div>

        {loadingBookings ? (
          <p className="mt-5 text-sm text-white/50">Loading bookings...</p>
        ) : bookings.length ? (
          <div className="mt-5 space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className={`rounded-xl border border-glass-border bg-white/5 p-5 ${booking.archived ? "opacity-55" : ""}`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <p className="font-medium text-white">
                      {booking.user?.email || booking.user_id} · {booking.booking_type.name}
                    </p>
                    <p className="text-sm text-white/60">
                      {titleCaseStatus(booking.status)} · Submitted {formatScheduledDateTime(booking.created_at, booking.timezone)}
                    </p>
                    {booking.archived ? (
                      <p className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/60">
                        Archived
                      </p>
                    ) : null}
                    <p className="text-sm text-white/55">
                      Timezone: <span className="text-white/75">{booking.timezone}</span>
                    </p>
                    {booking.start_time_utc ? (
                      <p className="text-sm text-white/70">
                        Scheduled for <span className="font-medium text-white">{formatScheduledDateTime(booking.start_time_utc, booking.timezone)}</span>
                      </p>
                    ) : null}
                    {booking.notes ? <p className="text-sm text-white/50">{booking.notes}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!booking.can_cancel || actingId === booking.id}
                      onClick={() => void handleCancelBooking(booking.id)}
                      className="rounded-lg border border-glass-border px-4 py-2 text-sm text-white/80 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {actingId === booking.id ? "Cancelling..." : "Cancel"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-glass-border bg-navy-deep/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/40">Client Availability</p>
                  {booking.availability && AVAILABILITY_DAYS.some((day) => booking.availability?.[day]?.length) ? (
                    <div className="mt-3 space-y-4">
                      {AVAILABILITY_DAYS.map((day) => {
                        const times = booking.availability?.[day] ?? [];
                        if (times.length === 0) return null;

                        return (
                          <div key={`${booking.id}-${day}`} className="space-y-3">
                            <p className="text-sm font-medium text-white">
                              {AVAILABILITY_DAY_LABELS[day]}:{" "}
                              <span className="font-normal text-white/70">
                                {times.map(formatAvailabilityTime).join(", ")}
                              </span>
                            </p>
                            {booking.status === "paid" ? (
                              <div className="flex flex-wrap gap-2">
                                {times.map((time) => {
                                  const actionKey = `${booking.id}:${day}:${time}`;
                                  return (
                                    <button
                                      key={actionKey}
                                      type="button"
                                      disabled={actingId === actionKey}
                                      onClick={() => void handleConfirmAvailability(booking.id, day, time)}
                                      className="rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-2 text-sm text-accent-cyan transition hover:bg-accent-cyan/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {actingId === actionKey
                                        ? "Confirming..."
                                        : `Confirm ${AVAILABILITY_DAY_LABELS[day]} ${formatAvailabilityTime(time)}`}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-white/50">No client availability stored for this booking.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-white/50">No bookings yet.</p>
        )}
      </Card>
    </motion.div>
  );
}
