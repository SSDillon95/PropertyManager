"use client";

import { useMemo, useState } from "react";
import InvestorPayoutSummaryPanel from "@/components/InvestorPayoutSummaryPanel";
import { formatCurrency } from "@/lib/format";
import { formatMoneyPrecise } from "@/lib/investor-payout-summary";
import { requestReportPdf } from "@/lib/pdf-client";
import { PROPERTY_STATUS_OPTIONS } from "@/lib/columns";
import {
  buildExpenseReport,
  buildIncomeReport,
  buildInvestorCapitalReport,
  buildInvestorPayoutReport,
  buildPLReport,
  buildPropertyAvailabilityReport,
  buildPropertyInsuranceReport,
  defaultReportRange,
  NO_INSURANCE_ON_FILE,
  type ReportKind,
} from "@/lib/reports";
import type {
  Expense,
  Investor,
  InvestorPayout,
  Lease,
  Property,
  RentPayment,
} from "@/lib/types";

interface ReportsViewProps {
  properties: Property[];
  leases: Lease[];
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
  {
    id: "property_insurance",
    label: "Property Insurance Report",
    description:
      "Insurance, lien holder, property value, and address details with missing coverage flagged in red.",
  },
  {
    id: "property_availability",
    label: "Property Availability Report",
    description:
      "Available properties (non-occupied) with rental amount, deposit, and bed/bath details.",
  },
];

const INVESTOR_FILTER_REPORTS: ReportKind[] = ["investor_capital", "investor_payout"];
const PROPERTY_INSURANCE_REPORTS: ReportKind[] = ["property_insurance"];
const PROPERTY_AVAILABILITY_REPORTS: ReportKind[] = ["property_availability"];
const DATE_FILTER_REPORTS: ReportKind[] = ["pl", "income", "expense", "investor_capital", "investor_payout"];
const AVAILABLE_STATUS_OPTIONS = PROPERTY_STATUS_OPTIONS.filter((status) => status !== "Occupied");

export default function ReportsView({
  properties,
  leases,
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
  const [reportBusinessFilter, setReportBusinessFilter] = useState("");
  const [reportLienHolderFilter, setReportLienHolderFilter] = useState("");
  const [reportAvailabilityPropertyFilter, setReportAvailabilityPropertyFilter] = useState("");
  const [reportAvailabilityStatusFilter, setReportAvailabilityStatusFilter] = useState("");
  const [generating, setGenerating] = useState(false);

  const reportBusinessOptions = useMemo(() => {
    const names = new Set<string>();
    for (const property of properties) {
      if (property.business_name?.trim()) names.add(property.business_name.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const reportLienHolderOptions = useMemo(() => {
    const names = new Set<string>();
    for (const property of properties) {
      if (property.lien_holder?.trim()) names.add(property.lien_holder.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [properties]);

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
  const propertyInsuranceReport = useMemo(
    () =>
      buildPropertyInsuranceReport(properties, {
        businessName: reportBusinessFilter || undefined,
        lienHolder: reportLienHolderFilter || undefined,
      }),
    [properties, reportBusinessFilter, reportLienHolderFilter]
  );
  const propertyAvailabilityReport = useMemo(
    () =>
      buildPropertyAvailabilityReport(properties, leases, {
        propertyName: reportAvailabilityPropertyFilter || undefined,
        status: reportAvailabilityStatusFilter || undefined,
      }),
    [properties, leases, reportAvailabilityPropertyFilter, reportAvailabilityStatusFilter]
  );

  const selectedReport = REPORT_OPTIONS.find((opt) => opt.id === reportKind);
  const usesDateFilters = DATE_FILTER_REPORTS.includes(reportKind);

  const handleReportKindChange = (next: ReportKind) => {
    setReportKind(next);
    if (!INVESTOR_FILTER_REPORTS.includes(next)) setInvestorName("");
    if (!PROPERTY_INSURANCE_REPORTS.includes(next)) {
      setReportBusinessFilter("");
      setReportLienHolderFilter("");
    }
    if (!PROPERTY_AVAILABILITY_REPORTS.includes(next)) {
      setReportAvailabilityPropertyFilter("");
      setReportAvailabilityStatusFilter("");
    }
    if (
      PROPERTY_INSURANCE_REPORTS.includes(next) ||
      PROPERTY_AVAILABILITY_REPORTS.includes(next)
    ) {
      setPropertyName("");
    }
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
      } else if (reportKind === "property_insurance") {
        await requestReportPdf("property_insurance", { report: propertyInsuranceReport });
      } else if (reportKind === "property_availability") {
        await requestReportPdf("property_availability", { report: propertyAvailabilityReport });
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
                  label: "Total Capital Received",
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
            : reportKind === "property_insurance"
              ? [
                  {
                    label: "Properties Listed",
                    value: String(propertyInsuranceReport.lines.length),
                    tone: "zinc",
                  },
                  {
                    label: "Missing Insurance",
                    value: String(propertyInsuranceReport.missingInsuranceCount),
                    tone:
                      propertyInsuranceReport.missingInsuranceCount > 0 ? "red" : "emerald",
                  },
                  {
                    label: "With Insurance On File",
                    value: String(
                      propertyInsuranceReport.lines.length -
                        propertyInsuranceReport.missingInsuranceCount
                    ),
                    tone: "emerald",
                  },
                  {
                    label: "Filters Applied",
                    value:
                      [reportBusinessFilter, reportLienHolderFilter].filter(Boolean).length > 0
                        ? "Yes"
                        : "No",
                    tone: "zinc",
                  },
                ]
              : reportKind === "property_availability"
                ? [
                    {
                      label: "Total Available",
                      value: String(propertyAvailabilityReport.totalAvailable),
                      tone: "emerald",
                    },
                    {
                      label: "Statuses",
                      value: String(propertyAvailabilityReport.byStatus.length),
                      tone: "zinc",
                    },
                    {
                      label: "Vacant",
                      value: String(
                        propertyAvailabilityReport.byStatus.find((row) => row.status === "Vacant")
                          ?.count ?? 0
                      ),
                      tone: "zinc",
                    },
                    {
                      label: "Filters Applied",
                      value:
                        [reportAvailabilityPropertyFilter, reportAvailabilityStatusFilter].filter(
                          Boolean
                        ).length > 0
                          ? "Yes"
                          : "No",
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
          Generate P/L, income, expense, investor, insurance, and property availability reports as
          PDF downloads.
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
          {usesDateFilters && (
            <>
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
            </>
          )}
          {PROPERTY_AVAILABILITY_REPORTS.includes(reportKind) ? (
            <>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                  Property (optional)
                </span>
                <select
                  value={reportAvailabilityPropertyFilter}
                  onChange={(e) => setReportAvailabilityPropertyFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="">All available properties</option>
                  {properties
                    .filter((property) => property.status !== "Occupied")
                    .sort((left, right) => left.property_name.localeCompare(right.property_name))
                    .map((property) => (
                      <option key={property.id} value={property.property_name}>
                        {property.property_name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                  Status (optional)
                </span>
                <select
                  value={reportAvailabilityStatusFilter}
                  onChange={(e) => setReportAvailabilityStatusFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="">All statuses</option>
                  {AVAILABLE_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : PROPERTY_INSURANCE_REPORTS.includes(reportKind) ? (
            <>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                  Business (optional)
                </span>
                <select
                  value={reportBusinessFilter}
                  onChange={(e) => setReportBusinessFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="">All businesses</option>
                  {reportBusinessOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1 block">
                  Lien Holder (optional)
                </span>
                <select
                  value={reportLienHolderFilter}
                  onChange={(e) => setReportLienHolderFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="">All lien holders</option>
                  {reportLienHolderOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={generating || (usesDateFilters && startDate > endDate)}
          className="mt-5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {generating ? "Generating..." : "Download PDF"}
        </button>
        {usesDateFilters && startDate > endDate && (
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
                        Total Capital Received
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

        {reportKind === "property_availability" && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-emerald-300 mb-3">
              Available Property Details
            </h3>
            {propertyAvailabilityReport.lines.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No available properties match the selected filters.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-600/60">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="bg-emerald-900/40 text-left">
                      <th className="px-3 py-2 font-semibold text-emerald-200">Property</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Address</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Status</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200 text-right">
                        Rental Amount
                      </th>
                      <th className="px-3 py-2 font-semibold text-emerald-200 text-right">
                        Deposit
                      </th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Bed / Bath</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propertyAvailabilityReport.lines.map((line, idx) => (
                      <tr
                        key={`${line.property_name}-${idx}`}
                        className={`border-t border-zinc-700/60 ${
                          idx % 2 === 0 ? "bg-zinc-800/50" : "bg-zinc-700/30"
                        }`}
                      >
                        <td className="px-3 py-2 text-zinc-100">{line.property_name}</td>
                        <td className="px-3 py-2 text-zinc-300">{line.property_address}</td>
                        <td className="px-3 py-2 text-zinc-200">{line.status}</td>
                        <td className="px-3 py-2 text-zinc-200 text-right">
                          {formatCurrency(line.monthly_rent) || "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-200 text-right">
                          {formatCurrency(line.deposit) || "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-200">{line.bed_bath}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {reportKind === "property_insurance" && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-emerald-300 mb-3">Property Insurance Details</h3>
            {propertyInsuranceReport.lines.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No properties match the selected filters.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-600/60">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="bg-emerald-900/40 text-left">
                      <th className="px-3 py-2 font-semibold text-emerald-200">Property</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Address</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Business</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Lien Holder</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Year Built</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200 text-right">
                        Sq Ft
                      </th>
                      <th className="px-3 py-2 font-semibold text-emerald-200 text-right">
                        Property Value
                      </th>
                      <th className="px-3 py-2 font-semibold text-emerald-200 text-right">
                        Annual Insurance
                      </th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Carrier</th>
                      <th className="px-3 py-2 font-semibold text-emerald-200">Policy #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propertyInsuranceReport.lines.map((line, idx) => (
                      <tr
                        key={`${line.property_name}-${idx}`}
                        className={`border-t border-zinc-700/60 ${
                          idx % 2 === 0 ? "bg-zinc-800/50" : "bg-zinc-700/30"
                        }`}
                      >
                        <td className="px-3 py-2 text-zinc-100">{line.property_name}</td>
                        <td className="px-3 py-2 text-zinc-300">{line.property_address}</td>
                        <td className="px-3 py-2 text-zinc-300">{line.business_name}</td>
                        <td className="px-3 py-2 text-zinc-300">{line.lien_holder}</td>
                        <td className="px-3 py-2 text-zinc-300">
                          {line.year_built ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-200 text-right">
                          {line.sq_ft ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-200 text-right">
                          {formatCurrency(line.property_value) || "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-200 text-right">
                          {formatCurrency(line.annual_insurance) || "—"}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            line.missingInsurance
                              ? "text-red-400 font-semibold"
                              : "text-zinc-200"
                          }`}
                        >
                          {line.missingInsurance
                            ? NO_INSURANCE_ON_FILE
                            : line.insurance_carrier_name || "—"}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            line.missingInsurance
                              ? "text-red-400 font-semibold"
                              : "text-zinc-200"
                          }`}
                        >
                          {line.missingInsurance
                            ? NO_INSURANCE_ON_FILE
                            : line.insurance_policy_number || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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