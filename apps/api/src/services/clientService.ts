import { eq } from "drizzle-orm";
import { clients, users, type Database } from "@wisdom/db";
import { getOrdersGroupedByUser, type AdminOrder, type AdminOrderStatus } from "./ordersService.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type AdminClientsSort = "newest" | "highest_spend" | "most_orders";

export interface AdminClientsQuery {
  search?: string;
  sort?: AdminClientsSort;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface AdminClientOrderSummary {
  id: string;
  orderNumber: string;
  amount: number;
  status: AdminOrderStatus;
  createdAt: string;
}

export interface AdminClientSummary {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  orders: AdminClientOrderSummary[];
}

export interface AdminClientsResult {
  clients: AdminClientSummary[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  meta: {
    totalUsers: number;
    totalActiveClients: number;
    activeOnly: boolean;
    search: string;
    sort: AdminClientsSort;
  };
}

interface UserSummaryRow {
  id: string;
  email: string;
  createdAt: Date;
}

interface ClientNameRow {
  id: string;
  userId: string;
  fullBirthName: string;
  createdAt: Date;
}

interface AdminClientsBuildInput {
  userRows: UserSummaryRow[];
  clientRows: ClientNameRow[];
  ordersByUser: Map<string, AdminOrder[]>;
  query?: AdminClientsQuery;
}

function clampLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value ?? DEFAULT_LIMIT)));
}

function clampOffset(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value ?? 0));
}

function normalizeSearch(value: string | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeSort(value: AdminClientsSort | undefined): AdminClientsSort {
  return value === "highest_spend" || value === "most_orders" ? value : "newest";
}

function chooseLatestClientNames(rows: ClientNameRow[]) {
  const byUserId = new Map<string, ClientNameRow>();
  for (const row of rows) {
    const existing = byUserId.get(row.userId);
    if (!existing || row.createdAt > existing.createdAt) {
      byUserId.set(row.userId, row);
    }
  }
  return byUserId;
}

function resolveClientName(clientRow: ClientNameRow | undefined, orders: AdminOrder[]) {
  if (clientRow?.fullBirthName?.trim()) {
    return clientRow.fullBirthName.trim();
  }

  for (const order of orders) {
    const candidate = order.client_name?.trim();
    if (candidate && candidate.toLowerCase() !== order.email.trim().toLowerCase()) {
      return candidate;
    }
  }

  return null;
}

function summarizeOrders(orders: AdminOrder[]): AdminClientOrderSummary[] {
  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.id,
    amount: order.amount,
    status: order.status,
    createdAt: order.created_at,
  }));
}

function countsTowardSpend(status: AdminOrderStatus) {
  return status === "paid"
    || status === "processing"
    || status === "in_progress"
    || status === "completed";
}

function compareClients(left: AdminClientSummary, right: AdminClientSummary, sort: AdminClientsSort) {
  if (sort === "newest") {
    const createdDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (createdDelta !== 0) return createdDelta;
  }

  if (sort === "highest_spend") {
    const spendDelta = right.totalSpent - left.totalSpent;
    if (spendDelta !== 0) return spendDelta;
  }

  if (sort === "most_orders") {
    const orderDelta = right.totalOrders - left.totalOrders;
    if (orderDelta !== 0) return orderDelta;
  }

  const rightActivityDate = new Date(right.lastOrderAt ?? right.createdAt).getTime();
  const leftActivityDate = new Date(left.lastOrderAt ?? left.createdAt).getTime();
  if (rightActivityDate !== leftActivityDate) return rightActivityDate - leftActivityDate;

  const createdDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  if (createdDelta !== 0) return createdDelta;

  return right.email.localeCompare(left.email);
}

export async function getAdminClients(db: Database, query: AdminClientsQuery = {}): Promise<AdminClientsResult> {
  const [userRows, clientRows, ordersByUser] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.created_at,
      })
      .from(users),
    db
      .select({
        id: clients.id,
        userId: clients.user_id,
        fullBirthName: clients.full_birth_name,
        createdAt: clients.created_at,
      })
      .from(clients),
    getOrdersGroupedByUser(db),
  ]);

  return buildAdminClientsResult({
    userRows,
    clientRows,
    ordersByUser,
    query,
  });
}

export function buildAdminClientsResult(input: AdminClientsBuildInput): AdminClientsResult {
  const limit = clampLimit(input.query?.limit);
  const offset = clampOffset(input.query?.offset);
  const activeOnly = input.query?.activeOnly !== false;
  const search = normalizeSearch(input.query?.search);
  const sort = normalizeSort(input.query?.sort);
  const latestClientByUser = chooseLatestClientNames(input.clientRows);
  const totalUsers = input.userRows.length;
  const totalActiveClients = input.userRows.reduce((total, row) => total + (input.ordersByUser.get(row.id)?.length ? 1 : 0), 0);

  const filteredClients = input.userRows
    .map<AdminClientSummary>((userRow) => {
      const orders = input.ordersByUser.get(userRow.id) ?? [];
      return {
        id: userRow.id,
        email: userRow.email,
        name: resolveClientName(latestClientByUser.get(userRow.id), orders),
        createdAt: userRow.createdAt.toISOString(),
        totalOrders: orders.length,
        totalSpent: orders.reduce((sum, order) => sum + (countsTowardSpend(order.status) ? order.amount : 0), 0),
        lastOrderAt: orders[0]?.created_at ?? null,
        orders: summarizeOrders(orders),
      };
    })
    .filter((client) => !activeOnly || client.totalOrders > 0)
    .filter((client) => {
      if (!search) return true;
      return client.email.toLowerCase().includes(search)
        || client.name?.toLowerCase().includes(search) === true;
    })
    .sort((left, right) => compareClients(left, right, sort));

  const clientsPage = filteredClients.slice(offset, offset + limit);

  return {
    clients: clientsPage,
    pagination: {
      limit,
      offset,
      total: filteredClients.length,
      hasMore: offset + limit < filteredClients.length,
    },
    meta: {
      totalUsers,
      totalActiveClients,
      activeOnly,
      search,
      sort,
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
