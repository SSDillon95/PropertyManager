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

export const PERCENT_PLACEHOLDER = "0%";

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  const pct = value * 100;
  const text = Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2).replace(/\.?0+$/, "");
  return `${text}%`;
}

export function parsePercentValue(value: string): number | null {
  const trimmed = value.trim().replace(/%/g, "");
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") {
    return null;
  }
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num / 100;
}

export function formatPercentInput(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") return formatPercent(value);
  const str = String(value).trim();
  if (!str) return "";
  if (str.includes("%")) {
    const parsed = parsePercentValue(str);
    return parsed == null ? "" : formatPercent(parsed);
  }
  const direct = Number(str);
  if (!Number.isFinite(direct)) return "";
  if (direct > 0 && direct <= 1) return formatPercent(direct);
  return formatPercent(direct / 100);
}

export function normalizePercentInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const num = parsePercentValue(trimmed);
  if (num == null || Number.isNaN(num)) return "";
  return formatPercent(num);
}

export function sanitizePercentTyping(value: string): string {
  return value.replace(/[^0-9.%\-]/g, "");
}

export function formatCellValue(
  value: unknown,
  type:
    | "text"
    | "number"
    | "date"
    | "currency"
    | "percent"
    | "select"
    | "property"
    | "tenant"
    | "investor"
    | "capital"
    | "business"
): string {
  if (value == null || value === "") return "";
  if (type === "currency") return formatCurrency(Number(value));
  if (type === "percent") return formatPercent(Number(value));
  if (type === "number") return String(value);
  return String(value);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}