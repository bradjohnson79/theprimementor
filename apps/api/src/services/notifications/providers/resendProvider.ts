import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Resend } from "resend";

let cachedClient: Resend | null = null;
const DEFAULT_SENDER_NAME = "The Prime Mentor";

export interface ResendSendResult {
  success: boolean;
  messageId?: string | null;
  error?: string;
}

/**
 * Guest-checkout local testing (additive, production-safe): write each email to disk instead of
 * sending it ONLY when EMAIL_OUTBOX_DIR is explicitly set. If RESEND_API_KEY is missing and
 * EMAIL_OUTBOX_DIR is unset, behavior is unchanged from before (an explicit error is returned —
 * production must never silently swallow an email).
 */
function resolveOutboxDir(): string | null {
  const explicitDir = process.env.EMAIL_OUTBOX_DIR?.trim();
  if (explicitDir) {
    return resolve(explicitDir);
  }
  return null;
}

async function writeEmailToOutbox(input: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  from: string;
}): Promise<ResendSendResult> {
  const outboxDir = resolveOutboxDir();
  if (!outboxDir) {
    return { success: false, error: "Outbox directory could not be resolved." };
  }

  try {
    await mkdir(outboxDir, { recursive: true });
    const messageId = `outbox_${randomUUID()}`;
    const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}_${messageId}.json`;
    await writeFile(
      resolve(outboxDir, fileName),
      JSON.stringify(
        {
          messageId,
          from: input.from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text ?? null,
          sentAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
    return { success: true, messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? `Outbox write failed: ${error.message}` : "Outbox write failed.",
    };
  }
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }

  return cachedClient;
}

function resolveFromAddress() {
  const explicitFrom = process.env.EMAIL_FROM?.trim()
    || process.env.RESEND_FROM_EMAIL?.trim()
    || process.env.SMTP_FROM?.trim();
  const baseAddress = explicitFrom || "onboarding@resend.dev";

  if (baseAddress.includes("<")) {
    return baseAddress;
  }

  return `${DEFAULT_SENDER_NAME} <${baseAddress}>`;
}

export async function sendResendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<ResendSendResult> {
  try {
    const from = resolveFromAddress();
    if (!from) {
      return {
        success: false,
        error: "RESEND_FROM_EMAIL is not configured.",
      };
    }

    const outboxDir = resolveOutboxDir();
    if (outboxDir) {
      return writeEmailToOutbox({ to: input.to, subject: input.subject, html: input.html, text: input.text, from });
    }

    const client = getResendClient();
    if (!client) {
      return {
        success: false,
        error: "RESEND_API_KEY is not configured.",
      };
    }

    const response = await client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });

    const messageId = typeof response.data?.id === "string" ? response.data.id.trim() : "";
    if (response.error) {
      return {
        success: false,
        error: response.error.message || "Resend delivery failed.",
      };
    }
    if (!messageId) {
      return {
        success: false,
        error: "Resend returned no message id (uncertain send).",
      };
    }

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Resend delivery failed.",
    };
  }
}
