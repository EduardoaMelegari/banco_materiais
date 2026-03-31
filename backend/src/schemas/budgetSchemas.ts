import { BudgetStatus } from "@prisma/client";
import { z } from "zod";

const budgetItemSchema = z.object({
  materialId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  marginPercent: z.coerce.number().min(0, "Margem do item deve ser zero ou maior.").optional(),
});

const customServiceSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Descrição do serviço personalizado é obrigatória.")
    .max(160, "Descrição do serviço personalizado deve ter no máximo 160 caracteres."),
  quantity: z.coerce.number().positive("Quantidade do serviço personalizado deve ser maior que zero."),
  baseUnitPrice: z.coerce.number().positive("Preço base do serviço personalizado deve ser maior que zero."),
  marginPercent: z.coerce.number().min(0, "Margem do serviço personalizado deve ser zero ou maior."),
});

export const createBudgetSchema = z.object({
  customer: z
    .string()
    .trim()
    .max(120, "Nome do cliente deve ter no máximo 120 caracteres.")
    .optional()
    .or(z.literal("")),
  status: z.nativeEnum(BudgetStatus).optional(),
  items: z.array(budgetItemSchema),
  customServices: z.array(customServiceSchema).optional().default([]),
}).superRefine((payload, context) => {
  if (payload.items.length === 0 && payload.customServices.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["items"],
      message: "Inclua ao menos um item ou serviço personalizado no orçamento.",
    });
  }
});

export const updateBudgetStatusSchema = z.object({
  status: z.nativeEnum(BudgetStatus),
});
