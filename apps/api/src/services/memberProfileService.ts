import { eq } from "drizzle-orm";
import { users, type Database } from "@wisdom/db";
import { createHttpError } from "./booking/errors.js";

const MAX_PHONE_LENGTH = 40;

function normalizePhone(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw createHttpError(400, "Phone number must be a string.");
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > MAX_PHONE_LENGTH) {
    throw createHttpError(400, `Phone number must be ${MAX_PHONE_LENGTH} characters or fewer.`);
  }
  if (!/^[+()\-\d .extEXT]+$/.test(normalized)) {
    throw createHttpError(400, "Phone number contains unsupported characters.");
  }
  return normalized;
}

export async function updateMemberProfile(db: Database, userId: string, body: unknown) {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const phone = normalizePhone(input.phone);

  const [updated] = await db
    .update(users)
    .set({
      phone,
      updated_at: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      phone: users.phone,
      role: users.role,
      created_at: users.created_at,
    });

  if (!updated) {
    throw createHttpError(404, "User not found.");
  }

  return {
    id: updated.id,
    email: updated.email,
    phone: updated.phone ?? null,
    role: updated.role,
    created_at: updated.created_at,
  };
}
