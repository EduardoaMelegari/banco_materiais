import { type Budget, type BudgetCustomService, type BudgetItem, type Material, type Prisma } from "@prisma/client";
import { roundToCents, toNumber } from "./money.js";

type BudgetWithItemsAndMaterial = Budget & {
  items: Array<
    BudgetItem & {
      material: Material;
    }
  >;
  customServices: BudgetCustomService[];
};

export function serializeMaterial(material: Material) {
  return {
    id: material.id,
    name: material.name,
    price: toNumber(material.price),
    marginPercent: toNumber(material.marginPercent),
    type: material.type,
    segment: material.segment,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

export function serializeBudget(budget: BudgetWithItemsAndMaterial) {
  const customServices = budget.customServices.map((service) => ({
    id: service.id,
    description: service.description,
    quantity: toNumber(service.quantity),
    baseUnitPrice: toNumber(service.baseUnitPrice),
    marginPercentSnapshot: toNumber(service.marginPercentSnapshot),
    unitPriceSnapshot: toNumber(service.unitPriceSnapshot),
    subtotal: toNumber(service.subtotal),
  }));

  if (customServices.length === 0 && toNumber(budget.customLaborAmount) > 0) {
    const baseUnitPrice = toNumber(budget.customLaborAmount);
    const marginPercentSnapshot = toNumber(budget.customLaborMarginPercent);
    const unitPriceSnapshot = roundToCents(baseUnitPrice * (1 + marginPercentSnapshot / 100));
    customServices.push({
      id: 0,
      description: budget.customLaborDescription || "Mão de obra personalizada",
      quantity: 1,
      baseUnitPrice,
      marginPercentSnapshot,
      unitPriceSnapshot,
      subtotal: unitPriceSnapshot,
    });
  }

  return {
    id: budget.id,
    customer: budget.customer,
    status: budget.status,
    total: toNumber(budget.total),
    customLaborDescription: budget.customLaborDescription,
    customLaborAmount: toNumber(budget.customLaborAmount),
    customLaborMarginPercent: toNumber(budget.customLaborMarginPercent),
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
    customServices,
    items: budget.items.map((item) => ({
      id: item.id,
      materialId: item.materialId,
      quantity: toNumber(item.quantity),
      marginPercentSnapshot: toNumber(item.marginPercentSnapshot),
      unitPriceSnapshot: toNumber(item.unitPriceSnapshot),
      subtotal: toNumber(item.subtotal),
      material: serializeMaterial(item.material),
    })),
  };
}

export const budgetInclude = {
  items: {
    include: {
      material: true,
    },
  },
  customServices: {
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.BudgetInclude;
