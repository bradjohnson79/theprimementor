export const EXPRESS_ADMIN_EMAIL = "bradjohnson79@gmail.com";

export type ExpressEmailKind =
  | "customer_confirmation"
  | "admin_purchase"
  | "customer_delivery"
  | "customer_delay"
  | "admin_delay_receipt"
  | "admin_reminder_morning"
  | "admin_reminder_afternoon"
  | "admin_overdue";

/** Fields included in Express email. Client intake is included only on the administrator purchase notice. */
export interface ExpressEmailFields {
  customerName: string;
  customerEmail: string;
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
  birthdate?: string;
  guide?: string;
  question?: string;
  focusAreas?: string;
  healingContext?: string;
  pastLifeInterest?: string;
  delayMessage?: string;
}

export function resolveAdminExpressEmail(env: Record<string, string | undefined> = process.env) {
  return env.ADMIN_EXPRESS_EMAIL?.trim() || EXPRESS_ADMIN_EMAIL;
}

export function expressAdminOrderUrl(orderId: string, adminBase = "https://admin.theprimementor.com") {
  return `${adminBase.replace(/\/$/, "")}/admin/orders?category=express&order=${encodeURIComponent(orderId)}`;
}

function provided(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Not provided";
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
      subject: `NICE! YOU JUST GOT AN EXPRESS ORDER - ${fields.serviceName}`,
      text: [
        `Service: ${fields.serviceName}`,
        `Quantity: ${fields.quantity ?? 1}`,
        `Price: ${fields.amountLabel}`,
        `Transcription: ${transcription}`,
        `Customer: ${fields.customerName}`,
        `Email: ${fields.customerEmail}`,
        `Birthdate: ${provided(fields.birthdate)}`,
        `Guide: ${provided(fields.guide)}`,
        `Question: ${provided(fields.question)}`,
        `Focus areas: ${provided(fields.focusAreas)}`,
        `Healing context: ${provided(fields.healingContext)}`,
        `Past life interest: ${provided(fields.pastLifeInterest)}`,
        `Due: ${fields.deadlineLabel}`,
        `Order: ${fields.orderId}`,
        `Purchased: ${fields.paidAtLabel}`,
        `Admin: ${fields.adminUrl}`,
      ].join("\n"),
    };
  }
  if (kind === "customer_delay") {
    return {
      subject: `Your ${fields.serviceName} Express order needs more time`,
      text: [
        `Hello ${fields.customerName},`,
        `Your ${fields.serviceName} order ${fields.orderId} needs a little more time.`,
        `New completion day: ${fields.deadlineLabel}.`,
        `Reason: ${fields.delayMessage?.trim() || "I need a little more time to complete this session."}`,
        "You do not need to place the order again. The session will still arrive by email.",
      ].join("\n"),
    };
  }
  if (kind === "admin_delay_receipt") {
    return {
      subject: `Express delay notice received - ${fields.serviceName}`,
      text: [
        `${fields.customerEmail} received the delay email.`,
        `Customer: ${fields.customerName}`,
        `Service: ${fields.serviceName}`,
        `Order: ${fields.orderId}`,
        `New completion day: ${fields.deadlineLabel}.`,
        "This receipt confirms the client’s mail service accepted the message.",
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

export async function composeExpressEmail(kind: ExpressEmailKind, fields: ExpressEmailFields) {
  const template = expressEmailTemplate(kind, fields);
  return { ...template, source: "template" as const };
}
