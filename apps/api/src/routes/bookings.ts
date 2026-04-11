import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import {
  cancelBooking,
  confirmBookingAvailability,
  createBooking,
  listBookingsForAdmin,
  listBookingsForUser,
} from "../services/booking/bookingService.js";
import { listActiveBookingTypes } from "../services/booking/bookingTypesService.js";

interface CreateBookingBody {
  bookingTypeId?: string;
  sessionType?: string;
  availability?: Record<string, unknown> | null;
  timezone?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  birthPlaceName?: string;
  birthLat?: number;
  birthLng?: number;
  birthTimezone?: string;
  timezoneSource?: "user" | "suggested" | "fallback";
  consentGiven?: boolean;
  intake?: Record<string, unknown> | null;
  notes?: string;
  userId?: string;
}

interface BookingParams {
  id: string;
}

interface AdminBookingsQuery {
  showArchived?: string;
}

interface ConfirmBookingBody {
  availabilityDay?: string;
  availabilityTime?: string;
}

export async function bookingsRoutes(app: FastifyInstance) {
  app.get("/booking-types", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return { data: await listActiveBookingTypes(app.db) };
  });

  app.post<{ Body: CreateBookingBody }>("/bookings", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    const {
      bookingTypeId,
      sessionType,
      availability,
      timezone,
      fullName,
      email,
      phone,
      birthDate,
      birthTime,
      birthPlace,
      birthPlaceName,
      birthLat,
      birthLng,
      birthTimezone,
      timezoneSource,
      consentGiven,
      intake,
      notes,
      userId,
    } = request.body ?? {};
    if (!bookingTypeId && !sessionType) {
      return reply.status(400).send({ error: "bookingTypeId or sessionType is required" });
    }
    if (!timezone) {
      return reply.status(400).send({ error: "timezone is required" });
    }

    const booking = await createBooking(app.db, {
      actorUserId: request.dbUser!.id,
      actorRole: request.dbUser!.role,
      bookingTypeId,
      sessionType,
      availability,
      timezone,
      fullName,
      email,
      phone,
      birthDate,
      birthTime,
      birthPlace,
      birthPlaceName,
      birthLat,
      birthLng,
      birthTimezone,
      timezoneSource,
      consentGiven,
      intake,
      notes,
      userId,
    });

    return {
      success: true,
      bookingId: booking.id,
      requiresPayment: true,
      data: booking,
    };
  });

  app.get("/bookings", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return {
      data: await listBookingsForUser(app.db, request.dbUser!.id),
    };
  });

  app.get<{ Querystring: AdminBookingsQuery }>("/admin/bookings", { preHandler: requireAuth }, async (request, reply) => {
    if (request.dbUser!.role !== "admin") {
      return reply.status(403).send({ error: "Admin access required" });
    }

    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return {
      data: await listBookingsForAdmin(app.db, new Date(), {
        showArchived: request.query.showArchived === "true",
      }),
    };
  });

  app.patch<{ Params: BookingParams; Body: ConfirmBookingBody }>(
    "/admin/bookings/:id/confirm",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (request.dbUser!.role !== "admin") {
        return reply.status(403).send({ error: "Admin access required" });
      }

      if (!app.db) {
        return reply.status(503).send({ error: "Database not available" });
      }

      const { availabilityDay, availabilityTime } = request.body ?? {};
      if (!availabilityDay || !availabilityTime) {
        return reply.status(400).send({ error: "availabilityDay and availabilityTime are required" });
      }

      return {
        data: await confirmBookingAvailability(app.db, {
          bookingId: request.params.id,
          actorUserId: request.dbUser!.id,
          actorRole: request.dbUser!.role,
          availabilityDay,
          availabilityTime,
        }),
      };
    },
  );

  app.delete<{ Params: BookingParams }>("/bookings/:id", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    return {
      data: await cancelBooking(app.db, {
        bookingId: request.params.id,
        actorUserId: request.dbUser!.id,
        actorRole: request.dbUser!.role,
      }),
    };
  });
}
