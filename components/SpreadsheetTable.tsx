"use client";

import type { ColumnDef } from "@/lib/columns";
import { formatCellValue } from "@/lib/format";

interface SpreadsheetTableProps {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  archiveMode?: boolean;
  onArchive?: (id: number) => void;
  onRestore?: (id: number) => void;
  actionId: number | null;
  showProfitability?: boolean;
  onProfitability?: (row: Record<string, unknown>) => void;
}

export default function SpreadsheetTable({
  columns,
  rows,
  archiveMode = false,
  onArchive,
  onRestore,
  actionId,
  showProfitability = false,
  onProfitability,
}: SpreadsheetTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 p-8 text-center text-zinc-400">
        {archiveMode
          ? "No archived rows. Archive a row from the active list to see it here."
          : "No rows yet. Add your first entry using the form above."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-600/60 bg-zinc-800/90">
      <div className="table-scroll">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead>
            <tr className="bg-amber-400 text-zinc-900">
              {showProfitability && !archiveMode && (
                <th className="sticky left-0 z-20 px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-amber-500/40 text-xs uppercase tracking-wide bg-amber-400 min-w-[7.5rem]">
                  &nbsp;
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-amber-500/40 text-xs uppercase tracking-wide"
                  style={{ minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide min-w-[5.5rem]">
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
                {showProfitability && !archiveMode && (
                  <td
                    className={`sticky left-0 z-10 px-3 py-2 whitespace-nowrap border-r border-zinc-700/40 ${
                      idx % 2 === 0 ? "bg-zinc-800/95" : "bg-zinc-700/80"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onProfitability?.(row)}
                      className="text-xs px-2 py-1 rounded-md border border-emerald-600/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 whitespace-nowrap"
                    >
                      Profitability
                    </button>
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 whitespace-nowrap border-r border-zinc-700/40 text-zinc-200"
                  >
                    {formatCellValue(row[col.key], col.type)}
                  </td>
                ))}
                <td className="px-3 py-2">
                  {archiveMode ? (
                    <button
                      type="button"
                      onClick={() => onRestore?.(Number(row.id))}
                      disabled={actionId === Number(row.id)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 whitespace-nowrap"
                    >
                      {actionId === Number(row.id) ? "..." : "Restore"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onArchive?.(Number(row.id))}
                      disabled={actionId === Number(row.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 whitespace-nowrap"
                    >
                      {actionId === Number(row.id) ? "..." : "Archive"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}