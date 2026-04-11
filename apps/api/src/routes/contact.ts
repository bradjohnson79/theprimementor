import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { resolveAdminContactEmail, sendContactEmail } from "../services/contactService.js";

interface ContactBody {
  name?: string;
  email?: string;
  message?: string;
}

function normalizeField(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateContactBody(body: ContactBody | undefined) {
  const name = normalizeField(body?.name);
  const email = normalizeField(body?.email);
  const message = normalizeField(body?.message);

  if (!name || !email || !message) {
    return { error: "name, email, and message are required" };
  }

  if (name.length > 120 || email.length > 254 || message.length > 5000) {
    return { error: "Contact form values are too long" };
  }

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailLooksValid) {
    return { error: "A valid email is required" };
  }

  return { name, email, message };
}

export async function contactRoutes(app: FastifyInstance) {
  app.post<{ Body: ContactBody }>("/contact", async (request, reply) => {
    const validated = validateContactBody(request.body);
    if ("error" in validated) {
      return reply.status(400).send({ error: validated.error });
    }

    try {
      const adminEmail = await resolveAdminContactEmail(app.db ?? null);
      await sendContactEmail(adminEmail, {
        name: validated.name,
        email: validated.email,
        message: validated.message,
        source: "public",
      });

      return reply.send({ ok: true });
    } catch (error) {
      request.log.error(error, "Failed to deliver public contact email");
      return reply.status(500).send({ error: "Unable to send contact message" });
    }
  });

  app.post<{ Body: ContactBody }>("/member/contact", { preHandler: requireAuth }, async (request, reply) => {
    const validated = validateContactBody(request.body);
    if ("error" in validated) {
      return reply.status(400).send({ error: validated.error });
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

      return reply.send({ ok: true });
    } catch (error) {
      request.log.error(error, "Failed to deliver member contact email");
      return reply.status(500).send({ error: "Unable to send contact message" });
    }
  });
}
