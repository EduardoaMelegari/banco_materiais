import type { Budget, BudgetStatus, CreateBudgetPayload, Material } from "./types";

const baseHeaders = {
  "Content-Type": "application/json",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...baseHeaders,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(errorBody.message ?? "Erro ao comunicar com o servidor.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function fetchMaterials() {
  return request<Material[]>("/api/materials");
}

export function createMaterial(payload: {
  name: string;
  price: number;
  marginPercent: number;
  type: "MATERIAL" | "SERVICO";
  segment: string;
}) {
  return request<Material>("/api/materials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMaterial(
  id: number,
  payload: {
    name: string;
    price: number;
    marginPercent: number;
    type: "MATERIAL" | "SERVICO";
    segment: string;
  },
) {
  return request<Material>(`/api/materials/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteMaterial(id: number) {
  return request<void>(`/api/materials/${id}`, {
    method: "DELETE",
  });
}

export function fetchBudgets() {
  return request<Budget[]>("/api/budgets");
}

export function createBudget(payload: CreateBudgetPayload) {
  return request<Budget>("/api/budgets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBudget(id: number, payload: CreateBudgetPayload) {
  return request<Budget>(`/api/budgets/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function updateBudgetStatus(id: number, status: BudgetStatus) {
  return request<Budget>(`/api/budgets/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteBudget(id: number) {
  return request<void>(`/api/budgets/${id}`, {
    method: "DELETE",
  });
}
