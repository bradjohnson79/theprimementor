import type { FastifyInstance } from "fastify";
import { getLatestFacebookPost, isFacebookGraphConfigured } from "../services/facebookPageService.js";

export async function socialRoutes(app: FastifyInstance) {
  app.get("/social/facebook/latest-post", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=300");

    if (!isFacebookGraphConfigured()) {
      return {
        enabled: false,
        post: null,
      };
    }

    try {
      const post = await getLatestFacebookPost();
      return {
        enabled: true,
        post,
      };
    } catch (error) {
      app.log.error({ error }, "facebook_latest_post_fetch_failed");
      return reply.status(502).send({
        error: "Failed to load latest Facebook post.",
      });
    }
  });
}
