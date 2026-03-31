import { describe, expect, it } from "vitest";
import { buildBudgetSnapshot } from "../src/services/budgetCalculator.js";

describe("buildBudgetSnapshot", () => {
  it("calcula subtotais e total corretamente", () => {
    const result = buildBudgetSnapshot(
      [
        { materialId: 1, quantity: 2 },
        { materialId: 2, quantity: 1.5 },
      ],
      [
        { id: 1, price: 10, marginPercent: 10 },
        { id: 2, price: 20.5, marginPercent: 20 },
      ],
    );

    expect(result.total).toBe(58.9);
    expect(result.customServices).toEqual([]);
    expect(result.items).toEqual([
      { materialId: 1, quantity: 2, marginPercentSnapshot: 10, unitPriceSnapshot: 11, subtotal: 22 },
      { materialId: 2, quantity: 1.5, marginPercentSnapshot: 20, unitPriceSnapshot: 24.6, subtotal: 36.9 },
    ]);
  });

  it("inclui serviços personalizados individuais no total", () => {
    const result = buildBudgetSnapshot(
      [{ materialId: 1, quantity: 1 }],
      [{ id: 1, price: 100, marginPercent: 10 }],
      {
        customServices: [
          { description: "Instalação especial", quantity: 2, baseUnitPrice: 89.5, marginPercent: 12.5 },
        ],
      },
    );

    expect(result.customServices).toEqual([
      {
        description: "Instalação especial",
        quantity: 2,
        baseUnitPrice: 89.5,
        marginPercentSnapshot: 12.5,
        unitPriceSnapshot: 100.69,
        subtotal: 201.38,
      },
    ]);
    expect(result.total).toBe(311.38);
  });

  it("falha quando o material não existe", () => {
    expect(() =>
      buildBudgetSnapshot(
        [{ materialId: 99, quantity: 1 }],
        [{ id: 1, price: 10, marginPercent: 0 }],
      ),
    ).toThrow("Material 99 não encontrado.");
  });

  it("falha com quantidade inválida", () => {
    expect(() =>
      buildBudgetSnapshot(
        [{ materialId: 1, quantity: 0 }],
        [{ id: 1, price: 10, marginPercent: 0 }],
      ),
    ).toThrow("Quantidade inválida para o material 1.");
  });

  it("permite margem personalizada por item", () => {
    const result = buildBudgetSnapshot(
      [{ materialId: 1, quantity: 1, marginPercent: 35 }],
      [{ id: 1, price: 100, marginPercent: 10 }],
    );

    expect(result.total).toBe(135);
    expect(result.items[0]).toEqual({
      materialId: 1,
      quantity: 1,
      marginPercentSnapshot: 35,
      unitPriceSnapshot: 135,
      subtotal: 135,
    });
  });

  it("falha com quantidade inválida de serviço personalizado", () => {
    expect(() =>
      buildBudgetSnapshot(
        [{ materialId: 1, quantity: 1 }],
        [{ id: 1, price: 10, marginPercent: 0 }],
        {
          customServices: [{ description: "Serviço X", quantity: 0, baseUnitPrice: 10, marginPercent: 5 }],
        },
      ),
    ).toThrow('Quantidade inválida para o serviço personalizado "Serviço X".');
  });

  it("falha com preço base inválido de serviço personalizado", () => {
    expect(() =>
      buildBudgetSnapshot(
        [{ materialId: 1, quantity: 1 }],
        [{ id: 1, price: 10, marginPercent: 0 }],
        {
          customServices: [{ description: "Serviço Y", quantity: 1, baseUnitPrice: -1, marginPercent: 5 }],
        },
      ),
    ).toThrow('Preço base inválido para o serviço personalizado "Serviço Y".');
  });

  it("falha com margem negativa de serviço personalizado", () => {
    expect(() =>
      buildBudgetSnapshot(
        [{ materialId: 1, quantity: 1 }],
        [{ id: 1, price: 10, marginPercent: 0 }],
        {
          customServices: [{ description: "Serviço Z", quantity: 1, baseUnitPrice: 10, marginPercent: -1 }],
        },
      ),
    ).toThrow('Margem inválida para o serviço personalizado "Serviço Z".');
  });

  it("falha com margem negativa por item", () => {
    expect(() =>
      buildBudgetSnapshot(
        [{ materialId: 1, quantity: 1, marginPercent: -5 }],
        [{ id: 1, price: 10, marginPercent: 0 }],
      ),
    ).toThrow("Margem inválida para o material 1.");
  });
});
