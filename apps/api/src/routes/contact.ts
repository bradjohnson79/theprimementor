import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { resolveAdminContactEmail, sendMemberContactEmail } from "../services/contactService.js";

interface MemberContactBody {
  name?: string;
  email?: string;
  message?: string;
}

function normalizeField(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function contactRoutes(app: FastifyInstance) {
  app.post<{ Body: MemberContactBody }>("/member/contact", { preHandler: requireAuth }, async (request, reply) => {
    if (!app.db) {
      return reply.status(503).send({ error: "Database not available" });
    }

    const name = normalizeField(request.body?.name);
    const email = normalizeField(request.body?.email);
    const message = normalizeField(request.body?.message);

    if (!name || !email || !message) {
      return reply.status(400).send({ error: "name, email, and message are required" });
    }

    if (name.length > 120 || email.length > 254 || message.length > 5000) {
      return reply.status(400).send({ error: "Contact form values are too long" });
    }

    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailLooksValid) {
      return reply.status(400).send({ error: "A valid email is required" });
    }

    try {
      const adminEmail = await resolveAdminContactEmail(app.db);
      await sendMemberContactEmail(adminEmail, {
        name,
        email,
        message,
        memberEmail: request.dbUser?.email,
      });

      return reply.send({ ok: true });
    } catch (error) {
      request.log.error(error, "Failed to deliver member contact email");
      return reply.status(500).send({ error: "Unable to send contact message" });
    }
  });
}
