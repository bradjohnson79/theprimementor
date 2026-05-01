import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
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
  deferPaymentRecord?: boolean;
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
  app.get("/booking-types", { preHandler: requireAuth }, async () => {
    const db = requireDatabase(app.db);
    return ok({ data: await listActiveBookingTypes(db) });
  });

  app.post<{ Body: CreateBookingBody }>("/bookings", { preHandler: requireAuth }, async (request, reply) => {
    const db = requireDatabase(app.db);

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
      deferPaymentRecord,
    } = request.body ?? {};
    if (!bookingTypeId && !sessionType) {
      return sendApiError(reply, 400, "bookingTypeId or sessionType is required");
    }
    if (!timezone) {
      return sendApiError(reply, 400, "timezone is required");
    }

    const booking = await createBooking(db, {
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
      deferPaymentRecord,
    });

    return ok({
      success: true,
      bookingId: booking.id,
      requiresPayment: true,
      data: booking,
    });
  });

  app.get("/bookings", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);
    return ok({
      data: await listBookingsForUser(db, request.dbUser!.id),
    });
  });

  app.get<{ Querystring: AdminBookingsQuery }>("/admin/bookings", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    const db = requireDatabase(app.db);

    return ok({
      data: await listBookingsForAdmin(db, new Date(), {
        showArchived: request.query.showArchived === "true",
      }),
    });
  });

  app.patch<{ Params: BookingParams; Body: ConfirmBookingBody }>(
    "/admin/bookings/:id/confirm",
    { preHandler: requireAuth },
    async (request, reply) => {
      requireAdmin(request);
      const db = requireDatabase(app.db);

      const { availabilityDay, availabilityTime } = request.body ?? {};
      if (!availabilityDay || !availabilityTime) {
        return sendApiError(reply, 400, "availabilityDay and availabilityTime are required");
      }

      return ok({
        data: await confirmBookingAvailability(db, {
          bookingId: request.params.id,
          actorUserId: request.dbUser!.id,
          actorRole: request.dbUser!.role,
          availabilityDay,
          availabilityTime,
        }),
      });
    },
  );

  app.delete<{ Params: BookingParams }>("/bookings/:id", { preHandler: requireAuth }, async (request) => {
    const db = requireDatabase(app.db);

    return ok({
      data: await cancelBooking(db, {
        bookingId: request.params.id,
        actorUserId: request.dbUser!.id,
        actorRole: request.dbUser!.role,
      }),
    });
  });
}
