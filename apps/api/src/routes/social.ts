import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { getLatestFacebookPost, isFacebookGraphConfigured } from "../services/facebookPageService.js";

export async function socialRoutes(app: FastifyInstance) {
  app.get("/social/facebook/latest-post", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=300");

    if (!isFacebookGraphConfigured()) {
      return ok({
        enabled: false,
        post: null,
      });
    }

    try {
      const post = await getLatestFacebookPost();
      return ok({
        enabled: true,
        post,
      });
    } catch (error) {
      app.log.error({ error }, "facebook_latest_post_fetch_failed");
      return sendApiError(reply, 502, "Failed to load latest Facebook post.");
    }
  });
}
