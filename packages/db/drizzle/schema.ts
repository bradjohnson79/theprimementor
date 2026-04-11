import { pgTable, foreignKey, uuid, jsonb, timestamp, text, integer, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const reports = pgTable("reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientId: uuid("client_id"),
	blueprintData: jsonb("blueprint_data"),
	generatedReport: jsonb("generated_report"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	status: text().default('draft').notNull(),
	adminNotes: text("admin_notes"),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "reports_client_id_clients_id_fk"
		}),
]);

export const clients = pgTable("clients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	fullBirthName: text("full_birth_name").notNull(),
	birthDate: text("birth_date"),
	birthTime: text("birth_time"),
	birthLocation: text("birth_location"),
	goals: text(),
	challenges: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "clients_user_id_users_id_fk"
		}),
]);

export const bookings = pgTable("bookings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientId: uuid("client_id").notNull(),
	type: text().notNull(),
	date: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	status: text().default('pending').notNull(),
	duration: integer(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "bookings_client_id_clients_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clerkId: text("clerk_id").notNull(),
	email: text().notNull(),
	role: text().default('client').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_clerk_id_unique").on(table.clerkId),
]);

export const payments = pgTable("payments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientId: uuid("client_id").notNull(),
	stripePaymentId: text("stripe_payment_id"),
	amount: integer().notNull(),
	type: text().notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "payments_client_id_clients_id_fk"
		}),
]);

export const recordings = pgTable("recordings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	bookingId: uuid("booking_id").notNull(),
	fileUrl: text("file_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.bookingId],
			foreignColumns: [bookings.id],
			name: "recordings_booking_id_bookings_id_fk"
		}),
]);
