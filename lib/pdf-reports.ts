import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  ExpenseReport,
  IncomeReport,
  InvestorPayoutReportSummary,
  PLReport,
  ReportKind,
  VendorPayoutReport,
} from "./reports";
import type { InvestorPayout } from "./types";

const LOGO_PATH = "/hop2it-logo.png";
const LOGO_WIDTH = 144;
const LOGO_HEIGHT = 54;
const REPORT_GREEN = { r: 16, g: 120, b: 80 };
const REPORT_GREEN_RGB: [number, number, number] = [
  REPORT_GREEN.r,
  REPORT_GREEN.g,
  REPORT_GREEN.b,
];
let logoDataUrl: string | null = null;

function recolorWhiteToGreen(imageData: ImageData): void {
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 8) continue;

    const avg = (r + g + b) / 3;
    const isWhite = avg > 165 && Math.max(r, g, b) - Math.min(r, g, b) < 55;
    if (!isWhite) continue;

    const blend = Math.min(1, (avg - 165) / 90);
    data[i] = Math.round(r * (1 - blend) + REPORT_GREEN.r * blend);
    data[i + 1] = Math.round(g * (1 - blend) + REPORT_GREEN.g * blend);
    data[i + 2] = Math.round(b * (1 - blend) + REPORT_GREEN.b * blend);
  }
}

async function loadLogoDataUrl(): Promise<string> {
  if (logoDataUrl) return logoDataUrl;
  if (typeof document === "undefined") {
    throw new Error("PDF logo rendering requires a browser environment.");
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load report logo."));
    img.src = LOGO_PATH;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to prepare report logo.");

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  recolorWhiteToGreen(imageData);
  ctx.putImageData(imageData, 0, 0);

  logoDataUrl = canvas.toDataURL("image/png");
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

function displayField(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

async function addPayoutFormHeader(doc: jsPDF, payoutId: string) {
  const logo = await loadLogoDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  doc.addImage(
    logo,
    "PNG",
    pageWidth - margin - LOGO_WIDTH,
    10,
    LOGO_WIDTH,
    LOGO_HEIGHT
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b);
  doc.text("Investor Payout Form", margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Payout ID: ${payoutId}`, margin, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 36);
}

function periodLabel(start: string, end: string): string {
  return `${start} to ${end}`;
}

async function addHeader(doc: jsPDF, title: string, start: string, end: string) {
  const logo = await loadLogoDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  doc.addImage(
    logo,
    "PNG",
    pageWidth - margin - LOGO_WIDTH,
    10,
    LOGO_WIDTH,
    LOGO_HEIGHT
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b);
  doc.text(title, margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Period: ${periodLabel(start, end)}`, margin, 30);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 36);
}

function tableStartY(): number {
  return 62;
}

function savePdf(doc: jsPDF, kind: ReportKind, start: string, end: string) {
  doc.save(`hop2it-${kind}-report-${start}-to-${end}.pdf`);
}

export async function downloadIncomePdf(report: IncomeReport): Promise<void> {
  const doc = new jsPDF();
  const { startDate, endDate } = report.period;

  await addHeader(doc, "Income Report", startDate, endDate);

  autoTable(doc, {
    startY: tableStartY(),
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
    ?.finalY ?? tableStartY();

  autoTable(doc, {
    startY: summaryY + 10,
    head: [["Property", "Total Income"]],
    body: [
      ...report.byProperty.map((r) => [r.property_name, money(r.total)]),
      ["TOTAL", money(report.totalIncome)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: REPORT_GREEN_RGB, textColor: [255, 255, 255] },
  });

  savePdf(doc, "income", startDate, endDate);
}

export async function downloadExpensePdf(report: ExpenseReport): Promise<void> {
  const doc = new jsPDF();
  const { startDate, endDate } = report.period;

  await addHeader(doc, "Expense Report", startDate, endDate);

  autoTable(doc, {
    startY: tableStartY(),
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
    ?.finalY ?? tableStartY();

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
  doc.text(`Carrying costs prorated over ${report.months} month(s)`, 14, 44);

  autoTable(doc, {
    startY: 50,
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
    headStyles: { fillColor: REPORT_GREEN_RGB, textColor: [255, 255, 255] },
    footStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: "bold" },
  });

  const notesY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 50;

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

export async function downloadVendorPayoutPdf(report: VendorPayoutReport): Promise<void> {
  const doc = new jsPDF();
  const { startDate, endDate } = report.period;

  await addHeader(doc, "Vendor Payout Report", startDate, endDate);

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Payments to vendors from Expenses and Maintenance tabs.", 14, 44);

  autoTable(doc, {
    startY: 50,
    head: [["Date", "Source", "Vendor", "Property", "Category", "Description", "Amount"]],
    body: report.lines.map((l) => [
      l.date,
      l.source,
      l.vendor,
      l.property_name,
      l.category,
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
    head: [["Vendor", "Total Payout"]],
    body: [
      ...report.byVendor.map((r) => [r.vendor, money(r.total)]),
      ["TOTAL", money(report.totalPayouts)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: REPORT_GREEN_RGB, textColor: [255, 255, 255] },
  });

  savePdf(doc, "vendor_payout", startDate, endDate);
}

export async function downloadInvestorPayoutReportPdf(
  report: InvestorPayoutReportSummary
): Promise<void> {
  const doc = new jsPDF();
  const { startDate, endDate, propertyName, investorName } = report.period;

  await addHeader(doc, "Investor Payout Report — By Investor", startDate, endDate);

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const filterParts = [
    propertyName ? `Property: ${propertyName}` : null,
    investorName ? `Investor: ${investorName}` : null,
  ].filter(Boolean);
  doc.text(
    filterParts.length
      ? `Filters: ${filterParts.join(" · ")}`
      : "All investor payouts in period, totaled by investor",
    14,
    44
  );

  autoTable(doc, {
    startY: 50,
    head: [["Investor", "Payouts", "Total Amount"]],
    body: [
      ...report.byInvestor.map((r) => [
        r.investor_name,
        String(r.count),
        money(r.total),
      ]),
      ["TOTAL", String(report.lines.length), money(report.totalPayouts)],
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: REPORT_GREEN_RGB, textColor: [255, 255, 255] },
    footStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: "bold" },
  });

  const summaryY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 50;

  if (report.lines.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b);
    doc.text("Payout Detail", 14, summaryY + 14);

    autoTable(doc, {
      startY: summaryY + 18,
      head: [["Date", "Payout ID", "Investor", "Property", "Type", "Amount", "Status"]],
      body: report.lines.map((l) => [
        l.date,
        l.payout_id,
        l.investor_name,
        l.property_name,
        l.payout_type,
        money(l.payout_amount),
        l.status,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [251, 191, 36], textColor: [24, 24, 27] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
  }

  savePdf(doc, "investor_payout", startDate, endDate);
}

export async function downloadInvestorPayoutPdf(
  payout: Pick<
    InvestorPayout,
    | "payout_id"
    | "date"
    | "property_name"
    | "investor_name"
    | "payout_type"
    | "payout_amount"
    | "payment_method"
    | "payment_date"
    | "tax_year"
    | "status"
    | "notes"
  >
): Promise<void> {
  const doc = new jsPDF();
  await addPayoutFormHeader(doc, payout.payout_id);

  autoTable(doc, {
    startY: 48,
    head: [["Field", "Value"]],
    body: [
      ["Payout ID", payout.payout_id],
      ["Record Date", payout.date],
      ["Property", payout.property_name],
      ["Investor", payout.investor_name],
      ["Payout Type", payout.payout_type],
      ["Payout Amount", money(payout.payout_amount)],
      ["Payment Method", displayField(payout.payment_method)],
      ["Payment Date", displayField(payout.payment_date)],
      ["Tax Year", displayField(payout.tax_year)],
      ["Status", payout.status],
      ["Notes", displayField(payout.notes)],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: REPORT_GREEN_RGB, textColor: [255, 255, 255] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 52, fillColor: [245, 245, 245] },
      1: { cellWidth: "auto" },
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
  });

  const tableEnd =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 48;

  doc.setDrawColor(REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b);
  doc.setLineWidth(0.6);
  doc.roundedRect(14, tableEnd + 10, 182, 22, 2, 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b);
  doc.text("Total Payout Amount", 20, tableEnd + 22);

  doc.setFontSize(14);
  doc.text(money(payout.payout_amount), 20, tableEnd + 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "This document confirms investor payout details recorded in HOP2IT Property Manager.",
    14,
    tableEnd + 42,
    { maxWidth: 180 }
  );

  const safeId = payout.payout_id.replace(/[^a-zA-Z0-9_-]+/g, "-");
  doc.save(`hop2it-investor-payout-${safeId}.pdf`);
}