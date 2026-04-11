/**
 * Local physiognomy image upload — multipart only, no Cloudinary.
 * Returns imageAssetId (basename) for use in POST /blueprints/generate.
 */

import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import {
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
      const data = await request.file({
        limits: { fileSize: MAX_BYTES },
      });

      if (!data) {
        return reply.status(400).send({ error: "No file uploaded. Include a file in the 'image' field." });
      }

      if (!ALLOWED_TYPES.has(data.mimetype)) {
        return reply.status(400).send({
          error: `Unsupported file type: ${data.mimetype}. Allowed: JPEG, PNG, WebP.`,
        });
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      for await (const chunk of data.file) {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BYTES) {
          return reply.status(413).send({ error: "Image must be under 5MB." });
        }
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      const { imageAssetId } = await savePhysiognomyImage(buffer, data.mimetype);
      app.log.info({ imageAssetId }, "Physiognomy image saved locally");

      return { imageAssetId };
    },
  );

  /** Authenticated preview of uploaded image (same basename id) */
  app.get<{ Params: { imageAssetId: string } }>(
    "/images/physiognomy/:imageAssetId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const buf = await readPhysiognomyImage(request.params.imageAssetId);
      if (!buf) {
        return reply.status(404).send({ error: "Image not found" });
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
