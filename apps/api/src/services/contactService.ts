import { eq } from "drizzle-orm";
import { users, type Database } from "@wisdom/db";
import { sendResendEmail } from "./notifications/providers/resendProvider.js";

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
  memberEmail?: string;
  source: "public" | "member";
}

function normalizeEmailList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function resolveAdminContactEmail(db?: Database | null): Promise<string> {
  const recipients = await resolveAdminNotificationEmails(db);
  const [primary] = recipients;
  if (!primary) {
    throw new Error("Admin contact email is not configured.");
  }
  return primary;
}

export async function resolveAdminNotificationEmails(db?: Database | null): Promise<string[]> {
  const configuredAdminEmails = normalizeEmailList(process.env.ADMIN_NOTIFICATION_EMAILS?.trim() ?? "");
  if (configuredAdminEmails.length > 0) {
    return configuredAdminEmails;
  }

  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim();
  if (configuredAdminEmail) {
    return [configuredAdminEmail.toLowerCase()];
  }

  if (!db) {
    throw new Error("Admin contact email is not configured.");
  }

  const [adminUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (!adminUser?.email) {
    throw new Error("Admin contact email is not configured.");
  }

  return [adminUser.email.toLowerCase()];
}

export async function sendContactEmail(to: string, payload: ContactPayload): Promise<void> {
  const submittedAt = new Date().toISOString();
  const safeName = payload.name.replace(/\r|\n/g, " ").trim();
  const safeEmail = payload.email.replace(/\r|\n/g, " ").trim();
  const safeMemberEmail = payload.memberEmail?.replace(/\r|\n/g, " ").trim();
  const sourceLabel = payload.source === "member" ? "Member Contact" : "Public Contact";
  const text = [
    `New ${payload.source} contact submission`,
    "",
    `Source: ${payload.source}`,
    `Name: ${safeName}`,
    `Email: ${safeEmail}`,
    `Authenticated account: ${safeMemberEmail || "Unavailable"}`,
    `Submitted at: ${submittedAt}`,
    "",
    "Message:",
    payload.message,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
      <h1 style="font-size:24px;margin-bottom:16px;">${escapeHtml(sourceLabel)}</h1>
      <p><strong>Source:</strong> ${escapeHtml(payload.source)}</p>
      <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
      <p><strong>Authenticated account:</strong> ${escapeHtml(safeMemberEmail || "Unavailable")}</p>
      <p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>
      <h2 style="font-size:18px;margin:24px 0 8px;">Message</h2>
      <p style="white-space:pre-wrap;">${escapeHtml(payload.message)}</p>
    </div>
  `;

  const sendResult = await sendResendEmail({
    to: [to],
    replyTo: safeEmail,
    subject: `${sourceLabel}: ${safeName}`,
    text,
    html,
  });

  if (!sendResult.success) {
    throw new Error(sendResult.error ?? "Contact delivery failed.");
  }
}
