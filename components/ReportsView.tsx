"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import {
  downloadExpensePdf,
  downloadIncomePdf,
  downloadInvestorPayoutReportPdf,
  downloadPLPdf,
  downloadVendorPayoutPdf,
} from "@/lib/pdf-reports";
import {
  buildExpenseReport,
  buildIncomeReport,
  buildInvestorPayoutReport,
  buildPLReport,
  buildVendorPayoutReport,
  defaultReportRange,
  type ReportKind,
} from "@/lib/reports";
import type {
  Expense,
  Investor,
  InvestorPayout,
  MaintenanceRecord,
  Property,
  RentPayment,
} from "@/lib/types";

interface ReportsViewProps {
  properties: Property[];
  rentPayments: RentPayment[];
  expenses: Expense[];
  maintenance: MaintenanceRecord[];
  investorPayouts: InvestorPayout[];
  investors: Investor[];
}

const REPORT_OPTIONS: { id: ReportKind; label: string; description: string }[] = [
  {
    id: "pl",
    label: "P/L Report",
    description: "Profit and loss by property — rental income minus operating and fixed costs.",
  },
  {
    id: "income",
    label: "Income Report",
    description: "Rent collected from the Rent Ledger, grouped by property.",
  },
  {
    id: "expense",
    label: "Expense Report",
    description: "All expenses in the period, with totals by category and property.",
  },
  {
    id: "vendor_payout",
    label: "Vendor Payout Report",
    description: "Payments to vendors from Expenses and Maintenance, totaled by vendor.",
  },
  {
    id: "investor_payout",
    label: "Investor Payout Report",
    description: "Investor distributions from the Investor Payout tab, filterable by investor and property.",
  },
];

export default function ReportsView({
  properties,
  rentPayments,
  expenses,
  maintenance,
  investorPayouts,
  investors,
}: ReportsViewProps) {
  const defaults = defaultReportRange();
  const [reportKind, setReportKind] = useState<ReportKind>("pl");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [propertyName, setPropertyName] = useState("");
  const [investorName, setInvestorName] = useState("");
  const [generating, setGenerating] = useState(false);

  const investorOptions = useMemo(() => {
    const names = new Set<string>();
    for (const investor of investors) {
      if (investor.investor_name?.trim()) names.add(investor.investor_name.trim());
    }
    for (const payout of investorPayouts) {
      if (payout.investor_name?.trim()) names.add(payout.investor_name.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [investors, investorPayouts]);

  const filters = useMemo(
    () => ({
      startDate,
      endDate,
      propertyName: propertyName || undefined,
      investorName:
        reportKind === "investor_payout" && investorName ? investorName : undefined,
    }),
    [startDate, endDate, propertyName, investorName, reportKind]
  );

  const incomeReport = useMemo(
    () => buildIncomeReport(rentPayments, filters),
    [rentPayments, filters]
  );
  const expenseReport = useMemo(
    () => buildExpenseReport(expenses, filters),
    [expenses, filters]
  );
  const plReport = useMemo(
    () => buildPLReport(properties, rentPayments, expenses, filters),
    [properties, rentPayments, expenses, filters]
  );
  const vendorPayoutReport = useMemo(
    () => buildVendorPayoutReport(expenses, maintenance, filters),
    [expenses, maintenance, filters]
  );
  const investorPayoutReport = useMemo(
    () => buildInvestorPayoutReport(investorPayouts, filters),
    [investorPayouts, filters]
  );

  const handleDownload = async () => {
    setGenerating(true);
    try {
      if (reportKind === "income") await downloadIncomePdf(incomeReport);
      else if (reportKind === "expense") await downloadExpensePdf(expenseReport);
      else if (reportKind === "vendor_payout") await downloadVendorPayoutPdf(vendorPayoutReport);
      else if (reportKind === "investor_payout")
        await downloadInvestorPayoutReportPdf(investorPayoutReport);
      else await downloadPLPdf(plReport);
    } finally {
      setGenerating(false);
    }
  };

  const previewCards =
    reportKind === "pl"
      ? [
          {
            label: "Net P/L",
            value: formatCurrency(plReport.netPL),
            tone: plReport.netPL < 0 ? "red" : "emerald",
          },
          { label: "Total Income", value: formatCurrency(plReport.totalIncome), tone: "emerald" },
          {
            label: "Total Expenses",
            value: formatCurrency(
              plReport.totalOperatingExpenses + plReport.totalFixedCosts
            ),
            tone: "zinc",
          },
          { label: "Properties", value: String(plReport.rows.length), tone: "zinc" },
        ]
      : reportKind === "income"
        ? [
            {
              label: "Total Income",
              value: formatCurrency(incomeReport.totalIncome),
              tone: "emerald",
            },
            { label: "Payments", value: String(incomeReport.lines.length), tone: "zinc" },
            { label: "Properties", value: String(incomeReport.byProperty.length), tone: "zinc" },
            { label: "Line Items", value: String(incomeReport.lines.length), tone: "zinc" },
          ]
        : reportKind === "expense"
          ? [
              {
                label: "Total Expenses",
                value: formatCurrency(expenseReport.totalExpenses),
                tone: "emerald",
              },
              {
                label: "Categories",
                value: String(expenseReport.byCategory.length),
                tone: "zinc",
              },
              {
                label: "Properties",
                value: String(expenseReport.byProperty.length),
                tone: "zinc",
              },
              { label: "Line Items", value: String(expenseReport.lines.length), tone: "zinc" },
            ]
          : reportKind === "vendor_payout"
            ? [
                {
                  label: "Total Payouts",
                  value: formatCurrency(vendorPayoutReport.totalPayouts),
                  tone: "emerald",
                },
                {
                  label: "Vendors",
                  value: String(vendorPayoutReport.byVendor.length),
                  tone: "zinc",
                },
                {
                  label: "Properties",
                  value: String(vendorPayoutReport.byProperty.length),
                  tone: "zinc",
                },
                {
                  label: "Line Items",
                  value: String(vendorPayoutReport.lines.length),
                  tone: "zinc",
                },
              ]
            : [
                {
                  label: "Total Payouts",
                  value: formatCurrency(investorPayoutReport.totalPayouts),
                  tone: "emerald",
                },
                {
                  label: "Investors",
                  value: String(investorPayoutReport.byInvestor.length),
                  tone: "zinc",
                },
                {
                  label: "Properties",
                  value: String(investorPayoutReport.byProperty.length),
                  tone: "zinc",
                },
                {
                  label: "Payouts",
                  value: String(investorPayoutReport.lines.length),
                  tone: "zinc",
                },
              ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tighter mb-2">Reports</h1>
        <p className="text-sm text-zinc-400">
          Generate P/L, income, expense, vendor payout, and investor payout reports as PDF downloads.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              setReportKind(opt.id);
              if (opt.id !== "investor_payout") setInvestorName("");
            }}
            className={`rounded-xl border p-4 text-left transition ${
              reportKind === opt.id
                ? "border-emerald-500/70 bg-emerald-950/30"
                : "border-zinc-600/60 bg-zinc-800/90 hover:border-zinc-500"
            }`}
          >
            <div
              className={`font-semibold mb-1 ${
                reportKind === opt.id ? "text-emerald-300" : "text-zinc-100"
              }`}
            >
              {opt.label}
            </div>
            <p className="text-xs text-zinc-400">{opt.description}</p>
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 p-4 sm:p-6">
        <h2 className="font-semibold text-lg mb-4">Report Options</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
              Start Date
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-field"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
              End Date
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-field"
            />
          </label>
          <label
            className={`block ${reportKind === "investor_payout" ? "" : "sm:col-span-2"}`}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
              Property (optional)
            </span>
            <select
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              className="form-select"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.property_name}>
                  {p.property_name}
                </option>
              ))}
            </select>
          </label>
          {reportKind === "investor_payout" && (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                Investor (optional)
              </span>
              <select
                value={investorName}
                onChange={(e) => setInvestorName(e.target.value)}
                className="form-select"
              >
                <option value="">All investors</option>
                {investorOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={generating || startDate > endDate}
          className="mt-5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {generating ? "Generating..." : "Download PDF"}
        </button>
        {startDate > endDate && (
          <p className="text-xs text-red-400 mt-2">End date must be on or after start date.</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 p-4 sm:p-6">
        <h2 className="font-semibold text-lg mb-4">Preview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {previewCards.map((card) => (
            <div key={card.label} className="rounded-lg bg-zinc-700/50 p-4">
              <div className="text-xs text-zinc-400 uppercase tracking-wide">{card.label}</div>
              <div
                className={`text-2xl font-semibold mt-1 ${
                  card.tone === "red"
                    ? "text-red-400"
                    : card.tone === "emerald"
                      ? "text-emerald-400"
                      : "text-zinc-100"
                }`}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}