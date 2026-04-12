/**
 * Local physiognomy image upload — multipart only, no Cloudinary.
 * Returns imageAssetId (basename) for use in POST /blueprints/generate.
 */

import type { FastifyInstance } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { assertObjectAccess, requireDbUser } from "../routeAssertions.js";
import {
  canAccessPhysiognomyImage,
  savePhysiognomyImage,
  readPhysiognomyImage,
} from "../services/physiognomyImageStorage.js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function imageRoutes(app: FastifyInstance) {
  app.post(
    "/images/upload",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = requireDbUser(request);
      const data = await request.file({
        limits: { fileSize: MAX_BYTES },
      });

      if (!data) {
        return sendApiError(reply, 400, "No file uploaded. Include a file in the 'image' field.");
      }

      if (!ALLOWED_TYPES.has(data.mimetype)) {
        return sendApiError(reply, 400, `Unsupported file type: ${data.mimetype}. Allowed: JPEG, PNG, WebP.`);
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      for await (const chunk of data.file) {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BYTES) {
          return sendApiError(reply, 413, "Image must be under 5MB.");
        }
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      const { imageAssetId } = await savePhysiognomyImage(buffer, data.mimetype, {
        ownerUserId: user.id,
      });
      app.log.info({ imageAssetId }, "Physiognomy image saved locally");

      return ok({ imageAssetId });
    },
  );

  /** Authenticated preview of uploaded image (same basename id) */
  app.get<{ Params: { imageAssetId: string } }>(
    "/images/physiognomy/:imageAssetId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = requireDbUser(request);
      const hasAccess = await canAccessPhysiognomyImage(request.params.imageAssetId, {
        userId: user.id,
        role: user.role,
      });
      assertObjectAccess(hasAccess, "Image not found", 404);

      const buf = await readPhysiognomyImage(request.params.imageAssetId);
      if (!buf) {
        return sendApiError(reply, 404, "Image not found");
      }
      const ext = request.params.imageAssetId.toLowerCase().split(".").pop();
      const type =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      reply.header("Content-Type", type);
      reply.header("Cache-Control", "private, max-age=60");
      return reply.send(buf);
    },
  );
}
