"use client";

import {
  computeInvestorPayoutLoanSummary,
  formatMoneyPrecise,
  formatRate,
  type InvestorPayoutLoanInput,
  type InvestorPayoutLoanSummary,
} from "@/lib/investor-payout-summary";
import { formatCurrency } from "@/lib/format";

interface InvestorPayoutSummaryPanelProps {
  input: InvestorPayoutLoanInput;
  title?: string;
  compact?: boolean;
}

function formatDateLabel(value: string): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SummaryGrid({ summary }: { summary: InvestorPayoutLoanSummary }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-zinc-400">Address:</span>{" "}
          <span className="text-zinc-100">{summary.property_address || "—"}</span>
        </div>
        <div>
          <span className="text-zinc-400">Loan Date:</span>{" "}
          <span className="text-zinc-100">{formatDateLabel(summary.loan_date)}</span>
        </div>
        <div>
          <span className="text-zinc-400">Sell Est:</span>{" "}
          <span className="text-zinc-100">
            {formatDateLabel(summary.sell_estimate_date)}
          </span>
        </div>
        <div>
          <span className="text-zinc-400">Investor:</span>{" "}
          <span className="text-zinc-100">{summary.investor_name || "—"}</span>
        </div>
        <div>
          <span className="text-zinc-400">Attorney:</span>{" "}
          <span className="text-zinc-100">{summary.attorney || "—"}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-600/60">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-zinc-700/60 bg-zinc-800/50">
              <td className="px-3 py-2 text-zinc-400">Capital Received</td>
              <td className="px-3 py-2 text-right text-zinc-100">
                {formatCurrency(summary.amount_loaned)}
              </td>
              <td className="px-3 py-2 text-zinc-400">12 Months</td>
              <td className="px-3 py-2 text-right text-zinc-100">
                {formatRate(summary.annual_interest_rate)}
              </td>
              <td className="px-3 py-2 text-zinc-400">Total Interest (12 mo)</td>
              <td className="px-3 py-2 text-right text-zinc-100">
                {formatCurrency(summary.total_interest_12_months)}
              </td>
            </tr>
            <tr className="border-b border-zinc-700/60">
              <td className="px-3 py-2 text-zinc-400">Days in Year</td>
              <td className="px-3 py-2 text-right text-zinc-100">{summary.days_in_year}</td>
              <td className="px-3 py-2 text-zinc-400">Interest Cost / Day</td>
              <td className="px-3 py-2 text-right text-zinc-100">
                {formatMoneyPrecise(summary.interest_cost_per_day)}
              </td>
              <td className="px-3 py-2 text-zinc-400">Days Held</td>
              <td className="px-3 py-2 text-right text-zinc-100">{summary.days_held}</td>
            </tr>
            <tr className="border-b border-zinc-700/60 bg-zinc-800/50">
              <td className="px-3 py-2 text-zinc-400">Interest w/o Kicker</td>
              <td className="px-3 py-2 text-right text-zinc-100">
                {formatMoneyPrecise(summary.interest_without_kicker)}
              </td>
              <td className="px-3 py-2 text-zinc-400">Kicker</td>
              <td className="px-3 py-2 text-right text-zinc-100">
                {formatCurrency(summary.kicker)}
              </td>
              <td className="px-3 py-2 text-zinc-400">Interest + Kicker</td>
              <td className="px-3 py-2 text-right text-emerald-300 font-medium">
                {formatMoneyPrecise(summary.interest_and_kicker_total)}
              </td>
            </tr>
            <tr className="bg-emerald-950/30 font-semibold">
              <td className="px-3 py-3 text-emerald-200" colSpan={5}>
                Total Payout
              </td>
              <td className="px-3 py-3 text-right text-emerald-300 text-base">
                {formatMoneyPrecise(summary.total_payout)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InvestorPayoutSummaryPanel({
  input,
  title = "Payout Calculator Summary",
  compact = false,
}: InvestorPayoutSummaryPanelProps) {
  const summary = computeInvestorPayoutLoanSummary(input);

  if (!summary) {
    return (
      <div className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 p-4">
        <h3 className="text-sm font-semibold text-emerald-300 mb-2">{title}</h3>
        <p className="text-sm text-zinc-400">
          Enter capital received, 12-month rate (e.g. 12%), loan date, and sell estimate to
          calculate payout totals.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-lg border border-zinc-600/60 bg-zinc-800/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-sm font-medium text-zinc-100">
            {summary.investor_name || "Investor"} · {summary.property_address || "Property"}
          </div>
          <div className="text-sm font-semibold text-emerald-300">
            {formatMoneyPrecise(summary.total_payout)}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-zinc-400">
          <div>Capital Received: {formatCurrency(summary.amount_loaned)}</div>
          <div>Days Held: {summary.days_held}</div>
          <div>Interest: {formatMoneyPrecise(summary.interest_without_kicker)}</div>
          <div>Kicker: {formatCurrency(summary.kicker)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-emerald-300 mb-4">{title}</h3>
      <SummaryGrid summary={summary} />
    </div>
  );
}