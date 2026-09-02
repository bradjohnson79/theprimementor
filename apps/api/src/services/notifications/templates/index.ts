import type { NotificationEvent, NotificationPayload, NotificationPayloadMap } from "../events.js";
import {
  renderAdminNewBookingTemplate,
  renderAdminNewUserTemplate,
  renderAdminPaymentReceivedTemplate,
  renderAdminTestTemplate,
} from "./adminTemplates.js";
import {
  renderBookingConfirmedTemplate,
  renderBookingCreatedTemplate,
  renderMentoringCircleConfirmedTemplate,
  renderMentoringCircleReminder1hTemplate,
  renderMentoringCircleReminder24hTemplate,
  renderWebinarConfirmedTemplate,
  renderPaymentFailedTemplate,
  renderPaymentSucceededTemplate,
  renderReportGeneratedTemplate,
  renderShopDigitalFulfillmentTemplate,
} from "./userTemplates.js";

export interface NotificationTemplate {
  subject: string;
  html: string;
  templateVersion: string;
}

type TemplateResolver<TEvent extends NotificationEvent> = (payload: NotificationPayload<TEvent>) => NotificationTemplate;

const TEMPLATE_RESOLVERS: { [TEvent in NotificationEvent]: TemplateResolver<TEvent> } = {
  "payment.succeeded": renderPaymentSucceededTemplate,
  "payment.failed": renderPaymentFailedTemplate,
  "booking.created": renderBookingCreatedTemplate,
  "booking.confirmed": renderBookingConfirmedTemplate,
  "mentoring_circle.confirmed": renderMentoringCircleConfirmedTemplate,
  "mentoring_circle.reminder_24h": renderMentoringCircleReminder24hTemplate,
  "mentoring_circle.reminder_1h": renderMentoringCircleReminder1hTemplate,
  "webinar.confirmed": renderWebinarConfirmedTemplate,
  "report.generated": renderReportGeneratedTemplate,
  "shop.digital_fulfillment": renderShopDigitalFulfillmentTemplate,
  "admin.payment.received": renderAdminPaymentReceivedTemplate,
  "admin.new.booking": renderAdminNewBookingTemplate,
  "admin.new.user": renderAdminNewUserTemplate,
  "admin.test": renderAdminTestTemplate,
};

export function resolveNotificationTemplate<TEvent extends NotificationEvent>(
  event: TEvent,
  payload: NotificationPayloadMap[TEvent],
): NotificationTemplate {
  return TEMPLATE_RESOLVERS[event](payload as NotificationPayload<TEvent>);
}
