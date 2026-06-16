export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCellValue(
  value: unknown,
  type: "text" | "number" | "date" | "currency" | "select" | "property" | "tenant" | "investor"
): string {
  if (value == null || value === "") return "";
  if (type === "currency") return formatCurrency(Number(value));
  if (type === "number") return String(value);
  return String(value);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}