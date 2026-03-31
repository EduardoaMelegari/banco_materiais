import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Budget, BudgetStatus, Material } from "../types";
import solturiLogo from "../assets/solturi_logo.png";

const statusLabel: Record<BudgetStatus, string> = {
  DRAFT: "Rascunho",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

const typeLabel: Record<Material["type"], string> = {
  MATERIAL: "Material",
  SERVICO: "Serviço",
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR");
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
}

function getFilenameBase(budget: Budget): string {
  const date = new Date().toISOString().slice(0, 10);
  return `orcamento_${budget.id}_${normalizeName(budget.customer || "sem_cliente")}_${date}`;
}

function formatBudgetNumber(id: number): string {
  return String(id).padStart(4, "0");
}

function getBasePriceFromSnapshot(unitPriceSnapshot: number, marginPercent: number): number {
  if (marginPercent <= 0) {
    return unitPriceSnapshot;
  }

  return Math.round((unitPriceSnapshot / (1 + marginPercent / 100) + Number.EPSILON) * 100) / 100;
}

function getRows(budget: Budget) {
  return budget.items.map((item, index) => {
    const estimatedBasePrice = getBasePriceFromSnapshot(item.unitPriceSnapshot, item.marginPercentSnapshot);

    return {
      number: index + 1,
      code: String(item.materialId).padStart(6, "0"),
      name: item.material.name,
      segment: item.material.segment,
      type: typeLabel[item.material.type],
      quantity: item.quantity,
      basePrice: estimatedBasePrice,
      margin: item.marginPercentSnapshot,
      unitPrice: item.unitPriceSnapshot,
      subtotal: item.subtotal,
    };
  });
}

export function exportBudgetToPdf(budget: Budget): void {
  const rows = getRows(budget);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.text(`Orçamento #${budget.id}`, 14, 15);

  doc.setFontSize(10);
  const detailLines = [
    `Cliente: ${budget.customer || "Sem cliente"}`,
    `Status: ${statusLabel[budget.status]}`,
    `Criado em: ${formatDate(budget.createdAt)}`,
    `Atualizado em: ${formatDate(budget.updatedAt)}`,
  ];

  let detailsY = 23;
  for (const line of detailLines) {
    doc.text(line, 14, detailsY);
    detailsY += 5;
  }

  const tableRows = rows.map((row) => [
    row.number,
    row.name,
    row.segment,
    row.type,
    row.quantity.toLocaleString("pt-BR"),
    formatMoney(row.basePrice),
    `${row.margin.toFixed(2)}%`,
    formatMoney(row.unitPrice),
    formatMoney(row.subtotal),
  ]);

  budget.customServices.forEach((service, index) => {
    tableRows.push([
      rows.length + index + 1,
      service.description,
      "SERVICO",
      "Serviço",
      service.quantity.toLocaleString("pt-BR"),
      formatMoney(service.baseUnitPrice),
      `${service.marginPercentSnapshot.toFixed(2)}%`,
      formatMoney(service.unitPriceSnapshot),
      formatMoney(service.subtotal),
    ]);
  });

  const tableStartY = detailsY + 1;

  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Item", "Pasta", "Tipo", "Qtd", "Base Est.", "Margem", "Unitário", "Subtotal"]],
    body: tableRows,
    styles: {
      fontSize: 9,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableStartY;
  doc.setFontSize(12);
  doc.text(`Total geral: ${formatMoney(budget.total)}`, 14, finalY + 10);
  doc.save(`${getFilenameBase(budget)}.pdf`);
}

export function exportBudgetToClientPdf(budget: Budget): void {
  const rows = getRows(budget);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.addImage(solturiLogo, "PNG", 13.5, 9, 42.3, 16.9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(40, 40, 40);
  doc.text(`ORÇAMENTO Nº ${formatBudgetNumber(budget.id)}`, pageWidth - 14, 18, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text("Soluções em Energia Solar", 14, 27);
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - 14, 24, { align: "right" });

  doc.setDrawColor(192, 192, 192);
  doc.roundedRect(14, 30, 86, 31, 2, 2);
  doc.roundedRect(pageWidth - 100, 30, 86, 31, 2, 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text("CLIENTE", 17, 36);
  doc.text("SERVIÇO / OBRA", pageWidth - 97, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text(budget.customer || "SEM CLIENTE", 17, 42);
  doc.text("CPF/CNPJ: 0", 17, 48);
  doc.text("Contato: -", 17, 54);

  doc.text("ORÇAMENTO INICIAL", pageWidth - 97, 42);
  doc.text("Gerado por: JHONATAN DURANTE", pageWidth - 97, 48);
  doc.text(`Atualizado em: ${formatDate(budget.updatedAt)}`, pageWidth - 97, 54);

  const tableRows = rows.map((row) => [
    row.code,
    row.name.toUpperCase(),
    "UN",
    row.quantity.toLocaleString("pt-BR"),
    formatMoney(row.unitPrice),
    formatMoney(row.subtotal),
  ]);

  budget.customServices.forEach((service) => {
    const code = service.id > 0 ? `SRV-CUS-${String(service.id).padStart(6, "0")}` : "SRV-CUS-000000";
    tableRows.push([
      code,
      service.description.toUpperCase(),
      "UN",
      service.quantity.toLocaleString("pt-BR"),
      formatMoney(service.unitPriceSnapshot),
      formatMoney(service.subtotal),
    ]);
  });

  const tableStartY = 68;

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 13.5, right: 13.5 },
    head: [["CÓD", "DESCRIÇÃO", "UN", "QTD", "UNITÁRIO", "TOTAL"]],
    body: tableRows,
    theme: "grid",
    columnStyles: {
      0: { cellWidth: 21, halign: "center" },
      1: { cellWidth: 71 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 21, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: [192, 192, 192],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableStartY;
  const totalBoxX = pageWidth - 86.5;
  const totalBoxY = finalY + 8;

  doc.setDrawColor(160, 160, 160);
  doc.rect(totalBoxX, totalBoxY, 72, 10);
  doc.rect(totalBoxX, totalBoxY + 10, 72, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text("TOTAL A PAGAR", totalBoxX + 4, totalBoxY + 6.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(formatMoney(budget.total), totalBoxX + 68, totalBoxY + 19, { align: "right" });

  let signatureY = totalBoxY + 44;
  if (signatureY > pageHeight - 22) {
    doc.addPage();
    signatureY = 245;
  }

  doc.setDrawColor(160, 160, 160);
  doc.line(14, signatureY, 86, signatureY);
  doc.line(pageWidth - 86, signatureY, pageWidth - 14, signatureY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text((budget.customer || "CLIENTE").toUpperCase(), 14, signatureY + 7);
  doc.text("SOLTURI ENERGIA SOLAR", pageWidth - 86, signatureY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text("APROVAÇÃO", 14, signatureY + 13);
  doc.text("CONTRATADA", pageWidth - 86, signatureY + 13);

  doc.save(`${getFilenameBase(budget)}_cliente.pdf`);
}
