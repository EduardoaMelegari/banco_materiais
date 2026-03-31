import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const baseMaterials = [
    {
      name: "Cabo flexível 2,5mm 100m",
      price: 289.9,
      marginPercent: 18,
      type: "MATERIAL" as const,
      segment: "CABO",
    },
    {
      name: "Disjuntor bipolar 32A",
      price: 74.5,
      marginPercent: 22,
      type: "MATERIAL" as const,
      segment: "DISJUNTOR",
    },
    {
      name: "Conector de torção 4mm",
      price: 1.9,
      marginPercent: 35,
      type: "MATERIAL" as const,
      segment: "CONECTOR",
    },
    {
      name: "Mão de obra elétrica diária",
      price: 380.0,
      marginPercent: 20,
      type: "SERVICO" as const,
      segment: "SERVICO",
    },
  ];

  for (const material of baseMaterials) {
    await prisma.material.upsert({
      where: { name: material.name },
      update: {
        price: material.price,
        marginPercent: material.marginPercent,
        type: material.type,
        segment: material.segment,
      },
      create: material,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
