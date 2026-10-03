import { and, eq, isNull } from "drizzle-orm";
import { bookingIntakeImages, type Database } from "@wisdom/db";
import { createHttpError } from "./errors.js";

type IntakeImageDb = Pick<Database, "select" | "insert" | "update">;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export function assertIntakeImageUpload(mimeType: string, byteSize: number) {
  if (!ALLOWED_TYPES.has(mimeType.toLowerCase())) {
    throw createHttpError(400, "Please upload a JPEG, PNG, or WebP image.");
  }
  if (byteSize <= 0 || byteSize > MAX_BYTES) {
    throw createHttpError(400, "Image must be under 5MB.");
  }
}

export function sanitizeIntakeImageFileName(fileName: string, mimeType: string) {
  const base = fileName.split(/[/\\]/).pop()?.replace(/[^\w.\- ]+/g, "").trim() ?? "";
  const limited = base.slice(0, 180);
  if (limited) return limited;
  if (mimeType === "image/png") return "intake-image.png";
  if (mimeType === "image/webp") return "intake-image.webp";
  return "intake-image.jpg";
}

export async function saveBookingIntakeImage(
  db: IntakeImageDb,
  input: {
    userId: string;
    fileName: string;
    contentType: string;
    data: Buffer;
  },
) {
  assertIntakeImageUpload(input.contentType, input.data.length);
  const fileName = sanitizeIntakeImageFileName(input.fileName, input.contentType);
  const contentType = input.contentType.toLowerCase() === "image/jpg" ? "image/jpeg" : input.contentType.toLowerCase();
  const [row] = await db
    .insert(bookingIntakeImages)
    .values({
      user_id: input.userId,
      file_name: fileName,
      content_type: contentType,
      byte_size: input.data.length,
      data: input.data,
    })
    .returning({
      id: bookingIntakeImages.id,
      fileName: bookingIntakeImages.file_name,
      contentType: bookingIntakeImages.content_type,
    });

  if (!row) {
    throw createHttpError(500, "Intake image could not be saved");
  }

  return row;
}

export async function claimBookingIntakeImage(
  db: IntakeImageDb,
  input: {
    imageId: string;
    userId: string;
    bookingId: string;
  },
) {
  const [row] = await db
    .select({
      id: bookingIntakeImages.id,
      userId: bookingIntakeImages.user_id,
      bookingId: bookingIntakeImages.booking_id,
    })
    .from(bookingIntakeImages)
    .where(eq(bookingIntakeImages.id, input.imageId))
    .limit(1);

  if (!row || row.userId !== input.userId) {
    throw createHttpError(400, "Intake image could not be attached to this session.");
  }
  if (row.bookingId === input.bookingId) return;
  if (row.bookingId) {
    throw createHttpError(400, "Intake image is already attached to another session.");
  }

  const updated = await db
    .update(bookingIntakeImages)
    .set({ booking_id: input.bookingId })
    .where(and(
      eq(bookingIntakeImages.id, input.imageId),
      eq(bookingIntakeImages.user_id, input.userId),
      isNull(bookingIntakeImages.booking_id),
    ))
    .returning({ id: bookingIntakeImages.id });

  if (updated.length === 0) {
    throw createHttpError(400, "Intake image could not be attached to this session.");
  }
}

export async function readBookingIntakeImage(db: IntakeImageDb, bookingId: string) {
  const [row] = await db
    .select({
      id: bookingIntakeImages.id,
      fileName: bookingIntakeImages.file_name,
      contentType: bookingIntakeImages.content_type,
      data: bookingIntakeImages.data,
    })
    .from(bookingIntakeImages)
    .where(eq(bookingIntakeImages.booking_id, bookingId))
    .limit(1);

  return row ?? null;
}
