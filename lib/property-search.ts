import type { ColumnDef } from "@/lib/columns";
import { formatCellValue } from "@/lib/format";

export function propertyRowMatchesSearch(
  row: Record<string, unknown>,
  query: string,
  columns: ColumnDef[]
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return columns.some((column) => {
    const value = row[column.key];
    if (value == null || value === "") return false;

    const rawText = String(value).toLowerCase();
    if (rawText.includes(normalizedQuery)) return true;

    const formattedText = formatCellValue(value, column.type).toLowerCase();
    return formattedText.includes(normalizedQuery);
  });
}