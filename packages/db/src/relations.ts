import { relations } from "drizzle-orm";
import {
  users,
  memberEntitlements,
  memberUsage,
  memberUsageEvents,
  clients,
  profiles,
  bookingTypes,
  bookings,
  payments,
  stripeCustomers,
  subscriptions,
  regenerationSubscriptions,
  regenerationCheckIns,
  subscriptionAdminAuditEntries,
  subscriptionAdminNotes,
  reports,
  courseEntitlements,
  courseLessonProgress,
  webhookEvents,
  invoices,
  orders,
  mentoringCircleRegistrations,
  conversationThreads,
  conversationMessages,
  conversationTimelineEvents,
  conversationMemories,
  reportTierOutputs,
  recordings,
} from "./schema.js";

export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
  profiles: many(profiles),
  bookings: many(bookings),
  payments: many(payments),
  stripeCustomers: many(stripeCustomers),
  subscriptions: many(subscriptions),
  regenerationSubscriptions: many(regenerationSubscriptions),
  regenerationCheckIns: many(regenerationCheckIns),
  subscriptionAdminAuditEntries: many(subscriptionAdminAuditEntries),
  subscriptionAdminNotes: many(subscriptionAdminNotes),
  invoices: many(invoices),
  orders: many(orders),
  reports: many(reports),
  courseEntitlements: many(courseEntitlements),
  courseLessonProgress: many(courseLessonProgress),
  mentoringCircleRegistrations: many(mentoringCircleRegistrations),
  memberEntitlements: many(memberEntitlements),
  memberUsage: many(memberUsage),
  memberUsageEvents: many(memberUsageEvents),
}));

export const courseEntitlementsRelations = relations(courseEntitlements, ({ one }) => ({
  user: one(users, {
    fields: [courseEntitlements.user_id],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [courseEntitlements.order_id],
    references: [orders.id],
  }),
}));

export const courseLessonProgressRelations = relations(courseLessonProgress, ({ one }) => ({
  user: one(users, {
    fields: [courseLessonProgress.user_id],
    references: [users.id],
  }),
}));

export const memberEntitlementsRelations = relations(memberEntitlements, ({ one }) => ({
  user: one(users, {
    fields: [memberEntitlements.user_id],
    references: [users.id],
  }),
}));

export const memberUsageRelations = relations(memberUsage, ({ one }) => ({
  user: one(users, {
    fields: [memberUsage.user_id],
    references: [users.id],
  }),
}));

export const memberUsageEventsRelations = relations(memberUsageEvents, ({ one }) => ({
  user: one(users, {
    fields: [memberUsageEvents.user_id],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.user_id],
    references: [users.id],
  }),
  payments: many(payments),
  invoices: many(invoices),
  orders: many(orders),
  reports: many(reports),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.user_id],
    references: [users.id],
  }),
}));

export const bookingTypesRelations = relations(bookingTypes, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  user: one(users, {
    fields: [bookings.user_id],
    references: [users.id],
  }),
  bookingType: one(bookingTypes, {
    fields: [bookings.booking_type_id],
    references: [bookingTypes.id],
  }),
  payments: many(payments),
  recordings: many(recordings),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.user_id],
    references: [users.id],
  }),
  booking: one(bookings, {
    fields: [payments.booking_id],
    references: [bookings.id],
  }),
}));

export const stripeCustomersRelations = relations(stripeCustomers, ({ one }) => ({
  user: one(users, {
    fields: [stripeCustomers.user_id],
    references: [users.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.user_id],
    references: [users.id],
  }),
  adminAuditEntries: many(subscriptionAdminAuditEntries),
  adminNotes: many(subscriptionAdminNotes),
}));

export const regenerationSubscriptionsRelations = relations(regenerationSubscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [regenerationSubscriptions.user_id],
    references: [users.id],
  }),
  checkIns: many(regenerationCheckIns),
  adminAuditEntries: many(subscriptionAdminAuditEntries),
  adminNotes: many(subscriptionAdminNotes),
}));

export const regenerationCheckInsRelations = relations(regenerationCheckIns, ({ one }) => ({
  user: one(users, {
    fields: [regenerationCheckIns.user_id],
    references: [users.id],
  }),
  subscription: one(regenerationSubscriptions, {
    fields: [regenerationCheckIns.subscription_id],
    references: [regenerationSubscriptions.id],
  }),
}));

export const subscriptionAdminAuditEntriesRelations = relations(subscriptionAdminAuditEntries, ({ one }) => ({
  adminUser: one(users, {
    fields: [subscriptionAdminAuditEntries.admin_user_id],
    references: [users.id],
  }),
  membershipSubscription: one(subscriptions, {
    fields: [subscriptionAdminAuditEntries.membership_subscription_id],
    references: [subscriptions.id],
  }),
  regenerationSubscription: one(regenerationSubscriptions, {
    fields: [subscriptionAdminAuditEntries.regeneration_subscription_id],
    references: [regenerationSubscriptions.id],
  }),
}));

export const subscriptionAdminNotesRelations = relations(subscriptionAdminNotes, ({ one }) => ({
  adminUser: one(users, {
    fields: [subscriptionAdminNotes.admin_user_id],
    references: [users.id],
  }),
  membershipSubscription: one(subscriptions, {
    fields: [subscriptionAdminNotes.membership_subscription_id],
    references: [subscriptions.id],
  }),
  regenerationSubscription: one(regenerationSubscriptions, {
    fields: [subscriptionAdminNotes.regeneration_subscription_id],
    references: [regenerationSubscriptions.id],
  }),
}));

export const webhookEventsRelations = relations(webhookEvents, () => ({}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.user_id],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [invoices.client_id],
    references: [clients.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.user_id],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [orders.client_id],
    references: [clients.id],
  }),
  invoice: one(invoices, {
    fields: [orders.invoice_id],
    references: [invoices.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  client: one(clients, {
    fields: [reports.client_id],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [reports.user_id],
    references: [users.id],
  }),
  tierOutputs: many(reportTierOutputs),
}));

export const mentoringCircleRegistrationsRelations = relations(mentoringCircleRegistrations, ({ one }) => ({
  user: one(users, {
    fields: [mentoringCircleRegistrations.user_id],
    references: [users.id],
  }),
}));

export const conversationThreadsRelations = relations(conversationThreads, ({ many }) => ({
  messages: many(conversationMessages),
  timelineEvents: many(conversationTimelineEvents),
  memories: many(conversationMemories),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  thread: one(conversationThreads, {
    fields: [conversationMessages.thread_id],
    references: [conversationThreads.id],
  }),
}));

export const conversationTimelineEventsRelations = relations(conversationTimelineEvents, ({ one }) => ({
  thread: one(conversationThreads, {
    fields: [conversationTimelineEvents.thread_id],
    references: [conversationThreads.id],
  }),
}));

export const conversationMemoriesRelations = relations(conversationMemories, ({ one }) => ({
  thread: one(conversationThreads, {
    fields: [conversationMemories.conversation_id],
    references: [conversationThreads.id],
  }),
}));

export const reportTierOutputsRelations = relations(reportTierOutputs, ({ one }) => ({
  report: one(reports, {
    fields: [reportTierOutputs.report_id],
    references: [reports.id],
  }),
}));

export const recordingsRelations = relations(recordings, ({ one }) => ({
  booking: one(bookings, {
    fields: [recordings.booking_id],
    references: [bookings.id],
  }),
}));
