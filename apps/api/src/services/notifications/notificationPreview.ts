import type { NotificationPreviewRequest } from "./events.js";
import { getNotificationRecipientType } from "./events.js";
import { resolveNotificationTemplate } from "./templates/index.js";

export function previewNotification<TEvent extends NotificationPreviewRequest["event"]>(
  input: NotificationPreviewRequest<TEvent>,
) {
  const template = resolveNotificationTemplate(input.event, input.payload);
  return {
    event: input.event,
    recipientType: getNotificationRecipientType(input.event),
    subject: template.subject,
    html: template.html,
    templateVersion: template.templateVersion,
  };
}
