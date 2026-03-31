import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createMaterialSchema, updateMaterialSchema } from "../schemas/materialSchemas.js";
import { serializeMaterial } from "../utils/serializers.js";

const router = Router();

router.get("/", async (request, response) => {
  const search = z.string().trim().optional().parse(request.query.search);

  const materials = await prisma.material.findMany({
    where: search
      ? {
          name: {
            contains: search,
            mode: "insensitive",
          },
        }
      : undefined,
    orderBy: [{ segment: "asc" }, { name: "asc" }],
  });

  response.json(materials.map(serializeMaterial));
});

router.post("/", async (request, response) => {
  const payload = createMaterialSchema.parse(request.body);

  try {
    const material = await prisma.material.create({
      data: payload,
    });

    response.status(201).json(serializeMaterial(material));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return response.status(409).json({
        message: "Já existe um material com esse nome.",
      });
    }

    throw error;
  }
});

router.put("/:id", async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id);
  const payload = updateMaterialSchema.parse(request.body);

  const exists = await prisma.material.findUnique({ where: { id } });
  if (!exists) {
    return response.status(404).json({ message: "Material não encontrado." });
  }

  try {
    const material = await prisma.material.update({
      where: { id },
      data: payload,
    });
    response.json(serializeMaterial(material));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return response.status(409).json({
        message: "Já existe um material com esse nome.",
      });
    }

    throw error;
  }
});

router.delete("/:id", async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id);

  const material = await prisma.material.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          budgetItems: true,
        },
      },
    },
  });

  if (!material) {
    return response.status(404).json({ message: "Material não encontrado." });
  }

  if (material._count.budgetItems > 0) {
    return response.status(409).json({
      message: "Não é possível excluir material já utilizado em orçamento.",
    });
  }

  await prisma.material.delete({
    where: { id },
  });

  response.status(204).send();
});

export { router as materialRoutes };
