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
      <div className="rounded-xl border border-slate-200 bg-white/95 shadow-sm p-8 text-center text-slate-500">
        No rows yet. Add your first entry using the form above.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white/95 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead>
            <tr className="bg-amber-300 text-slate-900">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-amber-400/50 text-xs uppercase tracking-wide"
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
                className={`border-t border-slate-200 ${
                  idx % 2 === 0 ? "bg-slate-50" : "bg-white"
                } hover:bg-emerald-50/60`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 whitespace-nowrap border-r border-slate-100 text-slate-800"
                  >
                    {formatCellValue(row[col.key], col.type)}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onDelete(Number(row.id))}
                    disabled={deletingId === Number(row.id)}
                    className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
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