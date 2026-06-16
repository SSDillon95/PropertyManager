"use client";

import type { ColumnDef } from "@/lib/columns";
import { formatCellValue } from "@/lib/format";

interface SpreadsheetTableProps {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  onDelete: (id: number) => void;
  deletingId: number | null;
}

export default function SpreadsheetTable({
  columns,
  rows,
  onDelete,
  deletingId,
}: SpreadsheetTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-900 p-8 text-center text-zinc-500">
        No rows yet. Add your first entry using the form above.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead>
            <tr className="bg-amber-400 text-zinc-900">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-amber-500/40 text-xs uppercase tracking-wide"
                  style={{ minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={String(row.id)}
                className={`border-t border-white/10 ${
                  idx % 2 === 0 ? "bg-zinc-950/40" : "bg-zinc-900"
                } hover:bg-blue-950/30`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 whitespace-nowrap border-r border-white/5 text-zinc-200"
                  >
                    {formatCellValue(row[col.key], col.type)}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onDelete(Number(row.id))}
                    disabled={deletingId === Number(row.id)}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    {deletingId === Number(row.id) ? "..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}