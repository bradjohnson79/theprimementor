import { sendResendEmail } from "../notifications/providers/resendProvider.js";
import { logger } from "@wisdom/utils";

function wrapEmail(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#0a0b1a;padding:20px 28px;">
                <span style="color:#d9f4ff;font-size:18px;font-weight:bold;letter-spacing:0.02em;">The Prime Mentor</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#1f2430;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;color:#9aa0ab;font-size:12px;border-top:1px solid #eee;">
                The Prime Mentor · This is a transactional email about a recent order.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendGuestOrderAccessEmail(input: {
  to: string;
  firstName?: string | null;
  orderPageUrl: string;
  summaryLines: string[];
  isResend?: boolean;
}): Promise<void> {
  const greetingName = input.firstName?.trim() ? `, ${input.firstName.trim()}` : "";
  const heading = input.isResend ? "Here are your access links again" : "Thank you for your order";
  const html = wrapEmail(`
    <p style="font-size:18px;font-weight:bold;margin:0 0 12px;">${heading}${greetingName}</p>
    <p style="margin:0 0 16px;">No account needed — we've put everything together on one page for you:</p>
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${input.summaryLines.map((line) => `<li style="margin-bottom:6px;">${line}</li>`).join("")}
    </ul>
    <p style="margin:0 0 20px;">
      <a href="${input.orderPageUrl}" style="display:inline-block;background:#0a0b1a;color:#5fe3ff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold;">
        View your order
      </a>
    </p>
    <p style="margin:0 0 8px;color:#555;font-size:13px;">This link is personal to you — please don't share it. It will expire after a while; you can always request a fresh one from the order page or by replying to this email.</p>
    <p style="margin:16px 0 0;">Want a free account so everything is saved in one place next time? You can create one any time from the link on your order page using this same email address.</p>
  `);

  const result = await sendResendEmail({
    to: [input.to],
    subject: input.isResend ? "Your Prime Mentor order links" : "Your Prime Mentor order confirmation",
    html,
  });

  if (!result.success) {
    logger.error("guest_order_access_email_failed", { to: input.to, error: result.error });
  }
}

/**
 * Always-same-response resend flow (rule: never confirm/deny whether an email has orders).
 * Caller decides whether there's anything to send; this just performs the send when there is.
 */
export async function sendGuestResendLinksEmail(input: {
  to: string;
  orderPageUrls: Array<{ url: string; label: string }>;
}): Promise<void> {
  const html = wrapEmail(`
    <p style="font-size:18px;font-weight:bold;margin:0 0 12px;">Your order links</p>
    <p style="margin:0 0 16px;">Here's quick access to everything on file for this email address:</p>
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${input.orderPageUrls.map((o) => `<li style="margin-bottom:6px;"><a href="${o.url}" style="color:#0a66ff;">${o.label}</a></li>`).join("")}
    </ul>
    <p style="margin:0;color:#555;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
  `);

  const result = await sendResendEmail({
    to: [input.to],
    subject: "Your Prime Mentor order links",
    html,
  });

  if (!result.success) {
    logger.error("guest_resend_links_email_failed", { to: input.to, error: result.error });
  }
}

export async function sendLinkPurchaseVerificationEmail(input: {
  to: string;
  verifyUrl: string;
}): Promise<void> {
  const html = wrapEmail(`
    <p style="font-size:18px;font-weight:bold;margin:0 0 12px;">Confirm linking this purchase</p>
    <p style="margin:0 0 16px;">We found an order placed as a guest with this email address. Click below to link it to your account:</p>
    <p style="margin:0 0 20px;">
      <a href="${input.verifyUrl}" style="display:inline-block;background:#0a0b1a;color:#5fe3ff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold;">
        Link this purchase
      </a>
    </p>
    <p style="margin:0;color:#555;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `);

  const result = await sendResendEmail({
    to: [input.to],
    subject: "Confirm linking your Prime Mentor purchase",
    html,
  });

  if (!result.success) {
    logger.error("guest_link_purchase_email_failed", { to: input.to, error: result.error });
  }
}
