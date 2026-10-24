import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireDatabase } from "../routeAssertions.js";
import { saveBookingIntakeImage } from "../services/booking/intakeImageService.js";
import {
  getGuestIntakeView,
  resolveGuestIntakeUploadOwner,
  submitGuestIntake,
} from "../services/guest/guestIntakeService.js";
import { dispatchOrderExecution } from "../services/divin8ExecutionDispatcher.js";

/**
 * Public guest intake endpoints (no sign-in). Authorization is the per-order "order_intake"
 * token in the path; every failure to resolve it is the same generic 404, whether the token is
 * unknown, expired, for another purpose, or for an order that moved. Registered inside
 * guestCheckoutRoutes so the guest schema guard preHandler applies.
 */

const VIEW_RATE_LIMIT = { max: 30, timeWindow: "1 minute" } as const;
const WRITE_RATE_LIMIT = { max: 10, timeWindow: "1 minute" } as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

function isHoneypotTripped(body: Record<string, unknown> | undefined): boolean {
  const value = body?.website ?? body?.company ?? body?.hp_field;
  return typeof value === "string" && value.trim().length > 0;
}

const INVALID_LINK_MESSAGE = "This link has expired or is no longer valid.";

export function registerGuestIntakeRoutes(app: FastifyInstance) {
  app.get<{ Params: { token: string } }>(
    "/guest/intake/:token",
    { config: { rateLimit: VIEW_RATE_LIMIT } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      if (!TOKEN_PATTERN.test(request.params.token)) {
        return sendApiError(reply, 404, INVALID_LINK_MESSAGE);
      }
      reply.header("Cache-Control", "no-store");
      reply.header("Referrer-Policy", "no-referrer");
      return ok(await getGuestIntakeView(db, request.params.token));
    },
  );

  app.post<{ Params: { token: string } }>(
    "/guest/intake/:token/images",
    { config: { rateLimit: WRITE_RATE_LIMIT } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      if (!TOKEN_PATTERN.test(request.params.token)) {
        return sendApiError(reply, 404, INVALID_LINK_MESSAGE);
      }
      const ownerUserId = await resolveGuestIntakeUploadOwner(db, request.params.token);
      const data = await request.file({ limits: { fileSize: MAX_IMAGE_BYTES } });
      if (!data) {
        return sendApiError(reply, 400, "No file uploaded. Include a file in the 'image' field.");
      }
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      for await (const chunk of data.file) {
        totalBytes += chunk.length;
        if (totalBytes > MAX_IMAGE_BYTES) {
          return sendApiError(reply, 413, "Image must be under 5MB.");
        }
        chunks.push(chunk);
      }
      if (data.file.truncated) {
        return sendApiError(reply, 413, "Image must be under 5MB.");
      }
      const saved = await saveBookingIntakeImage(db, {
        userId: ownerUserId,
        fileName: data.filename || "intake-image",
        contentType: data.mimetype,
        data: Buffer.concat(chunks),
      });
      reply.header("Cache-Control", "no-store");
      return ok(saved);
    },
  );

  app.post<{ Params: { token: string }; Body: Record<string, unknown> }>(
    "/guest/intake/:token/submit",
    { config: { rateLimit: WRITE_RATE_LIMIT } },
    async (request, reply) => {
      const db = requireDatabase(app.db);
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (isHoneypotTripped(body)) {
        return ok({ intakeStatus: "submitted" });
      }
      if (!TOKEN_PATTERN.test(request.params.token)) {
        return sendApiError(reply, 404, INVALID_LINK_MESSAGE);
      }
      const result = await submitGuestIntake(db, request.params.token, body, {
        onReportReady: (reportId) => {
          void dispatchOrderExecution(db, `report_${reportId}`, {
            trigger: "guest_intake",
            logger: request.log,
            retryDelaysMs: [500, 1000, 2000],
          }).catch((error) => {
            request.log.error({ reportId, error }, "divin8_guest_intake_dispatch_failed");
          });
        },
      });
      reply.header("Cache-Control", "no-store");
      return ok(result);
    },
  );
}
