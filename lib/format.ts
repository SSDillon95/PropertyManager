export const CURRENCY_PLACEHOLDER = "$0.00";

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseCurrencyValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") {
    return null;
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function formatCurrencyInput(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  const num = typeof value === "number" ? value : parseCurrencyValue(String(value));
  if (num == null || Number.isNaN(num)) return "";
  return formatCurrency(num);
}

export function normalizeCurrencyInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const num = parseCurrencyValue(trimmed);
  if (num == null || Number.isNaN(num)) return "";
  return formatCurrency(num);
}

export function sanitizeCurrencyTyping(value: string): string {
  return value.replace(/[^0-9.$,-]/g, "");
}

export function formatCellValue(
  value: unknown,
  type:
    | "text"
    | "number"
    | "date"
    | "currency"
    | "select"
    | "property"
    | "tenant"
    | "investor"
    | "capital"
    | "business"
): string {
  if (value == null || value === "") return "";
  if (type === "currency") return formatCurrency(Number(value));
  if (type === "number") return String(value);
  return String(value);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}