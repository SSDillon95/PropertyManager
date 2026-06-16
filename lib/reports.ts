import {
  loanSummaryFromPayout,
  type InvestorPayoutLoanSummary,
} from "./investor-payout-summary";
import type {
  Expense,
  InvestorPayout,
  MaintenanceRecord,
  Property,
  RentPayment,
} from "./types";

export type ReportKind = "pl" | "income" | "expense" | "vendor_payout" | "investor_payout";

export interface ReportFilters {
  startDate: string;
  endDate: string;
  propertyName?: string;
  investorName?: string;
}

function n(value: number | null | undefined): number {
  return value ?? 0;
}

export function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function monthsInRange(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.max(
    1,
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1
  );
}

export function defaultReportRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = now.toISOString().slice(0, 10);
  return { startDate, endDate };
}

function monthlyFixedCosts(property: Property): number {
  return (
    n(property.monthly_mortgage) +
    n(property.monthly_hoa) +
    n(property.annual_property_tax) / 12 +
    n(property.annual_insurance) / 12
  );
}

function matchesProperty(propertyName: string, filter?: string): boolean {
  return !filter || propertyName === filter;
}

function matchesInvestor(investorName: string, filter?: string): boolean {
  return !filter || investorName === filter;
}

export interface IncomeLine {
  date: string;
  property_name: string;
  tenant_name: string;
  amount_paid: number;
  late_fee: number;
  total: number;
  status: string;
}

export interface IncomeReport {
  period: ReportFilters;
  lines: IncomeLine[];
  byProperty: { property_name: string; total: number }[];
  totalIncome: number;
}

export function buildIncomeReport(
  payments: RentPayment[],
  filters: ReportFilters
): IncomeReport {
  const lines = payments
    .filter(
      (p) =>
        isDateInRange(p.date, filters.startDate, filters.endDate) &&
        matchesProperty(p.property_name, filters.propertyName)
    )
    .map((p) => ({
      date: p.date,
      property_name: p.property_name,
      tenant_name: p.tenant_name,
      amount_paid: n(p.amount_paid),
      late_fee: n(p.late_fee),
      total: n(p.amount_paid) + n(p.late_fee),
      status: p.status,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const propertyTotals = new Map<string, number>();
  for (const line of lines) {
    propertyTotals.set(
      line.property_name,
      (propertyTotals.get(line.property_name) ?? 0) + line.total
    );
  }

  const byProperty = [...propertyTotals.entries()]
    .map(([property_name, total]) => ({ property_name, total }))
    .sort((a, b) => b.total - a.total);

  return {
    period: filters,
    lines,
    byProperty,
    totalIncome: lines.reduce((sum, l) => sum + l.total, 0),
  };
}

export interface ExpenseLine {
  date: string;
  property_name: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
}

export interface ExpenseReport {
  period: ReportFilters;
  lines: ExpenseLine[];
  byProperty: { property_name: string; total: number }[];
  byCategory: { category: string; total: number }[];
  totalExpenses: number;
}

export function buildExpenseReport(
  expenses: Expense[],
  filters: ReportFilters
): ExpenseReport {
  const lines = expenses
    .filter(
      (e) =>
        isDateInRange(e.date, filters.startDate, filters.endDate) &&
        matchesProperty(e.property_name, filters.propertyName)
    )
    .map((e) => ({
      date: e.date,
      property_name: e.property_name,
      category: e.category,
      vendor: e.vendor ?? "",
      description: e.description ?? "",
      amount: n(e.amount),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const propertyTotals = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  for (const line of lines) {
    propertyTotals.set(
      line.property_name,
      (propertyTotals.get(line.property_name) ?? 0) + line.amount
    );
    categoryTotals.set(
      line.category,
      (categoryTotals.get(line.category) ?? 0) + line.amount
    );
  }

  return {
    period: filters,
    lines,
    byProperty: [...propertyTotals.entries()]
      .map(([property_name, total]) => ({ property_name, total }))
      .sort((a, b) => b.total - a.total),
    byCategory: [...categoryTotals.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
    totalExpenses: lines.reduce((sum, l) => sum + l.amount, 0),
  };
}

export interface PLPropertyRow {
  property_name: string;
  rentalIncome: number;
  operatingExpenses: number;
  fixedCosts: number;
  netPL: number;
}

export interface PLReport {
  period: ReportFilters;
  months: number;
  rows: PLPropertyRow[];
  totalIncome: number;
  totalOperatingExpenses: number;
  totalFixedCosts: number;
  netPL: number;
}

export function buildPLReport(
  properties: Property[],
  payments: RentPayment[],
  expenses: Expense[],
  filters: ReportFilters
): PLReport {
  const months = monthsInRange(filters.startDate, filters.endDate);
  const incomeReport = buildIncomeReport(payments, filters);
  const expenseReport = buildExpenseReport(expenses, filters);

  const incomeByProperty = new Map(
    incomeReport.byProperty.map((r) => [r.property_name, r.total])
  );
  const expenseByProperty = new Map(
    expenseReport.byProperty.map((r) => [r.property_name, r.total])
  );

  const propertyNames = new Set<string>();
  for (const p of properties) {
    if (matchesProperty(p.property_name, filters.propertyName)) {
      propertyNames.add(p.property_name);
    }
  }
  for (const name of incomeByProperty.keys()) {
    if (matchesProperty(name, filters.propertyName)) propertyNames.add(name);
  }
  for (const name of expenseByProperty.keys()) {
    if (matchesProperty(name, filters.propertyName)) propertyNames.add(name);
  }

  const propertyByName = new Map(properties.map((p) => [p.property_name, p]));

  const rows: PLPropertyRow[] = [...propertyNames]
    .sort()
    .map((property_name) => {
      const property = propertyByName.get(property_name);
      const rentalIncome = incomeByProperty.get(property_name) ?? 0;
      const operatingExpenses = expenseByProperty.get(property_name) ?? 0;
      const fixedCosts = property ? monthlyFixedCosts(property) * months : 0;
      return {
        property_name,
        rentalIncome,
        operatingExpenses,
        fixedCosts,
        netPL: rentalIncome - operatingExpenses - fixedCosts,
      };
    });

  const totalIncome = rows.reduce((s, r) => s + r.rentalIncome, 0);
  const totalOperatingExpenses = rows.reduce((s, r) => s + r.operatingExpenses, 0);
  const totalFixedCosts = rows.reduce((s, r) => s + r.fixedCosts, 0);

  return {
    period: filters,
    months,
    rows,
    totalIncome,
    totalOperatingExpenses,
    totalFixedCosts,
    netPL: totalIncome - totalOperatingExpenses - totalFixedCosts,
  };
}

export interface VendorPayoutLine {
  date: string;
  source: "Expense" | "Maintenance";
  vendor: string;
  property_name: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
}

export interface VendorPayoutReport {
  period: ReportFilters;
  lines: VendorPayoutLine[];
  byVendor: { vendor: string; total: number }[];
  byProperty: { property_name: string; total: number }[];
  totalPayouts: number;
}

export function buildVendorPayoutReport(
  expenses: Expense[],
  maintenance: MaintenanceRecord[],
  filters: ReportFilters
): VendorPayoutReport {
  const expenseLines: VendorPayoutLine[] = expenses
    .filter(
      (e) =>
        e.vendor?.trim() &&
        n(e.amount) > 0 &&
        isDateInRange(e.date, filters.startDate, filters.endDate) &&
        matchesProperty(e.property_name, filters.propertyName)
    )
    .map((e) => ({
      date: e.date,
      source: "Expense" as const,
      vendor: e.vendor!.trim(),
      property_name: e.property_name,
      category: e.category,
      description: e.description ?? "",
      amount: n(e.amount),
      payment_method: e.payment_method ?? "",
    }));

  const maintenanceLines: VendorPayoutLine[] = maintenance
    .filter((m) => {
      const vendor = m.vendor?.trim();
      const amount = n(m.actual_cost) || n(m.estimated_cost);
      const date = m.date_completed ?? m.date_reported;
      return (
        Boolean(vendor) &&
        amount > 0 &&
        isDateInRange(date, filters.startDate, filters.endDate) &&
        matchesProperty(m.property_name, filters.propertyName)
      );
    })
    .map((m) => ({
      date: m.date_completed ?? m.date_reported,
      source: "Maintenance" as const,
      vendor: m.vendor!.trim(),
      property_name: m.property_name,
      category: m.category,
      description: m.description,
      amount: n(m.actual_cost) || n(m.estimated_cost),
      payment_method: "",
    }));

  const lines = [...expenseLines, ...maintenanceLines].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const vendorTotals = new Map<string, number>();
  const propertyTotals = new Map<string, number>();
  for (const line of lines) {
    vendorTotals.set(line.vendor, (vendorTotals.get(line.vendor) ?? 0) + line.amount);
    propertyTotals.set(
      line.property_name,
      (propertyTotals.get(line.property_name) ?? 0) + line.amount
    );
  }

  return {
    period: filters,
    lines,
    byVendor: [...vendorTotals.entries()]
      .map(([vendor, total]) => ({ vendor, total }))
      .sort((a, b) => b.total - a.total),
    byProperty: [...propertyTotals.entries()]
      .map(([property_name, total]) => ({ property_name, total }))
      .sort((a, b) => b.total - a.total),
    totalPayouts: lines.reduce((sum, l) => sum + l.amount, 0),
  };
}

export interface InvestorPayoutReportLine {
  date: string;
  payout_id: string;
  property_name: string;
  property_address: string;
  investor_name: string;
  payout_type: string;
  payout_amount: number;
  payment_method: string;
  payment_date: string;
  tax_year: string;
  status: string;
  loanSummary: InvestorPayoutLoanSummary | null;
}

export interface InvestorPayoutReportSummary {
  period: ReportFilters;
  lines: InvestorPayoutReportLine[];
  byInvestor: { investor_name: string; total: number; count: number }[];
  byProperty: { property_name: string; total: number }[];
  byPayoutType: { payout_type: string; total: number }[];
  totalPayouts: number;
  calculatedTotalPayouts: number;
  loanSummaries: InvestorPayoutLoanSummary[];
}

export function buildInvestorPayoutReport(
  payouts: InvestorPayout[],
  filters: ReportFilters
): InvestorPayoutReportSummary {
  const lines = payouts
    .filter(
      (p) =>
        isDateInRange(p.date, filters.startDate, filters.endDate) &&
        matchesProperty(p.property_name, filters.propertyName) &&
        matchesInvestor(p.investor_name, filters.investorName)
    )
    .map((p) => {
      const loanSummary = loanSummaryFromPayout(p);
      return {
        date: p.date,
        payout_id: p.payout_id,
        property_name: p.property_name,
        property_address: p.property_address ?? "",
        investor_name: p.investor_name,
        payout_type: p.payout_type,
        payout_amount: n(p.payout_amount),
        payment_method: p.payment_method ?? "",
        payment_date: p.payment_date ?? "",
        tax_year: p.tax_year != null ? String(p.tax_year) : "",
        status: p.status,
        loanSummary,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const investorTotals = new Map<string, { total: number; count: number }>();
  const propertyTotals = new Map<string, number>();
  const typeTotals = new Map<string, number>();
  for (const line of lines) {
    const current = investorTotals.get(line.investor_name) ?? { total: 0, count: 0 };
    investorTotals.set(line.investor_name, {
      total: current.total + line.payout_amount,
      count: current.count + 1,
    });
    propertyTotals.set(
      line.property_name,
      (propertyTotals.get(line.property_name) ?? 0) + line.payout_amount
    );
    typeTotals.set(
      line.payout_type,
      (typeTotals.get(line.payout_type) ?? 0) + line.payout_amount
    );
  }

  return {
    period: filters,
    lines,
    byInvestor: [...investorTotals.entries()]
      .map(([investor_name, stats]) => ({
        investor_name,
        total: stats.total,
        count: stats.count,
      }))
      .sort((a, b) => b.total - a.total),
    byProperty: [...propertyTotals.entries()]
      .map(([property_name, total]) => ({ property_name, total }))
      .sort((a, b) => b.total - a.total),
    byPayoutType: [...typeTotals.entries()]
      .map(([payout_type, total]) => ({ payout_type, total }))
      .sort((a, b) => b.total - a.total),
    totalPayouts: lines.reduce((sum, l) => sum + l.payout_amount, 0),
    calculatedTotalPayouts: lines.reduce(
      (sum, l) => sum + (l.loanSummary?.total_payout ?? l.payout_amount),
      0
    ),
    loanSummaries: lines
      .map((l) => l.loanSummary)
      .filter((summary): summary is InvestorPayoutLoanSummary => summary != null),
  };
}