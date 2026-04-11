import nodemailer, { type Transporter } from "nodemailer";
import { eq } from "drizzle-orm";
import { users, type Database } from "@wisdom/db";

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
  memberEmail?: string;
  source: "public" | "member";
}

const DEFAULT_FROM_EMAIL = "no-reply@wisdomtransmissions.local";
let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const smtpUrl = process.env.SMTP_URL?.trim();
  if (smtpUrl) {
    cachedTransporter = nodemailer.createTransport(smtpUrl);
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || "");
  if (!host || !Number.isFinite(port) || port <= 0) {
    return null;
  }

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return cachedTransporter;
}

export async function resolveAdminContactEmail(db?: Database | null): Promise<string> {
  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim();
  if (configuredAdminEmail) {
    return configuredAdminEmail;
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

  return adminUser.email;
}

export async function sendContactEmail(to: string, payload: ContactPayload): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error("Contact delivery is not configured.");
  }

  const from = process.env.SMTP_FROM?.trim()
    || process.env.ADMIN_EMAIL?.trim()
    || DEFAULT_FROM_EMAIL;
  const submittedAt = new Date().toISOString();
  const safeName = payload.name.replace(/\r|\n/g, " ").trim();
  const safeEmail = payload.email.replace(/\r|\n/g, " ").trim();
  const safeMemberEmail = payload.memberEmail?.replace(/\r|\n/g, " ").trim();
  const sourceLabel = payload.source === "member" ? "Member Contact" : "Public Contact";

  await transporter.sendMail({
    from,
    to,
    replyTo: safeEmail,
    subject: `${sourceLabel}: ${safeName}`,
    text: [
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
    ].join("\n"),
  });
}
