import { relations } from "drizzle-orm/relations";
import { clients, reports, users, bookings, payments, recordings } from "./schema";

export const reportsRelations = relations(reports, ({one}) => ({
	client: one(clients, {
		fields: [reports.clientId],
		references: [clients.id]
	}),
}));

export const clientsRelations = relations(clients, ({one, many}) => ({
	reports: many(reports),
	user: one(users, {
		fields: [clients.userId],
		references: [users.id]
	}),
	bookings: many(bookings),
	payments: many(payments),
}));

export const usersRelations = relations(users, ({many}) => ({
	clients: many(clients),
}));

export const bookingsRelations = relations(bookings, ({one, many}) => ({
	client: one(clients, {
		fields: [bookings.clientId],
		references: [clients.id]
	}),
	recordings: many(recordings),
}));

export const paymentsRelations = relations(payments, ({one}) => ({
	client: one(clients, {
		fields: [payments.clientId],
		references: [clients.id]
	}),
}));

export const recordingsRelations = relations(recordings, ({one}) => ({
	booking: one(bookings, {
		fields: [recordings.bookingId],
		references: [bookings.id]
	}),
}));