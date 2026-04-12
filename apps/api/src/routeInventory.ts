export type ApiRouteAuth =
  | "public"
  | "bearer"
  | "member"
  | "admin"
  | "stripe-webhook"
  | "clerk-webhook";

export type ApiRouteValidation = "none" | "manual" | "service";

export interface ApiRouteManifestEntry {
  method: string;
  url: string;
  auth: ApiRouteAuth;
  validation: ApiRouteValidation;
  handlerFile: string;
  serviceRefs: string[];
}

export const API_ROUTE_MANIFEST: ApiRouteManifestEntry[] = [
  { method: "GET", url: "/health", auth: "public", validation: "none", handlerFile: "routes/health.ts", serviceRefs: [] },
  { method: "GET", url: "/health/ephemeris", auth: "public", validation: "none", handlerFile: "routes/health.ts", serviceRefs: ["services/blueprint/swissEphemerisService.ts"] },
  { method: "GET", url: "/api/health", auth: "public", validation: "none", handlerFile: "routes/health.ts", serviceRefs: [] },
  { method: "GET", url: "/api/health/ephemeris", auth: "public", validation: "none", handlerFile: "routes/health.ts", serviceRefs: ["services/blueprint/swissEphemerisService.ts"] },
  { method: "POST", url: "/api/sync-user", auth: "bearer", validation: "service", handlerFile: "routes/sync-user.ts", serviceRefs: ["services/clerkIdentityService.ts", "services/userService.ts"] },
  { method: "GET", url: "/api/me", auth: "bearer", validation: "none", handlerFile: "routes/me.ts", serviceRefs: ["services/divin8/memberAccessService.ts"] },
  { method: "GET", url: "/api/mentoring-circle/me", auth: "bearer", validation: "none", handlerFile: "routes/mentoring-circle.ts", serviceRefs: ["services/mentoringCircleService.ts"] },
  { method: "POST", url: "/api/mentoring-circle/register", auth: "bearer", validation: "manual", handlerFile: "routes/mentoring-circle.ts", serviceRefs: ["services/mentoringCircleService.ts"] },
  { method: "POST", url: "/api/member/subscriptions", auth: "bearer", validation: "service", handlerFile: "routes/memberships.ts", serviceRefs: ["services/membershipPurchaseService.ts"] },
  { method: "POST", url: "/api/member/subscriptions/:membershipId/confirm", auth: "bearer", validation: "service", handlerFile: "routes/memberships.ts", serviceRefs: ["services/membershipPurchaseService.ts"] },
  { method: "POST", url: "/api/member/reports", auth: "bearer", validation: "service", handlerFile: "routes/reports.ts", serviceRefs: ["services/reportPurchaseService.ts"] },
  { method: "GET", url: "/api/member/reports", auth: "bearer", validation: "none", handlerFile: "routes/reports.ts", serviceRefs: ["services/reportPurchaseService.ts"] },
  { method: "GET", url: "/api/member/reports/:id", auth: "bearer", validation: "service", handlerFile: "routes/reports.ts", serviceRefs: ["services/reportPurchaseService.ts"] },
  { method: "GET", url: "/api/clients", auth: "admin", validation: "manual", handlerFile: "routes/clients.ts", serviceRefs: ["services/clientService.ts"] },
  { method: "GET", url: "/api/clients/:id", auth: "admin", validation: "manual", handlerFile: "routes/clients.ts", serviceRefs: ["services/clientService.ts"] },
  { method: "GET", url: "/api/reports", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["routes/blueprints.ts"] },
  { method: "GET", url: "/api/reports/:id/docx", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["services/reportExport.ts"] },
  { method: "GET", url: "/api/reports/:id/pdf", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["services/reportExport.ts"] },
  { method: "DELETE", url: "/api/reports/:id", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["routes/blueprints.ts"] },
  { method: "POST", url: "/api/blueprints/generate", auth: "admin", validation: "service", handlerFile: "routes/blueprints.ts", serviceRefs: ["services/divin8/generateService.ts"] },
  { method: "POST", url: "/api/blueprints/:clientId/interpret", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["services/blueprint/index.ts", "services/reportFormat.ts"] },
  { method: "POST", url: "/api/blueprints/interpret/:reportId", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["services/blueprint/index.ts", "services/reportFormat.ts"] },
  { method: "GET", url: "/api/blueprints/reports/:id", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["routes/blueprints.ts"] },
  { method: "GET", url: "/api/reports/:clientId", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["routes/blueprints.ts"] },
  { method: "PATCH", url: "/api/reports/:id", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["routes/blueprints.ts"] },
  { method: "POST", url: "/api/reports/:id/regenerate", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["services/blueprint/index.ts"] },
  { method: "POST", url: "/api/reports/:id/finalize", auth: "admin", validation: "manual", handlerFile: "routes/blueprints.ts", serviceRefs: ["routes/blueprints.ts"] },
  { method: "GET", url: "/api/booking-types", auth: "bearer", validation: "none", handlerFile: "routes/bookings.ts", serviceRefs: ["services/booking/bookingTypesService.ts"] },
  { method: "POST", url: "/api/bookings", auth: "bearer", validation: "manual", handlerFile: "routes/bookings.ts", serviceRefs: ["services/booking/bookingService.ts"] },
  { method: "GET", url: "/api/bookings", auth: "bearer", validation: "none", handlerFile: "routes/bookings.ts", serviceRefs: ["services/booking/bookingService.ts"] },
  { method: "GET", url: "/api/admin/bookings", auth: "admin", validation: "manual", handlerFile: "routes/bookings.ts", serviceRefs: ["services/booking/bookingService.ts"] },
  { method: "PATCH", url: "/api/admin/bookings/:id/confirm", auth: "admin", validation: "manual", handlerFile: "routes/bookings.ts", serviceRefs: ["services/booking/bookingService.ts"] },
  { method: "DELETE", url: "/api/bookings/:id", auth: "bearer", validation: "service", handlerFile: "routes/bookings.ts", serviceRefs: ["services/booking/bookingService.ts"] },
  { method: "GET", url: "/api/payments", auth: "bearer", validation: "none", handlerFile: "routes/payments.ts", serviceRefs: ["services/payments/paymentsService.ts"] },
  { method: "GET", url: "/api/admin/payments", auth: "admin", validation: "none", handlerFile: "routes/payments.ts", serviceRefs: ["services/payments/paymentsService.ts"] },
  { method: "POST", url: "/api/payments", auth: "bearer", validation: "manual", handlerFile: "routes/payments.ts", serviceRefs: ["services/payments/paymentsService.ts"] },
  { method: "POST", url: "/api/payments/:id/confirm", auth: "bearer", validation: "manual", handlerFile: "routes/payments.ts", serviceRefs: ["services/payments/paymentsService.ts"] },
  { method: "POST", url: "/api/payments/:id/refund", auth: "bearer", validation: "service", handlerFile: "routes/payments.ts", serviceRefs: ["services/payments/paymentsService.ts"] },
  { method: "POST", url: "/api/images/upload", auth: "bearer", validation: "manual", handlerFile: "routes/images.ts", serviceRefs: ["services/physiognomyImageStorage.ts"] },
  { method: "GET", url: "/api/images/physiognomy/:imageAssetId", auth: "bearer", validation: "service", handlerFile: "routes/images.ts", serviceRefs: ["services/physiognomyImageStorage.ts"] },
  { method: "POST", url: "/api/divin8/run", auth: "member", validation: "manual", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8EngineService.ts", "services/divin8/memberAccessService.ts"] },
  { method: "GET", url: "/api/divin8/prompt", auth: "admin", validation: "none", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/promptStore.ts"] },
  { method: "POST", url: "/api/divin8/prompt", auth: "admin", validation: "manual", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/promptStore.ts"] },
  { method: "POST", url: "/api/divin8/generate", auth: "admin", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/generateService.ts"] },
  { method: "POST", url: "/api/divin8/conversations", auth: "admin", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts"] },
  { method: "GET", url: "/api/divin8/conversations", auth: "admin", validation: "none", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts"] },
  { method: "GET", url: "/api/divin8/conversations/search", auth: "admin", validation: "manual", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts"] },
  { method: "GET", url: "/api/divin8/conversations/:id", auth: "admin", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts"] },
  { method: "GET", url: "/api/divin8/conversations/:id/timeline", auth: "admin", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts"] },
  { method: "POST", url: "/api/divin8/conversations/:id/message", auth: "admin", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/chatService.ts", "services/divin8/conversationService.ts"] },
  { method: "DELETE", url: "/api/divin8/conversations/:id", auth: "admin", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts"] },
  { method: "POST", url: "/api/divin8/export", auth: "admin", validation: "manual", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts"] },
  { method: "POST", url: "/api/member/divin8/conversations", auth: "member", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts", "services/divin8/memberAccessService.ts"] },
  { method: "GET", url: "/api/member/divin8/conversations", auth: "member", validation: "none", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts", "services/divin8/memberAccessService.ts"] },
  { method: "GET", url: "/api/member/divin8/conversations/search", auth: "member", validation: "manual", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts", "services/divin8/memberAccessService.ts"] },
  { method: "GET", url: "/api/member/divin8/conversations/:id", auth: "member", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts", "services/divin8/memberAccessService.ts"] },
  { method: "GET", url: "/api/member/divin8/conversations/:id/timeline", auth: "member", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts", "services/divin8/memberAccessService.ts"] },
  { method: "POST", url: "/api/member/divin8/conversations/:id/message", auth: "member", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/chatService.ts", "services/divin8/conversationService.ts", "services/divin8/memberAccessService.ts"] },
  { method: "DELETE", url: "/api/member/divin8/conversations/:id", auth: "member", validation: "service", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts", "services/divin8/memberAccessService.ts"] },
  { method: "POST", url: "/api/member/divin8/export", auth: "member", validation: "manual", handlerFile: "routes/divin8.ts", serviceRefs: ["services/divin8/conversationService.ts", "services/divin8/memberAccessService.ts"] },
  { method: "GET", url: "/api/places/autocomplete", auth: "public", validation: "manual", handlerFile: "routes/places.ts", serviceRefs: ["routes/places.ts"] },
  { method: "GET", url: "/api/places/:placeId", auth: "public", validation: "manual", handlerFile: "routes/places.ts", serviceRefs: ["routes/places.ts"] },
  { method: "POST", url: "/api/contact", auth: "public", validation: "manual", handlerFile: "routes/contact.ts", serviceRefs: ["services/contactService.ts"] },
  { method: "POST", url: "/api/member/contact", auth: "bearer", validation: "manual", handlerFile: "routes/contact.ts", serviceRefs: ["services/contactService.ts"] },
  { method: "GET", url: "/api/test/zoom-status", auth: "admin", validation: "none", handlerFile: "routes/zoom.ts", serviceRefs: ["routes/zoom.ts"] },
  { method: "POST", url: "/api/test/zoom-meeting", auth: "admin", validation: "service", handlerFile: "routes/zoom.ts", serviceRefs: ["services/zoomService.ts"] },
  { method: "GET", url: "/api/social/facebook/latest-post", auth: "public", validation: "none", handlerFile: "routes/social.ts", serviceRefs: ["services/facebookPageService.ts"] },
  { method: "GET", url: "/api/admin/dashboard", auth: "admin", validation: "none", handlerFile: "routes/dashboard.ts", serviceRefs: ["services/dashboardService.ts"] },
  { method: "GET", url: "/api/mentor-training", auth: "bearer", validation: "none", handlerFile: "routes/mentor-training.ts", serviceRefs: ["services/mentorTrainingService.ts"] },
  { method: "POST", url: "/api/mentor-training/checkout", auth: "bearer", validation: "manual", handlerFile: "routes/mentor-training.ts", serviceRefs: ["services/mentorTrainingService.ts", "services/paymentService.ts"] },
  { method: "PATCH", url: "/api/admin/mentor-training/:orderId/status", auth: "admin", validation: "manual", handlerFile: "routes/mentor-training.ts", serviceRefs: ["services/mentorTrainingService.ts"] },
  { method: "GET", url: "/api/admin/orders", auth: "admin", validation: "manual", handlerFile: "routes/orders.ts", serviceRefs: ["services/ordersService.ts"] },
  { method: "POST", url: "/api/admin/orders/archive", auth: "admin", validation: "manual", handlerFile: "routes/orders.ts", serviceRefs: ["services/ordersService.ts"] },
  { method: "GET", url: "/api/admin/orders/:orderId", auth: "admin", validation: "service", handlerFile: "routes/orders.ts", serviceRefs: ["services/ordersService.ts"] },
  { method: "POST", url: "/api/admin/orders/:orderId/generate", auth: "admin", validation: "manual", handlerFile: "routes/orders.ts", serviceRefs: ["services/divin8ExecutionDispatcher.ts"] },
  { method: "GET", url: "/api/admin/notifications", auth: "admin", validation: "none", handlerFile: "routes/admin-notifications.ts", serviceRefs: ["services/notifications/notificationRetryService.ts", "services/notifications/notificationSettingsService.ts"] },
  { method: "POST", url: "/api/admin/notifications/test", auth: "admin", validation: "service", handlerFile: "routes/admin-notifications.ts", serviceRefs: ["services/notifications/notificationService.ts"] },
  { method: "POST", url: "/api/admin/notifications/preview", auth: "admin", validation: "service", handlerFile: "routes/admin-notifications.ts", serviceRefs: ["services/notifications/notificationPreview.ts"] },
  { method: "POST", url: "/api/admin/notifications/retry", auth: "admin", validation: "service", handlerFile: "routes/admin-notifications.ts", serviceRefs: ["services/notifications/notificationRetryService.ts"] },
  { method: "PATCH", url: "/api/admin/notifications/settings", auth: "admin", validation: "service", handlerFile: "routes/admin-notifications.ts", serviceRefs: ["services/notifications/notificationSettingsService.ts"] },
  { method: "POST", url: "/api/create-checkout-session", auth: "bearer", validation: "service", handlerFile: "routes/stripe.ts", serviceRefs: ["services/paymentService.ts"] },
  { method: "POST", url: "/api/admin/invoices", auth: "admin", validation: "service", handlerFile: "routes/stripe.ts", serviceRefs: ["services/payments/invoiceService.ts"] },
  { method: "POST", url: "/api/admin/invoices/:invoiceId/regenerate", auth: "admin", validation: "service", handlerFile: "routes/stripe.ts", serviceRefs: ["services/payments/invoiceService.ts"] },
  { method: "POST", url: "/api/stripe/webhook", auth: "stripe-webhook", validation: "service", handlerFile: "routes/stripe.ts", serviceRefs: ["services/payments/stripeWebhookService.ts"] },
  { method: "POST", url: "/api/webhook/stripe", auth: "stripe-webhook", validation: "service", handlerFile: "routes/stripe.ts", serviceRefs: ["services/payments/stripeWebhookService.ts"] },
  { method: "POST", url: "/api/webhook/clerk", auth: "clerk-webhook", validation: "service", handlerFile: "routes/clerk-webhook.ts", serviceRefs: ["services/userService.ts", "services/clerkIdentityService.ts"] },
];
