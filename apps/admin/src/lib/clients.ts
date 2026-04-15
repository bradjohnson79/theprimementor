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
  clientId: string | null;
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
  clientId: string | null;
  full_birth_name: string;
  email: string;
  label: string;
  value: string;
}

export function toClientOption(client: Pick<AdminClientSummary, "id" | "clientId" | "email" | "name">): ClientOption {
  const fullBirthName = client.name?.trim() || client.email;
  const authoritativeClientId = client.clientId?.trim() || "";
  return {
    id: authoritativeClientId || client.id,
    clientId: authoritativeClientId || null,
    full_birth_name: fullBirthName,
    email: client.email,
    label: `${fullBirthName} (${client.email})`,
    value: authoritativeClientId || client.email,
  };
}
