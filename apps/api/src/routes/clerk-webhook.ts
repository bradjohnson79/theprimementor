import type { FastifyInstance } from "fastify";
import { Webhook } from "svix";
import { resolvePrimaryEmail } from "../services/clerkIdentityService.js";
import { upsertUserFromIdentity } from "../services/userService.js";

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    primary_email_address_id?: string | null;
    email_addresses: Array<{ id: string; email_address: string }>;
    first_name?: string;
    last_name?: string;
  };
}

export async function clerkWebhookRoutes(app: FastifyInstance) {
  app.post(
    "/webhook/clerk",
    { config: { rawBody: true } },
    async (request, reply) => {
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
      if (!webhookSecret) {
        app.log.error("CLERK_WEBHOOK_SECRET not set");
        return reply.status(500).send({ error: "Server configuration error" });
      }

      const svixId = request.headers["svix-id"] as string;
      const svixTimestamp = request.headers["svix-timestamp"] as string;
      const svixSignature = request.headers["svix-signature"] as string;

      if (!svixId || !svixTimestamp || !svixSignature) {
        return reply.status(400).send({ error: "Missing svix headers" });
      }

      const rawBody = (request as unknown as { rawBody: string }).rawBody;
      const wh = new Webhook(webhookSecret);

      let event: ClerkWebhookEvent;
      try {
        event = wh.verify(rawBody, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        }) as ClerkWebhookEvent;
      } catch (err) {
        app.log.error(err, "Clerk webhook verification failed");
        return reply.status(400).send({ error: "Webhook verification failed" });
      }

      app.log.info({ type: event.type }, "Clerk webhook received");

      if (event.type === "user.created" || event.type === "user.updated") {
        const email = resolvePrimaryEmail({
          primaryEmailAddressId: event.data.primary_email_address_id ?? null,
          emailAddresses: event.data.email_addresses.map((entry) => ({
            id: entry.id,
            emailAddress: entry.email_address,
          })),
        });
        if (email) {
          await upsertUserFromIdentity(app.db, {
            clerkId: event.data.id,
            email,
          });
        }
      }

      return reply.send({ received: true });
    },
  );
}
