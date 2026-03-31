import { useEffect, useMemo, useState } from "react";
import {
  createBudget,
  createMaterial,
  deleteBudget,
  deleteMaterial,
  fetchBudgets,
  fetchMaterials,
  updateBudget,
  updateBudgetStatus,
  updateMaterial,
} from "./api";
import { exportBudgetToClientPdf, exportBudgetToPdf } from "./utils/budgetExport";
import type { Budget, BudgetStatus, CreateBudgetPayload, Material } from "./types";

type TabKey = "materials" | "budgets";
const CUSTOM_SERVICE_OPTION = "__CUSTOM_SERVICE__";

type DraftBudgetItem = {
  materialId: string;
  quantity: string;
  marginPercent: string;
  customServiceDescription: string;
  customServiceBaseAmount: string;
};

const statusLabel: Record<BudgetStatus, string> = {
  DRAFT: "Rascunho",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

const typeLabel: Record<Material["type"], string> = {
  MATERIAL: "Material",
  SERVICO: "Serviço",
};

const defaultSegments = ["CABO", "DISJUNTOR", "CONECTOR", "ILUMINACAO", "SERVICO", "OUTROS"];

function toMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parseDecimal(value: string): number {
  return Number(value.replace(",", "."));
}

function getSalePrice(material: Material): number {
  return Math.round((material.price * (1 + material.marginPercent / 100) + Number.EPSILON) * 100) / 100;
}

function getCustomLaborSalePrice(baseAmount: number, marginPercent: number): number {
  return Math.round((baseAmount * (1 + marginPercent / 100) + Number.EPSILON) * 100) / 100;
}

function resolveDraftMarginPercent(item: DraftBudgetItem, material?: Material): number {
  const rawMargin = item.marginPercent.trim();
  if (!rawMargin) {
    return material?.marginPercent ?? 0;
  }

  const parsedMargin = parseDecimal(rawMargin);
  return Number.isNaN(parsedMargin) ? Number.NaN : parsedMargin;
}

function createEmptyDraftItem(): DraftBudgetItem {
  return {
    materialId: "",
    quantity: "1",
    marginPercent: "",
    customServiceDescription: "",
    customServiceBaseAmount: "",
  };
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("materials");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [materialName, setMaterialName] = useState("");
  const [materialPrice, setMaterialPrice] = useState("");
  const [materialMargin, setMaterialMargin] = useState("0");
  const [materialType, setMaterialType] = useState<Material["type"]>("MATERIAL");
  const [materialSegment, setMaterialSegment] = useState("CABO");
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);

  const [customer, setCustomer] = useState("");
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus>("DRAFT");
  const [draftItems, setDraftItems] = useState<DraftBudgetItem[]>([createEmptyDraftItem()]);
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [materialsResponse, budgetsResponse] = await Promise.all([fetchMaterials(), fetchBudgets()]);
      setMaterials(materialsResponse);
      setBudgets(budgetsResponse);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const budgetPreview = useMemo(() => {
    const materialItemsPayload: Array<{ materialId: number; quantity: number; marginPercent: number }> = [];
    const materialItemsPreview: Array<{
      materialId: number;
      materialName: string;
      materialSegment: string;
      quantity: number;
      marginPercent: number;
      unitPrice: number;
      subtotal: number;
    }> = [];
    const customServiceItemsPreview: Array<{
      description: string;
      quantity: number;
      baseUnitPrice: number;
      baseTotal: number;
      marginPercent: number;
      unitPrice: number;
      subtotal: number;
    }> = [];

    for (const item of draftItems) {
      const quantity = parseDecimal(item.quantity);

      if (Number.isNaN(quantity) || quantity <= 0) {
        continue;
      }

      const normalizedQuantity = Math.round((quantity + Number.EPSILON) * 100) / 100;

      if (item.materialId === CUSTOM_SERVICE_OPTION) {
        const marginPercent = resolveDraftMarginPercent(item);
        const baseUnitPrice = parseDecimal(item.customServiceBaseAmount);
        const description = item.customServiceDescription.trim();

        if (
          Number.isNaN(baseUnitPrice) ||
          baseUnitPrice <= 0 ||
          !description ||
          Number.isNaN(marginPercent) ||
          marginPercent < 0
        ) {
          continue;
        }

        const normalizedMarginPercent = Math.round((marginPercent + Number.EPSILON) * 100) / 100;
        const normalizedBaseUnitPrice = Math.round((baseUnitPrice + Number.EPSILON) * 100) / 100;
        const baseTotal = Math.round((normalizedBaseUnitPrice * normalizedQuantity + Number.EPSILON) * 100) / 100;
        const unitPrice = getCustomLaborSalePrice(normalizedBaseUnitPrice, normalizedMarginPercent);
        const subtotal = Math.round((unitPrice * normalizedQuantity + Number.EPSILON) * 100) / 100;

        customServiceItemsPreview.push({
          description,
          quantity: normalizedQuantity,
          baseUnitPrice: normalizedBaseUnitPrice,
          baseTotal,
          marginPercent: normalizedMarginPercent,
          unitPrice,
          subtotal,
        });

        continue;
      }

      const materialId = Number(item.materialId);
      const material = materials.find((entry) => entry.id === materialId);
      if (!material) {
        continue;
      }

      const marginPercent = resolveDraftMarginPercent(item, material);
      if (Number.isNaN(marginPercent) || marginPercent < 0) {
        continue;
      }

      const normalizedMarginPercent = Math.round((marginPercent + Number.EPSILON) * 100) / 100;
      const unitPrice = getCustomLaborSalePrice(material.price, normalizedMarginPercent);
      const subtotal = Math.round((normalizedQuantity * unitPrice + Number.EPSILON) * 100) / 100;

      materialItemsPayload.push({
        materialId,
        quantity: normalizedQuantity,
        marginPercent: normalizedMarginPercent,
      });

      materialItemsPreview.push({
        materialId,
        materialName: material.name,
        materialSegment: material.segment,
        quantity: normalizedQuantity,
        marginPercent: normalizedMarginPercent,
        unitPrice,
        subtotal,
      });
    }

    const total = Math.round(
      (materialItemsPreview.reduce((accumulator, item) => accumulator + item.subtotal, 0) +
        customServiceItemsPreview.reduce((accumulator, item) => accumulator + item.subtotal, 0) +
        Number.EPSILON) *
        100,
    ) / 100;

    return {
      materialItemsPayload,
      materialItemsPreview,
      customServiceItemsPreview,
      total,
    };
  }, [draftItems, materials]);

  const availableSegments = useMemo(() => {
    return [...new Set([...defaultSegments, ...materials.map((item) => item.segment)])].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [materials]);

  const groupedMaterials = useMemo(() => {
    const groups = new Map<string, Material[]>();

    for (const material of materials) {
      const key = material.segment;
      const current = groups.get(key) ?? [];
      current.push(material);
      groups.set(key, current);
    }

    return [...groups.entries()]
      .map(([segment, items]) => ({
        segment,
        items: [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      }))
      .sort((a, b) => a.segment.localeCompare(b.segment, "pt-BR"));
  }, [materials]);

  const materialsBySegment = useMemo(() => {
    return availableSegments
      .map((segment) => ({
        segment,
        items: materials.filter((material) => material.segment === segment),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [availableSegments, materials]);

  async function handleSaveMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const parsedPrice = parseDecimal(materialPrice);
    const parsedMargin = parseDecimal(materialMargin);
    const normalizedSegment = materialSegment.trim().toUpperCase();
    if (
      !materialName.trim() ||
      !normalizedSegment ||
      Number.isNaN(parsedPrice) ||
      parsedPrice <= 0 ||
      Number.isNaN(parsedMargin) ||
      parsedMargin < 0
    ) {
      setErrorMessage("Informe nome, segmento, preço e margem válidos para o item.");
      return;
    }

    try {
      if (editingMaterialId) {
        await updateMaterial(editingMaterialId, {
          name: materialName.trim(),
          price: parsedPrice,
          marginPercent: parsedMargin,
          type: materialType,
          segment: normalizedSegment,
        });
      } else {
        await createMaterial({
          name: materialName.trim(),
          price: parsedPrice,
          marginPercent: parsedMargin,
          type: materialType,
          segment: normalizedSegment,
        });
      }

      setMaterialName("");
      setMaterialPrice("");
      setMaterialMargin("0");
      setMaterialType("MATERIAL");
      setMaterialSegment("CABO");
      setEditingMaterialId(null);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar o material.");
    }
  }

  function startEditMaterial(material: Material) {
    setEditingMaterialId(material.id);
    setMaterialName(material.name);
    setMaterialPrice(material.price.toFixed(2));
    setMaterialMargin(material.marginPercent.toFixed(2));
    setMaterialType(material.type);
    setMaterialSegment(material.segment);
  }

  function cancelEditMaterial() {
    setEditingMaterialId(null);
    setMaterialName("");
    setMaterialPrice("");
    setMaterialMargin("0");
    setMaterialType("MATERIAL");
    setMaterialSegment("CABO");
  }

  async function handleDeleteMaterial(id: number) {
    const shouldDelete = window.confirm("Deseja realmente excluir este material?");
    if (!shouldDelete) {
      return;
    }

    setErrorMessage(null);
    try {
      await deleteMaterial(id);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível excluir o material.");
    }
  }

  function updateDraftItem(index: number, key: keyof DraftBudgetItem, value: string) {
    setDraftItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const updated = { ...item, [key]: value };
        if (key !== "materialId") {
          return updated;
        }

        if (!value) {
          return {
            ...updated,
            marginPercent: "",
          };
        }

        if (value === CUSTOM_SERVICE_OPTION) {
          return {
            ...updated,
            marginPercent: item.marginPercent || "0",
          };
        }

        const materialId = Number(value);
        const material = materials.find((entry) => entry.id === materialId);
        if (!material) {
          return updated;
        }

        return {
          ...updated,
          marginPercent: material.marginPercent.toFixed(2),
          customServiceDescription: "",
          customServiceBaseAmount: "",
        };
      }),
    );
  }

  function addDraftItem() {
    setDraftItems((current) => [...current, createEmptyDraftItem()]);
  }

  function removeDraftItem(index: number) {
    setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleCreateBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (draftItems.every((item) => !item.materialId)) {
      setErrorMessage("Adicione ao menos um item no orçamento.");
      return;
    }

    for (const item of draftItems) {
      if (!item.materialId) {
        continue;
      }

      const quantity = parseDecimal(item.quantity);
      if (Number.isNaN(quantity) || quantity <= 0) {
        setErrorMessage("Revise quantidade e margem dos itens do orçamento.");
        return;
      }

      if (item.materialId === CUSTOM_SERVICE_OPTION) {
        const marginPercent = resolveDraftMarginPercent(item);
        const baseAmount = parseDecimal(item.customServiceBaseAmount);
        if (
          !item.customServiceDescription.trim() ||
          Number.isNaN(baseAmount) ||
          baseAmount <= 0 ||
          Number.isNaN(marginPercent) ||
          marginPercent < 0
        ) {
          setErrorMessage("Preencha descrição e preço base do serviço personalizado.");
          return;
        }
      } else {
        const material = materials.find((entry) => entry.id === Number(item.materialId));
        const marginPercent = resolveDraftMarginPercent(item, material);
        if (!material || Number.isNaN(marginPercent) || marginPercent < 0) {
          setErrorMessage("Revise quantidade e margem dos itens do orçamento.");
          return;
        }
      }
    }

    if (budgetPreview.materialItemsPayload.length === 0 && budgetPreview.customServiceItemsPreview.length === 0) {
      setErrorMessage("Adicione ao menos um item válido no orçamento.");
      return;
    }

    try {
      const payload: CreateBudgetPayload = {
        customer: customer.trim() || undefined,
        status: budgetStatus,
        items: budgetPreview.materialItemsPayload.map((item) => ({
          materialId: item.materialId,
          quantity: item.quantity,
          marginPercent: item.marginPercent,
        })),
      };

      if (budgetPreview.customServiceItemsPreview.length > 0) {
        payload.customServices = budgetPreview.customServiceItemsPreview.map((service) => ({
          description: service.description,
          quantity: service.quantity,
          baseUnitPrice: service.baseUnitPrice,
          marginPercent: service.marginPercent,
        }));
      }

      if (editingBudgetId) {
        await updateBudget(editingBudgetId, payload);
      } else {
        await createBudget(payload);
      }

      setCustomer("");
      setBudgetStatus("DRAFT");
      setDraftItems([createEmptyDraftItem()]);
      setEditingBudgetId(null);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar o orçamento.");
    }
  }

  function startEditBudget(budget: Budget) {
    setActiveTab("budgets");
    setEditingBudgetId(budget.id);
    setCustomer(budget.customer || "");
    setBudgetStatus(budget.status);
    const mappedItems: DraftBudgetItem[] = budget.items.map((item) => ({
      materialId: String(item.materialId),
      quantity: String(item.quantity),
      marginPercent: item.marginPercentSnapshot.toFixed(2),
      customServiceDescription: "",
      customServiceBaseAmount: "",
    }));

    if (budget.customServices.length > 0) {
      mappedItems.push(
        ...budget.customServices.map((service) => ({
        materialId: CUSTOM_SERVICE_OPTION,
        quantity: service.quantity.toFixed(2),
        marginPercent: service.marginPercentSnapshot.toFixed(2),
        customServiceDescription: service.description,
        customServiceBaseAmount: service.baseUnitPrice.toFixed(2),
        })),
      );
    }

    setDraftItems(mappedItems.length > 0 ? mappedItems : [createEmptyDraftItem()]);
  }

  function cancelEditBudget() {
    setEditingBudgetId(null);
    setCustomer("");
    setBudgetStatus("DRAFT");
    setDraftItems([createEmptyDraftItem()]);
  }

  async function handleDeleteBudget(id: number) {
    const shouldDelete = window.confirm("Deseja realmente excluir este orçamento?");
    if (!shouldDelete) {
      return;
    }

    setErrorMessage(null);
    try {
      await deleteBudget(id);
      if (editingBudgetId === id) {
        cancelEditBudget();
      }
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível excluir o orçamento.");
    }
  }

  async function handleStatusChange(id: number, status: BudgetStatus) {
    setErrorMessage(null);
    try {
      await updateBudgetStatus(id, status);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao atualizar status do orçamento.");
    }
  }

  function handleExportPdf(budget: Budget) {
    try {
      exportBudgetToPdf(budget);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao exportar orçamento para PDF.");
    }
  }

  function handleExportClientPdf(budget: Budget) {
    try {
      exportBudgetToClientPdf(budget);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao exportar PDF para cliente.");
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ebe1cf_0%,#f5f1e7_45%,#dde8ea_100%)] px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_30px_80px_rgba(60,80,90,0.15)] backdrop-blur">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Gestão de Obras</p>
            <h1 className="font-display text-3xl text-slate-900 sm:text-4xl">Banco de Materiais e Orçamento</h1>
          </div>
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-100">
            Itens: <strong>{materials.length}</strong> | Orçamentos: <strong>{budgets.length}</strong>
          </div>
        </header>

        <div className="mb-6 flex gap-2 rounded-2xl bg-slate-900/5 p-2">
          <button
            type="button"
            onClick={() => setActiveTab("materials")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "materials"
                ? "bg-slate-900 text-white shadow"
                : "text-slate-700 hover:bg-slate-900/10"
            }`}
          >
            Materiais
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("budgets")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "budgets" ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-900/10"
            }`}
          >
            Orçamento Prévio
          </button>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-600">
            Carregando dados...
          </div>
        ) : null}

        {!loading && activeTab === "materials" ? (
          <section className="grid gap-6 lg:grid-cols-[360px,1fr]">
            <form
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              onSubmit={(event) => void handleSaveMaterial(event)}
            >
              <h2 className="font-display mb-4 text-2xl">
                {editingMaterialId ? "Editar item" : "Novo item"}
              </h2>

              <label className="mb-2 block text-sm font-semibold text-slate-700">Nome</label>
              <input
                value={materialName}
                onChange={(event) => setMaterialName(event.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="Ex.: Cimento CP-II 50kg"
              />

              <label className="mb-2 block text-sm font-semibold text-slate-700">Preço (R$)</label>
              <input
                value={materialPrice}
                onChange={(event) => setMaterialPrice(event.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="0,00"
              />

              <label className="mb-2 block text-sm font-semibold text-slate-700">Margem (%)</label>
              <input
                value={materialMargin}
                onChange={(event) => setMaterialMargin(event.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                placeholder="0"
              />

              <label className="mb-2 block text-sm font-semibold text-slate-700">Tipo</label>
              <select
                value={materialType}
                onChange={(event) => setMaterialType(event.target.value as Material["type"])}
                className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                <option value="MATERIAL">Material</option>
                <option value="SERVICO">Serviço</option>
              </select>

              <label className="mb-2 block text-sm font-semibold text-slate-700">Pasta / Segmento</label>
              <select
                value={materialSegment}
                onChange={(event) => setMaterialSegment(event.target.value)}
                className="mb-5 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
              >
                {availableSegments.map((segment) => (
                  <option key={segment} value={segment}>
                    {segment}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  {editingMaterialId ? "Salvar edição" : "Cadastrar"}
                </button>
                {editingMaterialId ? (
                  <button
                    type="button"
                    onClick={cancelEditMaterial}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display mb-4 text-2xl">Itens cadastrados</h2>
              {materials.length === 0 ? (
                <p className="text-sm text-slate-600">Nenhum item cadastrado ainda.</p>
              ) : (
                <div className="space-y-4">
                  {groupedMaterials.map((group) => (
                    <div key={group.segment} className="rounded-xl border border-slate-200 p-3">
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        Pasta: {group.segment}
                      </p>
                      <div className="space-y-3">
                        {group.items.map((material) => (
                          <article
                            key={material.id}
                            className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">{material.name}</p>
                              <p className="text-sm text-slate-600">
                                {typeLabel[material.type]} | Custo: {toMoney(material.price)} | Margem:{" "}
                                {material.marginPercent.toFixed(2)}% | Venda: {toMoney(getSalePrice(material))}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEditMaterial(material)}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteMaterial(material.id)}
                                className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                              >
                                Excluir
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {!loading && activeTab === "budgets" ? (
          <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <form
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              onSubmit={(event) => void handleCreateBudget(event)}
            >
              <h2 className="font-display mb-4 text-2xl">
                {editingBudgetId ? `Editar orçamento #${editingBudgetId}` : "Montar orçamento"}
              </h2>

              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cliente (opcional)</label>
                  <input
                    value={customer}
                    onChange={(event) => setCustomer(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status inicial</label>
                  <select
                    value={budgetStatus}
                    onChange={(event) => setBudgetStatus(event.target.value as BudgetStatus)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-900"
                  >
                    {Object.entries(statusLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4 space-y-3">
                {draftItems.map((item, index) => (
                  <div key={`draft-item-${index}`} className="rounded-xl border border-slate-200 p-3">
                    <div className="grid gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-6">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Material / Serviço
                        </label>
                        <select
                          value={item.materialId}
                          onChange={(event) => updateDraftItem(index, "materialId", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="">Selecione</option>
                          {materialsBySegment.map((group) => (
                            <optgroup key={group.segment} label={group.segment}>
                              {group.items.map((material) => (
                                <option key={material.id} value={material.id}>
                                  {material.name} - {typeLabel[material.type]} ({toMoney(getSalePrice(material))})
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          <optgroup label="PERSONALIZADO">
                            <option value={CUSTOM_SERVICE_OPTION}>Serviço personalizado</option>
                          </optgroup>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Quantidade
                        </label>
                        <input
                          value={item.quantity}
                          onChange={(event) => updateDraftItem(index, "quantity", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="1"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Margem (%)
                        </label>
                        <input
                          value={item.marginPercent}
                          onChange={(event) => updateDraftItem(index, "marginPercent", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Puxa do cadastro"
                        />
                      </div>
                      <div className="flex items-end sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => removeDraftItem(index)}
                          disabled={draftItems.length === 1}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Remover
                        </button>
                      </div>
                    </div>

                    {item.materialId === CUSTOM_SERVICE_OPTION ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Descrição do serviço
                          </label>
                          <input
                            value={item.customServiceDescription}
                            onChange={(event) =>
                              updateDraftItem(index, "customServiceDescription", event.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="Ex.: Instalação especial"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Preço base unitário (R$)
                          </label>
                          <input
                            value={item.customServiceBaseAmount}
                            onChange={(event) =>
                              updateDraftItem(index, "customServiceBaseAmount", event.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            placeholder="0,00"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addDraftItem}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  + Adicionar item
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  {editingBudgetId ? "Salvar alterações" : "Salvar orçamento"}
                </button>
                {editingBudgetId ? (
                  <button
                    type="button"
                    onClick={cancelEditBudget}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancelar edição
                  </button>
                ) : null}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="mb-2 text-sm font-semibold text-amber-900">Prévia do orçamento</p>
                {budgetPreview.materialItemsPreview.length === 0 &&
                budgetPreview.customServiceItemsPreview.length === 0 ? (
                  <p className="text-sm text-amber-800">Preencha materiais e quantidades para calcular o total.</p>
                ) : (
                  <div className="space-y-1 text-sm text-amber-900">
                    {budgetPreview.materialItemsPreview.map((item, index) => (
                      <p key={`${item.materialId}-${index}`}>
                        [{item.materialSegment}] {item.materialName} | Margem: {item.marginPercent.toFixed(2)}% |{" "}
                        {item.quantity} x {toMoney(item.unitPrice)} ={" "}
                        <strong>{toMoney(item.subtotal)}</strong>
                      </p>
                    ))}
                    {budgetPreview.customServiceItemsPreview.map((item, index) => (
                      <p key={`custom-service-${index}`}>
                        [SERVICO] {item.description} | Base unit.: {toMoney(item.baseUnitPrice)} | Margem:{" "}
                        {item.marginPercent.toFixed(2)}% | {item.quantity} x {toMoney(item.unitPrice)} ={" "}
                        <strong>{toMoney(item.subtotal)}</strong>
                      </p>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-base font-bold text-amber-950">Total: {toMoney(budgetPreview.total)}</p>
              </div>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display mb-4 text-2xl">Histórico de orçamentos</h2>

              {budgets.length === 0 ? (
                <p className="text-sm text-slate-600">Nenhum orçamento criado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {budgets.map((budget) => (
                    <article key={budget.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">
                            Orçamento #{budget.id} | {budget.customer || "Sem cliente"}
                          </p>
                          <p className="text-sm text-slate-600">
                            {new Date(budget.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-600">Status:</span>
                          <select
                            value={budget.status}
                            onChange={(event) =>
                              void handleStatusChange(budget.id, event.target.value as BudgetStatus)
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          >
                            {Object.entries(statusLabel).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => startEditBudget(budget)}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteBudget(budget.id)}
                            className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportPdf(budget)}
                            className="rounded-lg border border-indigo-300 px-2 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                          >
                            PDF completo
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportClientPdf(budget)}
                            className="rounded-lg border border-teal-300 px-2 py-1 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                          >
                            PDF cliente
                          </button>
                        </div>
                      </div>
                      <div className="mb-2 space-y-1 text-sm text-slate-700">
                        {budget.items.map((item) => (
                          <p key={item.id}>
                            [{item.material.segment}] {item.material.name} ({typeLabel[item.material.type]}) |{" "}
                            {item.quantity} x {toMoney(item.unitPriceSnapshot)} | Margem:{" "}
                            {item.marginPercentSnapshot.toFixed(2)}% ={" "}
                            <strong>{toMoney(item.subtotal)}</strong>
                          </p>
                        ))}
                        {budget.customServices.map((service) => (
                          <p key={`custom-service-${budget.id}-${service.id}`}>
                            [SERVICO] {service.description} | Base unit.: {toMoney(service.baseUnitPrice)} | Margem:{" "}
                            {service.marginPercentSnapshot.toFixed(2)}% | {service.quantity} x{" "}
                            {toMoney(service.unitPriceSnapshot)} = <strong>{toMoney(service.subtotal)}</strong>
                          </p>
                        ))}
                      </div>
                      <p className="text-right text-base font-bold text-slate-900">Total: {toMoney(budget.total)}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
