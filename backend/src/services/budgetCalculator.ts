import { roundToCents } from "../utils/money.js";

export type BudgetInputItem = {
  materialId: number;
  quantity: number;
  marginPercent?: number;
};

export type PricedMaterial = {
  id: number;
  price: number;
  marginPercent: number;
};

export type BudgetSnapshotItem = {
  materialId: number;
  quantity: number;
  marginPercentSnapshot: number;
  unitPriceSnapshot: number;
  subtotal: number;
};

export type BudgetCustomServiceInput = {
  description: string;
  quantity: number;
  baseUnitPrice: number;
  marginPercent: number;
};

export type BudgetCustomServiceSnapshotItem = {
  description: string;
  quantity: number;
  baseUnitPrice: number;
  marginPercentSnapshot: number;
  unitPriceSnapshot: number;
  subtotal: number;
};

export type BudgetSnapshot = {
  total: number;
  items: BudgetSnapshotItem[];
  customServices: BudgetCustomServiceSnapshotItem[];
};

export function buildBudgetSnapshot(
  items: BudgetInputItem[],
  materials: PricedMaterial[],
  options?: {
    customServices?: BudgetCustomServiceInput[];
  },
): BudgetSnapshot {
  const materialPriceById = new Map(materials.map((material) => [material.id, material]));

  const snapshotItems = items.map((item) => {
    if (item.quantity <= 0) {
      throw new Error(`Quantidade inválida para o material ${item.materialId}.`);
    }

    const material = materialPriceById.get(item.materialId);
    if (material === undefined) {
      throw new Error(`Material ${item.materialId} não encontrado.`);
    }

    const marginPercent = roundToCents(item.marginPercent ?? material.marginPercent);
    if (marginPercent < 0) {
      throw new Error(`Margem inválida para o material ${item.materialId}.`);
    }

    const salePrice = roundToCents(material.price * (1 + marginPercent / 100));
    const subtotal = roundToCents(item.quantity * salePrice);

    return {
      materialId: item.materialId,
      quantity: roundToCents(item.quantity),
      marginPercentSnapshot: marginPercent,
      unitPriceSnapshot: salePrice,
      subtotal,
    };
  });

  const customServices = (options?.customServices ?? []).map((service) => {
    const normalizedDescription = service.description.trim();
    if (!normalizedDescription) {
      throw new Error("Descrição de serviço personalizado inválida.");
    }

    const quantity = roundToCents(service.quantity);
    if (quantity <= 0) {
      throw new Error(`Quantidade inválida para o serviço personalizado "${normalizedDescription}".`);
    }

    const baseUnitPrice = roundToCents(service.baseUnitPrice);
    if (baseUnitPrice <= 0) {
      throw new Error(`Preço base inválido para o serviço personalizado "${normalizedDescription}".`);
    }

    const marginPercentSnapshot = roundToCents(service.marginPercent);
    if (marginPercentSnapshot < 0) {
      throw new Error(`Margem inválida para o serviço personalizado "${normalizedDescription}".`);
    }

    const unitPriceSnapshot = roundToCents(baseUnitPrice * (1 + marginPercentSnapshot / 100));
    const subtotal = roundToCents(unitPriceSnapshot * quantity);

    return {
      description: normalizedDescription,
      quantity,
      baseUnitPrice,
      marginPercentSnapshot,
      unitPriceSnapshot,
      subtotal,
    };
  });

  const itemsTotal = snapshotItems.reduce((accumulator, item) => accumulator + item.subtotal, 0);
  const customServicesTotal = customServices.reduce((accumulator, service) => accumulator + service.subtotal, 0);
  const total = roundToCents(itemsTotal + customServicesTotal);

  return {
    total,
    items: snapshotItems,
    customServices,
  };
}
