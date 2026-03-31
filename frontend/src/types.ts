export type Material = {
  id: number;
  name: string;
  price: number;
  marginPercent: number;
  type: "MATERIAL" | "SERVICO";
  segment: string;
  createdAt: string;
  updatedAt: string;
};

export type BudgetStatus = "DRAFT" | "APPROVED" | "REJECTED";

export type BudgetItem = {
  id: number;
  materialId: number;
  quantity: number;
  marginPercentSnapshot: number;
  unitPriceSnapshot: number;
  subtotal: number;
  material: Material;
};

export type BudgetCustomService = {
  id: number;
  description: string;
  quantity: number;
  baseUnitPrice: number;
  marginPercentSnapshot: number;
  unitPriceSnapshot: number;
  subtotal: number;
};

export type Budget = {
  id: number;
  customer: string | null;
  status: BudgetStatus;
  total: number;
  customLaborDescription: string | null;
  customLaborAmount: number;
  customLaborMarginPercent: number;
  createdAt: string;
  updatedAt: string;
  items: BudgetItem[];
  customServices: BudgetCustomService[];
};

export type CreateBudgetPayload = {
  customer?: string;
  status?: BudgetStatus;
  items: Array<{
    materialId: number;
    quantity: number;
    marginPercent?: number;
  }>;
  customServices?: Array<{
    description: string;
    quantity: number;
    baseUnitPrice: number;
    marginPercent: number;
  }>;
};
