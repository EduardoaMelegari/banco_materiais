import { z } from "zod";

export const createMaterialSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres.").max(120),
  price: z.coerce.number().positive("Preço deve ser maior que zero."),
  marginPercent: z.coerce
    .number()
    .min(0, "Margem não pode ser negativa.")
    .max(1000, "Margem máxima permitida é 1000%."),
  type: z.enum(["MATERIAL", "SERVICO"]),
  segment: z
    .string()
    .trim()
    .min(2, "Segmento deve ter pelo menos 2 caracteres.")
    .max(60, "Segmento deve ter no máximo 60 caracteres.")
    .transform((value) => value.toUpperCase()),
});

export const updateMaterialSchema = createMaterialSchema;
