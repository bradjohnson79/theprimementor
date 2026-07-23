import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { resolveAdminContactEmail, sendContactEmail } from "../services/contactService.js";

interface ContactBody {
  name?: string;
  email?: string;
  message?: string;
  company?: string;
  submittedAt?: number;
}

const CONTACT_MIN_SUBMIT_MS = 2500;
const CONTACT_MAX_SUBMIT_MS = 2 * 60 * 60 * 1000;
const MAX_CONTACT_LINKS = 4;

function normalizeField(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateContactBody(body: ContactBody | undefined) {
  const name = normalizeField(body?.name);
  const email = normalizeField(body?.email);
  const message = normalizeField(body?.message);
  const company = normalizeField(body?.company);
  const submittedAt = typeof body?.submittedAt === "number" ? body.submittedAt : null;

  if (!name || !email || !message) {
    return { error: "name, email, and message are required" };
  }

  if (company) {
    return { spam: true as const, reason: "honeypot" };
  }

  if (!submittedAt || !Number.isFinite(submittedAt)) {
    return { error: "Please refresh the page and try again." };
  }

  const elapsedMs = Date.now() - submittedAt;
  if (elapsedMs < CONTACT_MIN_SUBMIT_MS) {
    return { spam: true as const, reason: "too_fast" };
  }

  if (elapsedMs > CONTACT_MAX_SUBMIT_MS) {
    return { error: "This contact form expired. Please refresh the page and try again." };
  }

  if (name.length > 120 || email.length > 254 || message.length > 5000) {
    return { error: "Contact form values are too long" };
  }

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailLooksValid) {
    return { error: "A valid email is required" };
  }

  const linkCount = (message.match(/https?:\/\/|www\./gi) ?? []).length;
  if (linkCount > MAX_CONTACT_LINKS) {
    return { error: "Please remove extra links and try again." };
  }

  return { name, email, message };
}

export async function contactRoutes(app: FastifyInstance) {
  app.post<{ Body: ContactBody }>("/contact", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "10 minutes",
      },
    },
  }, async (request, reply) => {
    const validated = validateContactBody(request.body);
    if ("spam" in validated) {
      request.log.info({ reason: validated.reason }, "Suppressed spam-like public contact submission");
      return ok({ ok: true });
    }
    if ("error" in validated) {
      return sendApiError(reply, 400, validated.error ?? "Invalid contact request");
    }

    try {
      const adminEmail = await resolveAdminContactEmail(app.db ?? null);
      await sendContactEmail(adminEmail, {
        name: validated.name,
        email: validated.email,
        message: validated.message,
        source: "public",
      });

      return ok({ ok: true });
    } catch (error) {
      request.log.error(error, "Failed to deliver public contact email");
      return sendApiError(reply, 500, "Unable to send contact message");
    }
  });

  app.post<{ Body: ContactBody }>("/member/contact", {
    preHandler: requireAuth,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "10 minutes",
      },
    },
  }, async (request, reply) => {
    const validated = validateContactBody(request.body);
    if ("spam" in validated) {
      request.log.info({ reason: validated.reason, userId: request.dbUser?.id }, "Suppressed spam-like member contact submission");
      return ok({ ok: true });
    }
    if ("error" in validated) {
      return sendApiError(reply, 400, validated.error ?? "Invalid contact request");
    }

    try {
      const adminEmail = await resolveAdminContactEmail(app.db ?? null);
      await sendContactEmail(adminEmail, {
        name: validated.name,
        email: validated.email,
        message: validated.message,
        memberEmail: request.dbUser?.email,
        source: "member",
      });

      return ok({ ok: true });
    } catch (error) {
      request.log.error(error, "Failed to deliver member contact email");
      return sendApiError(reply, 500, "Unable to send contact message");
    }
  });
}
