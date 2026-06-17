"use client";

import type { ColumnDef } from "@/lib/columns";
import { formatCellValue } from "@/lib/format";
import { entryCodeButtonLabel } from "@/lib/property-entry-code";

interface SpreadsheetTableProps {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  archiveMode?: boolean;
  onArchive?: (id: number) => void;
  onRestore?: (id: number) => void;
  actionId: number | null;
  showProfitability?: boolean;
  onProfitability?: (row: Record<string, unknown>) => void;
  showExpand?: boolean;
  onExpand?: (row: Record<string, unknown>) => void;
  showPrintForm?: boolean;
  onPrintForm?: (row: Record<string, unknown>) => void;
  printFormId?: number | null;
  showEdit?: boolean;
  onEdit?: (row: Record<string, unknown>) => void;
  editingId?: number | null;
  showEntryCode?: boolean;
  onEntryCode?: (row: Record<string, unknown>) => void;
  entryCodeActionId?: number | null;
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
  showExpand = false,
  onExpand,
  showPrintForm = false,
  onPrintForm,
  printFormId = null,
  showEdit = false,
  onEdit,
  editingId = null,
  showEntryCode = false,
  onEntryCode,
  entryCodeActionId = null,
}: SpreadsheetTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-600/60 bg-zinc-800/90 p-8 text-center text-zinc-400">
        {archiveMode
          ? "No archived rows. Archive a row from the active list to see it here."
          : "No rows yet. Click Add Row to enter your first record."}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-600/60 bg-zinc-800/90">
      <div className="table-scroll">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead>
            <tr className="bg-amber-400 text-zinc-900">
              {(showProfitability || showExpand) && !archiveMode && (
                <th className="sticky left-0 z-20 px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-amber-500/40 text-xs uppercase tracking-wide bg-amber-400 min-w-[11rem]">
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
              <th
                className={`px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide ${
                  showPrintForm || showEdit || showEntryCode ? "min-w-[9.5rem]" : "min-w-[5.5rem]"
                }`}
              >
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
                {(showProfitability || showExpand) && !archiveMode && (
                  <td
                    className={`sticky left-0 z-10 px-3 py-2 whitespace-nowrap border-r border-zinc-700/40 ${
                      idx % 2 === 0 ? "bg-zinc-800/95" : "bg-zinc-700/80"
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      {showProfitability && (
                        <button
                          type="button"
                          onClick={() => onProfitability?.(row)}
                          className="text-xs px-2 py-1 rounded-md border border-emerald-600/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 whitespace-nowrap"
                        >
                          Profitability
                        </button>
                      )}
                      {showExpand && (
                        <button
                          type="button"
                          onClick={() => onExpand?.(row)}
                          className="text-xs px-2 py-1 rounded-md border border-sky-600/60 bg-sky-950/40 text-sky-300 hover:bg-sky-900/50 whitespace-nowrap"
                        >
                          Expand
                        </button>
                      )}
                    </div>
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
                    <div className="flex flex-col gap-1">
                      {showEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit?.(row)}
                          disabled={editingId === Number(row.id)}
                          className={`text-xs px-2 py-1 rounded-md border whitespace-nowrap disabled:opacity-50 ${
                            editingId === Number(row.id)
                              ? "border-sky-600/60 bg-sky-950/40 text-sky-300"
                              : "border-sky-600/60 bg-sky-950/40 text-sky-300 hover:bg-sky-900/50"
                          }`}
                        >
                          {editingId === Number(row.id) ? "..." : "Edit"}
                        </button>
                      )}
                      {showEntryCode && (
                        <button
                          type="button"
                          onClick={() => onEntryCode?.(row)}
                          disabled={entryCodeActionId === Number(row.id)}
                          className="text-xs px-2 py-1 rounded-md border border-red-600/60 bg-red-950/40 text-red-300 hover:bg-red-900/50 whitespace-nowrap disabled:opacity-50"
                        >
                          {entryCodeActionId === Number(row.id)
                            ? "..."
                            : entryCodeButtonLabel(
                                typeof row.entry_code === "string" ? row.entry_code : null
                              )}
                        </button>
                      )}
                      {showPrintForm && (
                        <button
                          type="button"
                          onClick={() => onPrintForm?.(row)}
                          disabled={printFormId === Number(row.id)}
                          className="text-xs px-2 py-1 rounded-md border border-emerald-600/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 whitespace-nowrap disabled:opacity-50"
                        >
                          {printFormId === Number(row.id) ? "..." : "Print Form"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onArchive?.(Number(row.id))}
                        disabled={actionId === Number(row.id)}
                        className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 whitespace-nowrap"
                      >
                        {actionId === Number(row.id) ? "..." : "Archive"}
                      </button>
                    </div>
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