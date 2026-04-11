import { eq, count, sql } from "drizzle-orm";
import { clients, users, type Database } from "@wisdom/db";

interface PaginationParams {
  page: number;
  limit: number;
}

export async function getAllClients(db: Database, pagination?: PaginationParams) {
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 20;
  const offset = (page - 1) * limit;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: clients.id,
        full_birth_name: clients.full_birth_name,
        email: users.email,
        birth_date: clients.birth_date,
        birth_time: clients.birth_time,
        birth_location: clients.birth_location,
        goals: clients.goals,
        challenges: clients.challenges,
        created_at: clients.created_at,
      })
      .from(clients)
      .innerJoin(users, eq(clients.user_id, users.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(clients),
  ]);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getClientById(db: Database, id: string) {
  const [row] = await db
    .select({
      id: clients.id,
      full_birth_name: clients.full_birth_name,
      email: users.email,
      birth_date: clients.birth_date,
      birth_time: clients.birth_time,
      birth_location: clients.birth_location,
      goals: clients.goals,
      challenges: clients.challenges,
      created_at: clients.created_at,
      updated_at: clients.updated_at,
    })
    .from(clients)
    .innerJoin(users, eq(clients.user_id, users.id))
    .where(eq(clients.id, id))
    .limit(1);

  return row ?? null;
}
