import { Resend } from "resend";

let cachedClient: Resend | null = null;

export interface ResendSendResult {
  success: boolean;
  messageId?: string | null;
  error?: string;
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
  if (explicitFrom) {
    return explicitFrom;
  }

  return "onboarding@resend.dev";
}

export async function sendResendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<ResendSendResult> {
  try {
    const client = getResendClient();
    if (!client) {
      return {
        success: false,
        error: "RESEND_API_KEY is not configured.",
      };
    }

    const from = resolveFromAddress();
    if (!from) {
      return {
        success: false,
        error: "RESEND_FROM_EMAIL is not configured.",
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

    const messageId = typeof response.data?.id === "string" ? response.data.id : null;
    if (response.error) {
      return {
        success: false,
        error: response.error.message || "Resend delivery failed.",
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
