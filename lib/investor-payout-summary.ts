import type { InvestorPayout } from "./types";

export interface InvestorPayoutLoanInput {
  property_address?: string | null;
  loan_date?: string | null;
  sell_estimate_date?: string | null;
  investor_name?: string | null;
  attorney?: string | null;
  amount_loaned?: number | null;
  annual_interest_rate?: number | null;
  kicker?: number | null;
  days_in_year?: number | null;
}

export interface InvestorPayoutLoanSummary {
  property_address: string;
  loan_date: string;
  sell_estimate_date: string;
  investor_name: string;
  attorney: string;
  amount_loaned: number;
  annual_interest_rate: number;
  total_interest_12_months: number;
  days_in_year: number;
  interest_cost_per_day: number;
  days_held: number;
  interest_without_kicker: number;
  kicker: number;
  interest_and_kicker_total: number;
  total_payout: number;
  isComplete: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseIsoDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? trimmed
    : null;
  if (iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function daysBetweenInclusive(start: string, end: string): number | null {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (!startDate || !endDate) return null;
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) return null;
  return Math.floor(diffMs / 86_400_000) + 1;
}

export function computeInvestorPayoutLoanSummary(
  input: InvestorPayoutLoanInput
): InvestorPayoutLoanSummary | null {
  const amountLoaned = input.amount_loaned;
  const annualRate = input.annual_interest_rate;
  const loanDate = input.loan_date?.trim() ?? "";
  const sellDate = input.sell_estimate_date?.trim() ?? "";
  const daysInYear = input.days_in_year ?? 365;

  if (
    amountLoaned == null ||
    !Number.isFinite(amountLoaned) ||
    amountLoaned <= 0 ||
    annualRate == null ||
    !Number.isFinite(annualRate) ||
    annualRate < 0 ||
    !loanDate ||
    !sellDate ||
    !Number.isFinite(daysInYear) ||
    daysInYear <= 0
  ) {
    return null;
  }

  const daysHeld = daysBetweenInclusive(loanDate, sellDate);
  if (daysHeld == null) return null;

  const totalInterest12Months = round2(amountLoaned * annualRate);
  const interestCostPerDayExact = totalInterest12Months / daysInYear;
  const interestCostPerDay = round2(interestCostPerDayExact);
  const interestWithoutKicker = round2(interestCostPerDayExact * daysHeld);
  const kicker = round2(input.kicker ?? 0);
  const interestAndKickerTotal = round2(interestWithoutKicker + kicker);
  const totalPayout = round2(amountLoaned + interestAndKickerTotal);

  return {
    property_address: input.property_address?.trim() ?? "",
    loan_date: loanDate,
    sell_estimate_date: sellDate,
    investor_name: input.investor_name?.trim() ?? "",
    attorney: input.attorney?.trim() ?? "",
    amount_loaned: amountLoaned,
    annual_interest_rate: annualRate,
    total_interest_12_months: totalInterest12Months,
    days_in_year: daysInYear,
    interest_cost_per_day: interestCostPerDay,
    days_held: daysHeld,
    interest_without_kicker: interestWithoutKicker,
    kicker,
    interest_and_kicker_total: interestAndKickerTotal,
    total_payout: totalPayout,
    isComplete: true,
  };
}

export function loanInputFromPayout(
  payout: Pick<
    InvestorPayout,
    | "property_address"
    | "loan_date"
    | "sell_estimate_date"
    | "investor_name"
    | "attorney"
    | "amount_loaned"
    | "annual_interest_rate"
    | "kicker"
    | "days_in_year"
  >
): InvestorPayoutLoanInput {
  return {
    property_address: payout.property_address,
    loan_date: payout.loan_date,
    sell_estimate_date: payout.sell_estimate_date,
    investor_name: payout.investor_name,
    attorney: payout.attorney,
    amount_loaned: payout.amount_loaned,
    annual_interest_rate: payout.annual_interest_rate,
    kicker: payout.kicker,
    days_in_year: payout.days_in_year,
  };
}

export function loanSummaryFromPayout(
  payout: Pick<
    InvestorPayout,
    | "property_address"
    | "loan_date"
    | "sell_estimate_date"
    | "investor_name"
    | "attorney"
    | "amount_loaned"
    | "annual_interest_rate"
    | "kicker"
    | "days_in_year"
  >
): InvestorPayoutLoanSummary | null {
  return computeInvestorPayoutLoanSummary(loanInputFromPayout(payout));
}

export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

export function formatMoneyPrecise(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}