export const EXPRESS_ADMIN_EMAIL = "bradjohnson79@gmail.com";

export type ExpressEmailKind =
  | "customer_confirmation"
  | "admin_purchase"
  | "customer_delivery"
  | "admin_reminder_morning"
  | "admin_reminder_afternoon"
  | "admin_overdue";

/** Fields the wording model is allowed to see. Birthdate and question text are not included. */
export interface ExpressEmailFields {
  customerName: string;
  serviceName: string;
  orderId: string;
  amountLabel: string;
  transcription: boolean;
  quantity?: number;
  deadlineLabel: string;
  paidAtLabel: string;
  adminUrl: string;
  mp3Url?: string;
  transcriptUrl?: string | null;
}

export function resolveAdminExpressEmail(env: Record<string, string | undefined> = process.env) {
  return env.ADMIN_EXPRESS_EMAIL?.trim() || EXPRESS_ADMIN_EMAIL;
}

export function expressAdminOrderUrl(orderId: string, adminBase = "https://admin.theprimementor.com") {
  return `${adminBase.replace(/\/$/, "")}/admin/orders?category=express&order=${encodeURIComponent(orderId)}`;
}

export function expressEmailTemplate(kind: ExpressEmailKind, fields: ExpressEmailFields) {
  const transcription = fields.transcription ? "Yes" : "No";
  if (kind === "customer_confirmation") {
    return {
      subject: "Your Prime Mentor Express Order Is Confirmed",
      text: [
        `Hello ${fields.customerName},`,
        `Your ${fields.serviceName} order ${fields.orderId} is confirmed.`,
        `Quantity: ${fields.quantity ?? 1}.`,
        `Total paid: ${fields.amountLabel}.`,
        `Transcription: ${transcription}.`,
        `Delivery deadline: ${fields.deadlineLabel} (America/Vancouver).`,
        "Your personalized MP3 will arrive by email.",
      ].join("\n"),
    };
  }
  if (kind === "admin_purchase") {
    return {
      subject: `New Prime Mentor Express Order — ${fields.serviceName}`,
      text: [
        `Customer: ${fields.customerName}`,
        `Service: ${fields.serviceName}`,
        `Order ID: ${fields.orderId}`,
        `Purchased: ${fields.paidAtLabel}`,
        `Paid: ${fields.amountLabel}`,
        `Quantity: ${fields.quantity ?? 1}`,
        `Transcription requested: ${transcription}`,
        `Delivery deadline: ${fields.deadlineLabel}`,
        `Admin: ${fields.adminUrl}`,
      ].join("\n"),
    };
  }
  if (kind === "customer_delivery") {
    const lines = [
      `Hello ${fields.customerName},`,
      `Your ${fields.serviceName} recording is ready.`,
      `MP3: ${fields.mp3Url ?? ""}`,
    ];
    if (fields.transcription && fields.transcriptUrl) lines.push(`Transcript: ${fields.transcriptUrl}`);
    lines.push("Listen when you have a quiet moment, and return to the recording if you want to sit with it again.");
    return {
      subject: "Your Prime Mentor Express Session Is Ready",
      text: lines.join("\n"),
    };
  }
  const reminderSubject = kind === "admin_reminder_morning"
    ? `Express delivery due today — ${fields.serviceName}`
    : kind === "admin_reminder_afternoon"
      ? `Final Express reminder — ${fields.serviceName}`
      : `Express order overdue — ${fields.serviceName}`;
  return {
    subject: reminderSubject,
    text: [
      `Order ${fields.orderId} for ${fields.customerName} is still open.`,
      `Service: ${fields.serviceName}`,
      `Delivery deadline: ${fields.deadlineLabel}`,
      `Admin: ${fields.adminUrl}`,
    ].join("\n"),
  };
}

export async function composeExpressEmail(
  kind: ExpressEmailKind,
  fields: ExpressEmailFields,
  model?: (kind: ExpressEmailKind, fields: ExpressEmailFields) => Promise<string>,
) {
  const template = expressEmailTemplate(kind, fields);
  if (!model) return { ...template, source: "template" as const };
  try {
    const text = (await model(kind, fields)).trim();
    if (!text) return { ...template, source: "template" as const };
    return { subject: template.subject, text, source: "model" as const };
  } catch {
    return { ...template, source: "template" as const };
  }
}
