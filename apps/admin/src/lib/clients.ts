import type { OrderStatus } from "./orders";

export type ClientSort = "newest" | "highest_spend" | "most_orders";

export interface AdminClientOrderSummary {
  id: string;
  orderNumber: string;
  amount: number;
  status: OrderStatus;
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

export interface AdminClientsResponse {
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
    sort: ClientSort;
  };
}

export interface ClientOption {
  id: string;
  full_birth_name: string;
  email: string;
}

export function toClientOption(client: Pick<AdminClientSummary, "id" | "email" | "name">): ClientOption {
  return {
    id: client.id,
    full_birth_name: client.name?.trim() || client.email,
    email: client.email,
  };
}
