"use client";

import { useMemo, useState } from "react";
import InvestorPayoutSummaryPanel from "@/components/InvestorPayoutSummaryPanel";
import { formatCurrency } from "@/lib/format";
import { formatMoneyPrecise } from "@/lib/investor-payout-summary";
import { requestReportPdf } from "@/lib/pdf-client";
import {
  buildExpenseReport,
  buildIncomeReport,
  buildInvestorCapitalReport,
  buildInvestorPayoutReport,
  buildPLReport,
  defaultReportRange,
  type ReportKind,
} from "@/lib/reports";
import type {
  Expense,
  Investor,
  InvestorPayout,
  Property,
  RentPayment,
} from "@/lib/types";

interface ReportsViewProps {
  properties: Property[];
  rentPayments: RentPayment[];
  expenses: Expense[];
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
    id: "investor_capital",
    label: "Investor Capital Report",
    description: "Investor capital raised in the period with loan calculator payout totals.",
  },
  {
    id: "investor_payout",
    label: "Investor Payout Report",
    description: "Totals investor payouts by investor with optional property and investor filters.",
  },
];

const INVESTOR_FILTER_REPORTS: ReportKind[] = ["investor_capital", "investor_payout"];

export default function ReportsView({
  properties,
  rentPayments,
  expenses,
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
        INVESTOR_FILTER_REPORTS.includes(reportKind) && investorName
          ? investorName
          : undefined,
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
  const investorCapitalReport = useMemo(
    () => buildInvestorCapitalReport(investorPayouts, filters),
    [investorPayouts, filters]
  );
  const investorPayoutReport = useMemo(
    () => buildInvestorPayoutReport(investorPayouts, filters),
    [investorPayouts, filters]
  );

  const selectedReport = REPORT_OPTIONS.find((opt) => opt.id === reportKind);

  const handleReportKindChange = (next: ReportKind) => {
    setReportKind(next);
    if (!INVESTOR_FILTER_REPORTS.includes(next)) setInvestorName("");
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      if (reportKind === "income") {
        await requestReportPdf("income", { report: incomeReport });
      } else if (reportKind === "expense") {
        await requestReportPdf("expense", { report: expenseReport });
      } else if (reportKind === "investor_capital") {
        await requestReportPdf("investor_capital", { report: investorCapitalReport });
      } else if (reportKind === "investor_payout") {
        await requestReportPdf("investor_payout", { report: investorPayoutReport });
      } else {
        await requestReportPdf("pl", { report: plReport });
      }
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
          : reportKind === "investor_capital"
            ? [
                {
                  label: "Total Loaned",
                  value: formatCurrency(investorCapitalReport.totalLoaned),
                  tone: "emerald",
                },
                {
                  label: "Investors",
                  value: String(investorCapitalReport.byInvestor.length),
                  tone: "zinc",
                },
                {
                  label: "Properties",
                  value: String(investorCapitalReport.byProperty.length),
                  tone: "zinc",
                },
                {
                  label: "Capital Records",
                  value: String(investorCapitalReport.lines.length),
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
          Generate P/L, income, expense, investor capital, and investor payout reports as PDF
          downloads.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 p-4 sm:p-6">
        <h2 className="font-semibold text-lg mb-4">Report Options</h2>
        <label className="block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
            Report Type
          </span>
          <select
            value={reportKind}
            onChange={(e) => handleReportKindChange(e.target.value as ReportKind)}
            className="form-select"
          >
            {REPORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          {selectedReport && (
            <p className="text-xs text-zinc-400 mt-2">{selectedReport.description}</p>
          )}
        </label>
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
            className={`block ${INVESTOR_FILTER_REPORTS.includes(reportKind) ? "" : "sm:col-span-2"}`}
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
          {INVESTOR_FILTER_REPORTS.includes(reportKind) && (
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

        {reportKind === "investor_capital" && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-emerald-300 mb-3">Totals by Investor</h3>
            {investorCapitalReport.byInvestor.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No investor capital records match the selected filters.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-600/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-emerald-900/40 text-left">
                      <th className="px-3 py-2 font-semibold text-emerald-200">Investor</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Records</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200 text-right">
                        Total Loaned
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {investorCapitalReport.byInvestor.map((row, idx) => (
                      <tr
                        key={row.investor_name}
                        className={`border-t border-zinc-700/60 ${
                          idx % 2 === 0 ? "bg-zinc-800/50" : "bg-zinc-700/30"
                        }`}
                      >
                        <td className="px-3 py-2 text-zinc-100">{row.investor_name}</td>
                        <td className="px-3 py-2 text-zinc-300">{row.count}</td>
                        <td className="px-3 py-2 text-emerald-400 text-right font-medium">
                          {formatCurrency(row.total_loaned)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-zinc-600 bg-zinc-700/50 font-semibold">
                      <td className="px-3 py-2 text-zinc-100">Total</td>
                      <td className="px-3 py-2 text-zinc-300">
                        {investorCapitalReport.lines.length}
                      </td>
                      <td className="px-3 py-2 text-emerald-400 text-right">
                        {formatCurrency(investorCapitalReport.totalLoaned)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {reportKind === "investor_capital" && investorCapitalReport.loanSummaries.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-semibold text-emerald-300">Payout Calculator Summary</h3>
            {investorCapitalReport.loanSummaries.map((summary, index) => (
              <InvestorPayoutSummaryPanel
                key={`${summary.investor_name}-${summary.loan_date}-${index}`}
                input={{
                  property_address: summary.property_address,
                  loan_date: summary.loan_date,
                  sell_estimate_date: summary.sell_estimate_date,
                  investor_name: summary.investor_name,
                  attorney: summary.attorney,
                  amount_loaned: summary.amount_loaned,
                  annual_interest_rate: summary.annual_interest_rate,
                  kicker: summary.kicker,
                  days_in_year: summary.days_in_year,
                }}
                title={`${summary.investor_name || "Investor"} · ${summary.property_address || "Property"}`}
              />
            ))}
            <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/20 p-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-200">
                Calculated Total Payouts
              </span>
              <span className="text-lg font-semibold text-emerald-300">
                {formatMoneyPrecise(investorCapitalReport.calculatedTotalPayouts)}
              </span>
            </div>
          </div>
        )}

        {reportKind === "investor_payout" && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-emerald-300 mb-3">Totals by Investor</h3>
            {investorPayoutReport.byInvestor.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No investor payouts match the selected filters.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-600/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-emerald-900/40 text-left">
                      <th className="px-3 py-2 font-semibold text-emerald-200">Investor</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Payouts</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200 text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {investorPayoutReport.byInvestor.map((row, idx) => (
                      <tr
                        key={row.investor_name}
                        className={`border-t border-zinc-700/60 ${
                          idx % 2 === 0 ? "bg-zinc-800/50" : "bg-zinc-700/30"
                        }`}
                      >
                        <td className="px-3 py-2 text-zinc-100">{row.investor_name}</td>
                        <td className="px-3 py-2 text-zinc-300">{row.count}</td>
                        <td className="px-3 py-2 text-emerald-400 text-right font-medium">
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-zinc-600 bg-zinc-700/50 font-semibold">
                      <td className="px-3 py-2 text-zinc-100">Total</td>
                      <td className="px-3 py-2 text-zinc-300">
                        {investorPayoutReport.lines.length}
                      </td>
                      <td className="px-3 py-2 text-emerald-400 text-right">
                        {formatCurrency(investorPayoutReport.totalPayouts)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}