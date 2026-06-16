import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  ExpenseReport,
  IncomeReport,
  InvestorPayoutReportSummary,
  PLReport,
  ReportKind,
  InvestorCapitalReport,
} from "./reports";
import {
  formatRate,
  loanSummaryFromPayout,
  type InvestorPayoutLoanSummary,
} from "./investor-payout-summary";
import type { InvestorPayout } from "./types";

const LOGO_PATH = "/hop2it-logo.png";
const PAGE_MARGIN = 14;
const LOGO_WIDTH = 52;
const HEADER_TEXT_GAP = 10;
const TITLE_META_GAP = 5;
const META_LINE_GAP = 4;
const DIVIDER_CONTENT_GAP = 8;
const REPORT_GREEN = { r: 16, g: 120, b: 80 };
const REPORT_GREEN_RGB: [number, number, number] = [
  REPORT_GREEN.r,
  REPORT_GREEN.g,
  REPORT_GREEN.b,
];
let logoDataUrl: string | null = null;
let logoNaturalWidth = 800;
let logoNaturalHeight = 300;

function logoDisplayHeight(): number {
  return LOGO_WIDTH * (logoNaturalHeight / logoNaturalWidth);
}

function recolorWhiteToGreenPixels(data: Uint8ClampedArray): void {
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

async function loadLogoFromBrowser(): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load report logo."));
    img.src = LOGO_PATH;
  });
  logoNaturalWidth = img.naturalWidth || logoNaturalWidth;
  logoNaturalHeight = img.naturalHeight || logoNaturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to prepare report logo.");

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  recolorWhiteToGreenPixels(imageData.data);
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

async function loadLogoFromServer(): Promise<string> {
  const { readFileSync } = await import("fs");
  const { join } = await import("path");
  const { PNG } = await import("pngjs");

  const logoPath = join(process.cwd(), "public", "hop2it-logo.png");
  const png = PNG.sync.read(readFileSync(logoPath));

  logoNaturalWidth = png.width;
  logoNaturalHeight = png.height;
  recolorWhiteToGreenPixels(
    new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength)
  );

  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

async function loadLogoDataUrl(): Promise<string> {
  if (logoDataUrl) return logoDataUrl;
  logoDataUrl =
    typeof document !== "undefined"
      ? await loadLogoFromBrowser()
      : await loadLogoFromServer();
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

function moneyPrecise(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPdfDate(value: string): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderLoanSummaryTable(
  doc: jsPDF,
  summary: InvestorPayoutLoanSummary,
  startY: number,
  heading?: string
): number {
  let y = startY;
  if (heading) {
    drawBodyText(doc, heading, y, {
      fontSize: 10,
      bold: true,
      color: [REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b],
    });
    y += 8;
  }

  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: [
      ["Address", summary.property_address || "—"],
      ["Loan Date", formatPdfDate(summary.loan_date)],
      ["Sell Estimate", formatPdfDate(summary.sell_estimate_date)],
      ["Investor", summary.investor_name || "—"],
      ["Attorney", summary.attorney || "—"],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42 },
      1: { cellWidth: "auto" },
    },
    theme: "plain",
  });

  const infoEnd =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  autoTable(doc, {
    startY: infoEnd + 6,
    head: [
      ["Capital Received", "12-Mo Rate", "Total Interest (12 mo)", "Days in Year", "Interest / Day"],
    ],
    body: [
      [
        money(summary.amount_loaned),
        formatRate(summary.annual_interest_rate),
        money(summary.total_interest_12_months),
        String(summary.days_in_year),
        moneyPrecise(summary.interest_cost_per_day),
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: REPORT_GREEN_RGB, textColor: [255, 255, 255] },
  });

  const calcStart =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? infoEnd;

  autoTable(doc, {
    startY: calcStart + 4,
    head: [["Days Held", "Interest w/o Kicker", "Kicker", "Interest + Kicker", "Total Payout"]],
    body: [
      [
        String(summary.days_held),
        moneyPrecise(summary.interest_without_kicker),
        money(summary.kicker),
        moneyPrecise(summary.interest_and_kicker_total),
        moneyPrecise(summary.total_payout),
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [251, 191, 36], textColor: [24, 24, 27] },
    footStyles: { fillColor: [230, 230, 230], fontStyle: "bold" },
  });

  return (
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? calcStart
  );
}

function displayField(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function logoX(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth() - PAGE_MARGIN - LOGO_WIDTH;
}

function headerTextMaxWidth(doc: jsPDF): number {
  return logoX(doc) - PAGE_MARGIN - HEADER_TEXT_GAP;
}

function placeLogoTopRight(doc: jsPDF, logo: string): number {
  const logoHeight = logoDisplayHeight();
  doc.addImage(logo, "PNG", logoX(doc), PAGE_MARGIN + 1, LOGO_WIDTH, logoHeight);
  return logoHeight + 1;
}

function drawHeaderText(
  doc: jsPDF,
  text: string,
  y: number,
  options?: { fontSize?: number; bold?: boolean; color?: [number, number, number] }
) {
  doc.setFont("helvetica", options?.bold ? "bold" : "normal");
  doc.setFontSize(options?.fontSize ?? 10);
  if (options?.color) doc.setTextColor(...options.color);
  doc.text(text, PAGE_MARGIN, y, {
    align: "left",
    maxWidth: headerTextMaxWidth(doc),
  });
}

function drawBodyText(
  doc: jsPDF,
  text: string,
  y: number,
  options?: { fontSize?: number; bold?: boolean; color?: [number, number, number]; maxWidth?: number }
) {
  doc.setFont("helvetica", options?.bold ? "bold" : "normal");
  doc.setFontSize(options?.fontSize ?? 10);
  if (options?.color) doc.setTextColor(...options.color);
  doc.text(text, PAGE_MARGIN, y, {
    align: "left",
    maxWidth: options?.maxWidth ?? doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2,
  });
}

function drawHeaderDivider(doc: jsPDF, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.35);
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
}

async function renderPdfHeader(
  doc: jsPDF,
  title: string,
  metaLines: string[],
  options?: { contentGap?: number }
): Promise<number> {
  const logo = await loadLogoDataUrl();
  const logoHeight = placeLogoTopRight(doc, logo);

  let y = PAGE_MARGIN + 7;
  drawHeaderText(doc, title, y, {
    fontSize: 11,
    bold: true,
    color: [30, 30, 30],
  });

  y += TITLE_META_GAP + 3;
  for (const line of metaLines) {
    drawHeaderText(doc, line, y, { fontSize: 8, color: [100, 100, 100] });
    y += META_LINE_GAP;
  }

  const headerBottom = Math.max(PAGE_MARGIN + logoHeight + 2, y + 1) + 3;
  drawHeaderDivider(doc, headerBottom);
  return headerBottom + (options?.contentGap ?? DIVIDER_CONTENT_GAP);
}

function addSubtitle(doc: jsPDF, y: number, text: string): number {
  drawBodyText(doc, text, y, { fontSize: 9, color: [80, 80, 80] });
  return y + 10;
}

function periodLabel(start: string, end: string): string {
  return `${start} to ${end}`;
}

function standardReportMeta(start: string, end: string): string[] {
  return [
    `Period: ${periodLabel(start, end)}  |  Generated: ${new Date().toLocaleString()}`,
  ];
}

export interface PdfResult {
  buffer: ArrayBuffer;
  filename: string;
}

function finishPdf(doc: jsPDF, filename: string): PdfResult {
  return { buffer: doc.output("arraybuffer"), filename };
}

function triggerBrowserDownload({ buffer, filename }: PdfResult) {
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function buildIncomePdf(report: IncomeReport): Promise<PdfResult> {
  const doc = new jsPDF();
  const { startDate, endDate } = report.period;

  const contentStartY = await renderPdfHeader(
    doc,
    "Income Report",
    standardReportMeta(startDate, endDate)
  );

  autoTable(doc, {
    startY: contentStartY,
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
    ?.finalY ?? contentStartY;

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

  return finishPdf(doc, `hop2it-income-report-${startDate}-to-${endDate}.pdf`);
}

export async function downloadIncomePdf(report: IncomeReport): Promise<void> {
  triggerBrowserDownload(await buildIncomePdf(report));
}

export async function buildExpensePdf(report: ExpenseReport): Promise<PdfResult> {
  const doc = new jsPDF();
  const { startDate, endDate } = report.period;

  const contentStartY = await renderPdfHeader(
    doc,
    "Expense Report",
    standardReportMeta(startDate, endDate)
  );

  autoTable(doc, {
    startY: contentStartY,
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
    ?.finalY ?? contentStartY;

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

  return finishPdf(doc, `hop2it-expense-report-${startDate}-to-${endDate}.pdf`);
}

export async function downloadExpensePdf(report: ExpenseReport): Promise<void> {
  triggerBrowserDownload(await buildExpensePdf(report));
}

export async function buildPLPdf(report: PLReport): Promise<PdfResult> {
  const doc = new jsPDF();
  const { startDate, endDate } = report.period;

  let contentStartY = await renderPdfHeader(
    doc,
    "Profit & Loss Report",
    standardReportMeta(startDate, endDate)
  );
  contentStartY = addSubtitle(
    doc,
    contentStartY,
    `Carrying costs prorated over ${report.months} month(s)`
  );

  autoTable(doc, {
    startY: contentStartY,
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
    ?.finalY ?? contentStartY;

  drawBodyText(
    doc,
    "Rental income from Rent Ledger. Operating expenses from Expenses tab. Fixed costs include mortgage, HOA, tax, and insurance from Properties.",
    notesY + 12,
    { fontSize: 8, color: [100, 100, 100] }
  );

  return finishPdf(doc, `hop2it-pl-report-${startDate}-to-${endDate}.pdf`);
}

export async function downloadPLPdf(report: PLReport): Promise<void> {
  triggerBrowserDownload(await buildPLPdf(report));
}

export async function buildInvestorCapitalReportPdf(
  report: InvestorCapitalReport
): Promise<PdfResult> {
  const doc = new jsPDF();
  const { startDate, endDate, propertyName, investorName } = report.period;

  let contentStartY = await renderPdfHeader(
    doc,
    "Investor Capital Report",
    standardReportMeta(startDate, endDate)
  );
  const filterParts = [
    propertyName ? `Property: ${propertyName}` : null,
    investorName ? `Investor: ${investorName}` : null,
  ].filter(Boolean);
  contentStartY = addSubtitle(
    doc,
    contentStartY,
    filterParts.length
      ? `Filters: ${filterParts.join(" · ")}`
      : "Investor capital records in period with loan calculator totals"
  );

  autoTable(doc, {
    startY: contentStartY,
    head: [["Investor", "Records", "Total Capital Received"]],
    body: [
      ...report.byInvestor.map((r) => [
        r.investor_name,
        String(r.count),
        money(r.total_loaned),
      ]),
      ["TOTAL", String(report.lines.length), money(report.totalLoaned)],
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: REPORT_GREEN_RGB, textColor: [255, 255, 255] },
    footStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: "bold" },
  });

  const summaryY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? contentStartY;

  if (report.lines.length > 0) {
    drawBodyText(doc, "Capital Detail", summaryY + 14, {
      fontSize: 10,
      bold: true,
      color: [REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b],
    });

    autoTable(doc, {
      startY: summaryY + 18,
      head: [["Date", "Capital ID", "Investor", "Property", "Capital Received", "Rate", "Loan Date", "Sell Est."]],
      body: report.lines.map((l) => [
        l.date,
        l.capital_id,
        l.investor_name,
        l.property_name,
        money(l.amount_loaned),
        l.annual_interest_rate > 0 ? formatRate(l.annual_interest_rate) : "",
        l.loan_date,
        l.sell_estimate_date,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [251, 191, 36], textColor: [24, 24, 27] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
  }

  if (report.loanSummaries.length > 0) {
    let loanY =
      ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
        summaryY) + 16;

    drawBodyText(doc, "Payout Calculator Summary", loanY, {
      fontSize: 11,
      bold: true,
      color: [REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b],
    });
    loanY += 10;

    for (const [index, summary] of report.loanSummaries.entries()) {
      if (loanY > doc.internal.pageSize.getHeight() - 70) {
        doc.addPage();
        loanY = PAGE_MARGIN + 10;
      }
      loanY = renderLoanSummaryTable(
        doc,
        summary,
        loanY,
        report.loanSummaries.length > 1
          ? `${summary.investor_name || "Investor"} · ${summary.property_address || summary.investor_name}`
          : undefined
      );
      if (index < report.loanSummaries.length - 1) loanY += 10;
    }

    const totalsY = loanY + 8;
    autoTable(doc, {
      startY: totalsY,
      head: [["Calculated Total Payouts", moneyPrecise(report.calculatedTotalPayouts)]],
      body: [],
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: "bold" },
      theme: "plain",
    });
  }

  return finishPdf(doc, `hop2it-investor_capital-report-${startDate}-to-${endDate}.pdf`);
}

export async function downloadInvestorCapitalReportPdf(
  report: InvestorCapitalReport
): Promise<void> {
  triggerBrowserDownload(await buildInvestorCapitalReportPdf(report));
}

export async function buildInvestorPayoutReportPdf(
  report: InvestorPayoutReportSummary
): Promise<PdfResult> {
  const doc = new jsPDF();
  const { startDate, endDate, propertyName, investorName } = report.period;

  let contentStartY = await renderPdfHeader(
    doc,
    "Investor Payout Report",
    standardReportMeta(startDate, endDate)
  );
  const filterParts = [
    propertyName ? `Property: ${propertyName}` : null,
    investorName ? `Investor: ${investorName}` : null,
  ].filter(Boolean);
  contentStartY = addSubtitle(
    doc,
    contentStartY,
    filterParts.length
      ? `Filters: ${filterParts.join(" · ")}`
      : "All investor payouts in period, totaled by investor"
  );

  autoTable(doc, {
    startY: contentStartY,
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
    ?.finalY ?? contentStartY;

  if (report.lines.length > 0) {
    drawBodyText(doc, "Payout Detail", summaryY + 14, {
      fontSize: 10,
      bold: true,
      color: [REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b],
    });

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

  if (report.loanSummaries.length > 0) {
    let loanY =
      ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
        summaryY) + 16;

    drawBodyText(doc, "Payout Calculator Summary", loanY, {
      fontSize: 11,
      bold: true,
      color: [REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b],
    });
    loanY += 10;

    for (const [index, summary] of report.loanSummaries.entries()) {
      if (loanY > doc.internal.pageSize.getHeight() - 70) {
        doc.addPage();
        loanY = PAGE_MARGIN + 10;
      }
      loanY = renderLoanSummaryTable(
        doc,
        summary,
        loanY,
        report.loanSummaries.length > 1
          ? `${summary.investor_name || "Investor"} · ${summary.property_address || summary.investor_name}`
          : undefined
      );
      if (index < report.loanSummaries.length - 1) loanY += 10;
    }

    const totalsY = loanY + 8;
    autoTable(doc, {
      startY: totalsY,
      head: [["Calculated Total Payouts", moneyPrecise(report.calculatedTotalPayouts)]],
      body: [],
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [230, 230, 230], textColor: [30, 30, 30], fontStyle: "bold" },
      theme: "plain",
    });
  }

  return finishPdf(doc, `hop2it-investor_payout-report-${startDate}-to-${endDate}.pdf`);
}

export async function downloadInvestorPayoutReportPdf(
  report: InvestorPayoutReportSummary
): Promise<void> {
  triggerBrowserDownload(await buildInvestorPayoutReportPdf(report));
}

export async function buildInvestorPayoutPdf(
  payout: Pick<
    InvestorPayout,
    | "payout_id"
    | "date"
    | "property_name"
    | "property_address"
    | "loan_date"
    | "sell_estimate_date"
    | "investor_name"
    | "attorney"
    | "amount_loaned"
    | "annual_interest_rate"
    | "kicker"
    | "days_in_year"
    | "payout_type"
    | "payout_amount"
    | "payment_method"
    | "payment_date"
    | "tax_year"
    | "status"
    | "notes"
  >
): Promise<PdfResult> {
  const doc = new jsPDF();
  const contentStartY = await renderPdfHeader(
    doc,
    "Investor Payout Form",
    [
      `Payout ID: ${payout.payout_id}  |  Generated: ${new Date().toLocaleString()}`,
    ],
    { contentGap: 10 }
  );

  autoTable(doc, {
    startY: contentStartY,
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
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? contentStartY;

  const loanSummary = loanSummaryFromPayout(payout);
  let footerY = tableEnd + 12;

  drawBodyText(doc, "Payout Calculator Summary", footerY, {
    fontSize: 11,
    bold: true,
    color: [REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b],
  });
  footerY += 8;

  if (loanSummary) {
    footerY = renderLoanSummaryTable(doc, loanSummary, footerY);
  } else {
    doc.setDrawColor(REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b);
    doc.setLineWidth(0.6);
    doc.roundedRect(14, footerY, 182, 22, 2, 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(REPORT_GREEN.r, REPORT_GREEN.g, REPORT_GREEN.b);
    doc.text("Total Payout Amount", 20, footerY + 12);

    doc.setFontSize(14);
    doc.text(money(payout.payout_amount), 20, footerY + 20);
    footerY += 30;
  }

  drawBodyText(
    doc,
    "This document confirms investor payout details recorded in HOP2IT Property Manager.",
    footerY + 10,
    { fontSize: 8, color: [100, 100, 100] }
  );

  const safeId = payout.payout_id.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return finishPdf(doc, `hop2it-investor-payout-${safeId}.pdf`);
}

export async function downloadInvestorPayoutPdf(
  payout: Pick<
    InvestorPayout,
    | "payout_id"
    | "date"
    | "property_name"
    | "property_address"
    | "loan_date"
    | "sell_estimate_date"
    | "investor_name"
    | "attorney"
    | "amount_loaned"
    | "annual_interest_rate"
    | "kicker"
    | "days_in_year"
    | "payout_type"
    | "payout_amount"
    | "payment_method"
    | "payment_date"
    | "tax_year"
    | "status"
    | "notes"
  >
): Promise<void> {
  triggerBrowserDownload(await buildInvestorPayoutPdf(payout));
}