import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ok, sendApiError } from "../apiContract.js";
import { clearOnDemandMuxReadinessCache } from "../services/mux/muxPlaybackService.js";

function verifyMuxSignature(rawBody: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim() ?? "", value?.trim() ?? ""];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function muxRoutes(app: FastifyInstance) {
  app.post("/mux/webhook", async (request, reply) => {
    const secret = process.env.MUX_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return sendApiError(reply, 503, "Mux webhook secret is not configured");
    }
    const header = typeof request.headers["mux-signature"] === "string" ? request.headers["mux-signature"] : "";
    const rawBody = typeof request.rawBody === "string"
      ? request.rawBody
      : Buffer.isBuffer(request.rawBody)
        ? request.rawBody.toString("utf8")
        : JSON.stringify(request.body ?? {});
    if (!verifyMuxSignature(rawBody, header, secret)) {
      return sendApiError(reply, 400, "Invalid Mux webhook signature");
    }
    clearOnDemandMuxReadinessCache();
    return ok({ received: true });
  });
}
