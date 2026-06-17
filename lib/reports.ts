import {
  depositForAvailableProperty,
  formatBedBath,
  listAvailableProperties,
} from "./available-properties";
import {
  loanSummaryFromPayout,
  type InvestorPayoutLoanSummary,
} from "./investor-payout-summary";
import { isCapitalRecord, isPayoutRecord } from "./investor-records";
import type {
  Expense,
  InvestorPayout,
  Lease,
  Property,
  RentPayment,
} from "./types";

export type ReportKind =
  | "pl"
  | "income"
  | "expense"
  | "investor_capital"
  | "investor_payout"
  | "property_insurance"
  | "property_availability";

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

export interface InvestorCapitalReportLine {
  date: string;
  capital_id: string;
  property_name: string;
  property_address: string;
  investor_name: string;
  amount_loaned: number;
  annual_interest_rate: number;
  loan_date: string;
  sell_estimate_date: string;
  loanSummary: InvestorPayoutLoanSummary | null;
}

export interface InvestorCapitalReport {
  period: ReportFilters;
  lines: InvestorCapitalReportLine[];
  byInvestor: { investor_name: string; total_loaned: number; count: number }[];
  byProperty: { property_name: string; total_loaned: number }[];
  totalLoaned: number;
  calculatedTotalPayouts: number;
  loanSummaries: InvestorPayoutLoanSummary[];
}

export function buildInvestorCapitalReport(
  capitals: InvestorPayout[],
  filters: ReportFilters
): InvestorCapitalReport {
  const lines = capitals
    .filter(
      (p) =>
        isCapitalRecord(p) &&
        isDateInRange(p.date, filters.startDate, filters.endDate) &&
        matchesProperty(p.property_name, filters.propertyName) &&
        matchesInvestor(p.investor_name, filters.investorName)
    )
    .map((p) => {
      const loanSummary = loanSummaryFromPayout(p);
      return {
        date: p.date,
        capital_id: p.payout_id,
        property_name: p.property_name,
        property_address: p.property_address ?? "",
        investor_name: p.investor_name,
        amount_loaned: n(p.amount_loaned),
        annual_interest_rate: n(p.annual_interest_rate),
        loan_date: p.loan_date ?? "",
        sell_estimate_date: p.sell_estimate_date ?? "",
        loanSummary,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const investorTotals = new Map<string, { total_loaned: number; count: number }>();
  const propertyTotals = new Map<string, number>();
  for (const line of lines) {
    const current = investorTotals.get(line.investor_name) ?? { total_loaned: 0, count: 0 };
    investorTotals.set(line.investor_name, {
      total_loaned: current.total_loaned + line.amount_loaned,
      count: current.count + 1,
    });
    propertyTotals.set(
      line.property_name,
      (propertyTotals.get(line.property_name) ?? 0) + line.amount_loaned
    );
  }

  return {
    period: filters,
    lines,
    byInvestor: [...investorTotals.entries()]
      .map(([investor_name, stats]) => ({
        investor_name,
        total_loaned: stats.total_loaned,
        count: stats.count,
      }))
      .sort((a, b) => b.total_loaned - a.total_loaned),
    byProperty: [...propertyTotals.entries()]
      .map(([property_name, total_loaned]) => ({ property_name, total_loaned }))
      .sort((a, b) => b.total_loaned - a.total_loaned),
    totalLoaned: lines.reduce((sum, l) => sum + l.amount_loaned, 0),
    calculatedTotalPayouts: lines.reduce(
      (sum, l) => sum + (l.loanSummary?.total_payout ?? 0),
      0
    ),
    loanSummaries: lines
      .map((l) => l.loanSummary)
      .filter((summary): summary is InvestorPayoutLoanSummary => summary != null),
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
        isPayoutRecord(p) &&
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

export interface PropertyInsuranceReportFilters {
  businessName?: string;
  lienHolder?: string;
}

export interface PropertyInsuranceLine {
  property_name: string;
  property_address: string;
  business_name: string;
  lien_holder: string;
  year_built: number | null;
  sq_ft: number | null;
  property_value: number | null;
  annual_insurance: number | null;
  insurance_carrier_name: string | null;
  insurance_policy_number: string | null;
  missingInsurance: boolean;
}

export interface PropertyInsuranceReport {
  filters: PropertyInsuranceReportFilters;
  lines: PropertyInsuranceLine[];
  missingInsuranceCount: number;
}

export const NO_INSURANCE_ON_FILE = "No Insurance on file";

function formatPropertyAddress(property: Property): string {
  return [property.address, property.city, property.state, property.zip]
    .filter((part) => part?.trim())
    .join(", ");
}

export function hasInsuranceOnFile(property: Property): boolean {
  return Boolean(
    property.insurance_carrier_name?.trim() && property.insurance_policy_number?.trim()
  );
}

export function buildPropertyInsuranceReport(
  properties: Property[],
  filters: PropertyInsuranceReportFilters
): PropertyInsuranceReport {
  const lines = properties
    .filter((property) => {
      if (filters.businessName && property.business_name !== filters.businessName) {
        return false;
      }
      if (filters.lienHolder && property.lien_holder !== filters.lienHolder) {
        return false;
      }
      return true;
    })
    .map((property) => ({
      property_name: property.property_name,
      property_address: formatPropertyAddress(property),
      business_name: property.business_name?.trim() || "—",
      lien_holder: property.lien_holder?.trim() || "—",
      year_built: property.year_built,
      sq_ft: property.sq_ft,
      property_value: property.current_value,
      annual_insurance: property.annual_insurance,
      insurance_carrier_name: property.insurance_carrier_name,
      insurance_policy_number: property.insurance_policy_number,
      missingInsurance: !hasInsuranceOnFile(property),
    }))
    .sort((left, right) => left.property_name.localeCompare(right.property_name));

  return {
    filters,
    lines,
    missingInsuranceCount: lines.filter((line) => line.missingInsurance).length,
  };
}

export interface PropertyAvailabilityReportFilters {
  propertyName?: string;
  status?: string;
}

export interface PropertyAvailabilityLine {
  property_name: string;
  property_address: string;
  status: string;
  monthly_rent: number | null;
  deposit: number | null;
  bed_bath: string;
}

export interface PropertyAvailabilityReport {
  filters: PropertyAvailabilityReportFilters;
  lines: PropertyAvailabilityLine[];
  byStatus: { status: string; count: number }[];
  totalAvailable: number;
}

export function buildPropertyAvailabilityReport(
  properties: Property[],
  leases: Lease[],
  filters: PropertyAvailabilityReportFilters
): PropertyAvailabilityReport {
  let available = listAvailableProperties(properties);

  if (filters.propertyName) {
    available = available.filter((property) => property.property_name === filters.propertyName);
  }
  if (filters.status) {
    available = available.filter((property) => property.status === filters.status);
  }

  const lines = available.map((property) => ({
    property_name: property.property_name,
    property_address: [property.address, property.city].filter((part) => part?.trim()).join(", "),
    status: property.status,
    monthly_rent: property.monthly_rent,
    deposit: depositForAvailableProperty(property.property_name, leases),
    bed_bath: formatBedBath(property.bedrooms, property.bathrooms),
  }));

  const statusCounts = new Map<string, number>();
  for (const line of lines) {
    statusCounts.set(line.status, (statusCounts.get(line.status) ?? 0) + 1);
  }

  return {
    filters,
    lines,
    byStatus: [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((left, right) => left.status.localeCompare(right.status)),
    totalAvailable: lines.length,
  };
}