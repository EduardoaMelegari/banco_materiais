import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createBudgetSchema, updateBudgetStatusSchema } from "../schemas/budgetSchemas.js";
import { buildBudgetSnapshot } from "../services/budgetCalculator.js";
import { budgetInclude, serializeBudget } from "../utils/serializers.js";
import { roundToCents, toNumber } from "../utils/money.js";

const router = Router();

type NormalizedCustomService = {
  description: string;
  quantity: number;
  baseUnitPrice: number;
  marginPercent: number;
};

function normalizeCustomServices(
  customServices: Array<{
    description: string;
    quantity: number;
    baseUnitPrice: number;
    marginPercent: number;
  }> = [],
): NormalizedCustomService[] {
  return customServices.map((service) => ({
    description: service.description.trim(),
    quantity: roundToCents(service.quantity),
    baseUnitPrice: roundToCents(service.baseUnitPrice),
    marginPercent: roundToCents(service.marginPercent),
  }));
}

function summarizeCustomServices(
  customServices: Array<{
    description: string;
    quantity: number;
    baseUnitPrice: number;
    marginPercentSnapshot: number;
    subtotal: number;
  }>,
) {
  if (customServices.length === 0) {
    return {
      amount: 0,
      marginPercent: 0,
      description: null as string | null,
    };
  }

  const baseTotal = roundToCents(
    customServices.reduce((accumulator, service) => accumulator + service.baseUnitPrice * service.quantity, 0),
  );
  const saleTotal = roundToCents(
    customServices.reduce((accumulator, service) => accumulator + service.subtotal, 0),
  );
  const marginPercent = baseTotal > 0 ? roundToCents(((saleTotal / baseTotal) - 1) * 100) : 0;
  const description = customServices
    .map((service) =>
      service.quantity === 1
        ? service.description
        : `${service.description} (x${service.quantity.toLocaleString("pt-BR")})`,
    )
    .join(" | ");

  return {
    amount: baseTotal,
    marginPercent,
    description,
  };
}

router.get("/", async (_request, response) => {
  const budgets = await prisma.budget.findMany({
    include: budgetInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  response.json(budgets.map(serializeBudget));
});

router.get("/:id", async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id);

  const budget = await prisma.budget.findUnique({
    where: { id },
    include: budgetInclude,
  });

  if (!budget) {
    return response.status(404).json({ message: "Orçamento não encontrado." });
  }

  response.json(serializeBudget(budget));
});

router.post("/", async (request, response) => {
  const payload = createBudgetSchema.parse(request.body);
  const customServices = normalizeCustomServices(payload.customServices);
  const materialIds = [...new Set(payload.items.map((item) => item.materialId))];

  const materials = await prisma.material.findMany({
    where: {
      id: { in: materialIds },
    },
  });

  if (materials.length !== materialIds.length) {
    const foundIds = new Set(materials.map((material) => material.id));
    const missingIds = materialIds.filter((id) => !foundIds.has(id));
    return response.status(400).json({
      message: `Materiais não encontrados: ${missingIds.join(", ")}`,
    });
  }

  const snapshot = buildBudgetSnapshot(
    payload.items.map((item) => ({
      materialId: item.materialId,
      quantity: item.quantity,
      marginPercent: item.marginPercent,
    })),
    materials.map((material) => ({
      id: material.id,
      price: toNumber(material.price),
      marginPercent: toNumber(material.marginPercent),
    })),
    {
      customServices,
    },
  );
  const customLaborSummary = summarizeCustomServices(snapshot.customServices);

  const budget = await prisma.$transaction(async (transaction) => {
    const createdBudget = await transaction.budget.create({
      data: {
        customer: payload.customer?.trim() || null,
        status: payload.status ?? "DRAFT",
        total: snapshot.total,
        customLaborDescription: customLaborSummary.description,
        customLaborAmount: customLaborSummary.amount,
        customLaborMarginPercent: customLaborSummary.marginPercent,
      },
    });

    await transaction.budgetItem.createMany({
      data: snapshot.items.map((item) => ({
        budgetId: createdBudget.id,
        materialId: item.materialId,
        quantity: item.quantity,
        marginPercentSnapshot: item.marginPercentSnapshot,
        unitPriceSnapshot: item.unitPriceSnapshot,
        subtotal: item.subtotal,
      })),
    });

    if (snapshot.customServices.length > 0) {
      await transaction.budgetCustomService.createMany({
        data: snapshot.customServices.map((service) => ({
          budgetId: createdBudget.id,
          description: service.description,
          quantity: service.quantity,
          baseUnitPrice: service.baseUnitPrice,
          marginPercentSnapshot: service.marginPercentSnapshot,
          unitPriceSnapshot: service.unitPriceSnapshot,
          subtotal: service.subtotal,
        })),
      });
    }

    return transaction.budget.findUniqueOrThrow({
      where: { id: createdBudget.id },
      include: budgetInclude,
    });
  });

  response.status(201).json(serializeBudget(budget));
});

router.put("/:id", async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id);
  const payload = createBudgetSchema.parse(request.body);
  const customServices = normalizeCustomServices(payload.customServices);

  const existingBudget = await prisma.budget.findUnique({
    where: { id },
  });

  if (!existingBudget) {
    return response.status(404).json({ message: "Orçamento não encontrado." });
  }

  const materialIds = [...new Set(payload.items.map((item) => item.materialId))];
  const materials = await prisma.material.findMany({
    where: {
      id: { in: materialIds },
    },
  });

  if (materials.length !== materialIds.length) {
    const foundIds = new Set(materials.map((material) => material.id));
    const missingIds = materialIds.filter((materialId) => !foundIds.has(materialId));
    return response.status(400).json({
      message: `Materiais não encontrados: ${missingIds.join(", ")}`,
    });
  }

  const snapshot = buildBudgetSnapshot(
    payload.items.map((item) => ({
      materialId: item.materialId,
      quantity: item.quantity,
      marginPercent: item.marginPercent,
    })),
    materials.map((material) => ({
      id: material.id,
      price: toNumber(material.price),
      marginPercent: toNumber(material.marginPercent),
    })),
    {
      customServices,
    },
  );
  const customLaborSummary = summarizeCustomServices(snapshot.customServices);

  const updatedBudget = await prisma.$transaction(async (transaction) => {
    await transaction.budget.update({
      where: { id },
      data: {
        customer: payload.customer?.trim() || null,
        status: payload.status ?? existingBudget.status,
        total: snapshot.total,
        customLaborDescription: customLaborSummary.description,
        customLaborAmount: customLaborSummary.amount,
        customLaborMarginPercent: customLaborSummary.marginPercent,
      },
    });

    await transaction.budgetItem.deleteMany({
      where: { budgetId: id },
    });

    await transaction.budgetCustomService.deleteMany({
      where: { budgetId: id },
    });

    await transaction.budgetItem.createMany({
      data: snapshot.items.map((item) => ({
        budgetId: id,
        materialId: item.materialId,
        quantity: item.quantity,
        marginPercentSnapshot: item.marginPercentSnapshot,
        unitPriceSnapshot: item.unitPriceSnapshot,
        subtotal: item.subtotal,
      })),
    });

    if (snapshot.customServices.length > 0) {
      await transaction.budgetCustomService.createMany({
        data: snapshot.customServices.map((service) => ({
          budgetId: id,
          description: service.description,
          quantity: service.quantity,
          baseUnitPrice: service.baseUnitPrice,
          marginPercentSnapshot: service.marginPercentSnapshot,
          unitPriceSnapshot: service.unitPriceSnapshot,
          subtotal: service.subtotal,
        })),
      });
    }

    return transaction.budget.findUniqueOrThrow({
      where: { id },
      include: budgetInclude,
    });
  });

  response.json(serializeBudget(updatedBudget));
});

router.patch("/:id/status", async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id);
  const payload = updateBudgetStatusSchema.parse(request.body);

  const exists = await prisma.budget.findUnique({ where: { id } });
  if (!exists) {
    return response.status(404).json({ message: "Orçamento não encontrado." });
  }

  const updated = await prisma.budget.update({
    where: { id },
    data: { status: payload.status },
    include: budgetInclude,
  });

  response.json(serializeBudget(updated));
});

router.delete("/:id", async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id);

  const exists = await prisma.budget.findUnique({ where: { id } });
  if (!exists) {
    return response.status(404).json({ message: "Orçamento não encontrado." });
  }

  await prisma.budget.delete({
    where: { id },
  });

  response.status(204).send();
});

export { router as budgetRoutes };
