import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExpenseReport, IncomeReport, PLReport, ReportKind } from "./reports";

const LOGO_PATH = "/hop2it-logo.png";
const LOGO_WIDTH = 48;
const LOGO_HEIGHT = 18;
let logoDataUrl: string | null = null;

async function loadLogoDataUrl(): Promise<string> {
  if (logoDataUrl) return logoDataUrl;
  const res = await fetch(LOGO_PATH);
  if (!res.ok) throw new Error("Failed to load report logo.");
  const blob = await res.blob();
  logoDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read report logo."));
    reader.readAsDataURL(blob);
  });
  return logoDataUrl;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function periodLabel(start: string, end: string): string {
  return `${start} to ${end}`;
}

async function addHeader(doc: jsPDF, title: string, start: string, end: string) {
  const logo = await loadLogoDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.addImage(logo, "PNG", pageWidth - 14 - LOGO_WIDTH, 10, LOGO_WIDTH, LOGO_HEIGHT);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(16, 120, 80);
  doc.text("HOP2IT Property Manager", 14, 18);

  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(title, 14, 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Period: ${periodLabel(start, end)}`, 14, 36);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);
}

function savePdf(doc: jsPDF, kind: ReportKind, start: string, end: string) {
  doc.save(`hop2it-${kind}-report-${start}-to-${end}.pdf`);
}

export async function downloadIncomePdf(report: IncomeReport): Promise<void> {
  const doc = new jsPDF();
  const { startDate, endDate } = report.period;

  await addHeader(doc, "Income Report", startDate, endDate);

  autoTable(doc, {
    startY: 50,
    head: [["Date", "Property", "Tenant", "Paid", "Late Fee", "Total", "Status"]],
    body: report.lines.map((l) => [
      l.date,
      l.property_name,
      l.tenant_name,
      money(l.amount_paid),
      money(l.late_fee),
      money(l.total),
      l.status,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [251, 191, 36], textColor: [24, 24, 27] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  const summaryY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 50;

  autoTable(doc, {
    startY: summaryY + 10,
    head: [["Property", "Total Income"]],
    body: [
      ...report.byProperty.map((r) => [r.property_name, money(r.total)]),
      ["TOTAL", money(report.totalIncome)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 120, 80], textColor: [255, 255, 255] },
  });

  savePdf(doc, "income", startDate, endDate);
}

export async function downloadExpensePdf(report: ExpenseReport): Promise<void> {
  const doc = new jsPDF();
  const { startDate, endDate } = report.period;

  await addHeader(doc, "Expense Report", startDate, endDate);

  autoTable(doc, {
    startY: 50,
    head: [["Date", "Property", "Category", "Vendor", "Description", "Amount"]],
    body: report.lines.map((l) => [
      l.date,
      l.property_name,
      l.category,
      l.vendor,
      l.description,
      money(l.amount),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [251, 191, 36], textColor: [24, 24, 27] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  const summaryY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 50;

  autoTable(doc, {
    startY: summaryY + 10,
    head: [["Category", "Total"]],
    body: [
      ...report.byCategory.map((r) => [r.category, money(r.total)]),
      ["TOTAL", money(report.totalExpenses)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [180, 60, 60], textColor: [255, 255, 255] },
  });

  savePdf(doc, "expense", startDate, endDate);
}

export async function downloadPLPdf(report: PLReport): Promise<void> {
  const doc = new jsPDF();
  const { startDate, endDate } = report.period;

  await addHeader(doc, "Profit & Loss Report", startDate, endDate);

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Carrying costs prorated over ${report.months} month(s)`, 14, 48);

  autoTable(doc, {
    startY: 54,
    head: [["Property", "Rental Income", "Operating Exp.", "Fixed Costs", "Net P/L"]],
    body: [
      ...report.rows.map((r) => [
        r.property_name,
        money(r.rentalIncome),
        money(r.operatingExpenses),
        money(r.fixedCosts),
        money(r.netPL),
      ]),
      [
        "TOTAL",
        money(report.totalIncome),
        money(report.totalOperatingExpenses),
        money(report.totalFixedCosts),
        money(report.netPL),
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 120, 80], textColor: [255, 255, 255] },
    footStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: "bold" },
  });

  const notesY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 54;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Rental income from Rent Ledger. Operating expenses from Expenses tab. Fixed costs include mortgage, HOA, tax, and insurance from Properties.",
    14,
    notesY + 12,
    { maxWidth: 180 }
  );

  savePdf(doc, "pl", startDate, endDate);
}