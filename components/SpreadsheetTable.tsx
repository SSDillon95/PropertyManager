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
      <div className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 p-8 text-center text-zinc-400">
        No rows yet. Add your first entry using the form above.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-600/60 overflow-hidden bg-zinc-800/90">
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
                className={`border-t border-zinc-700/60 ${
                  idx % 2 === 0 ? "bg-zinc-800/50" : "bg-zinc-700/30"
                } hover:bg-emerald-950/20`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 whitespace-nowrap border-r border-zinc-700/40 text-zinc-200"
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