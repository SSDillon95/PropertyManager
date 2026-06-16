"use client";

import { PROPERTY_COLUMNS } from "@/lib/columns";
import { formatCellValue } from "@/lib/format";
import type { Property } from "@/lib/types";

interface PropertyDetailPanelProps {
  property: Property;
  onCollapse: () => void;
}

export default function PropertyDetailPanel({
  property,
  onCollapse,
}: PropertyDetailPanelProps) {
  return (
    <section className="rounded-xl border border-emerald-600/40 bg-zinc-800/95 p-4 sm:p-6 mb-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-lg text-zinc-100">{property.property_name}</h3>
          <p className="text-sm text-zinc-400 mt-0.5">
            Legal ID: {property.legal_id}
            {property.status ? ` · ${property.status}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="text-xs px-3 py-1.5 rounded-lg border border-zinc-600 bg-zinc-700/80 text-zinc-200 hover:bg-zinc-700 shrink-0"
        >
          Collapse
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {PROPERTY_COLUMNS.map((col) => (
          <div key={col.key} className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1">
              {col.label}
            </div>
            <div className="text-sm text-zinc-100 break-words">
              {formatCellValue(
                property[col.key as keyof Property],
                col.type
              ) || "—"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}