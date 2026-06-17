"use client";

import { getPropertyFormSections } from "@/lib/columns";
import { formatCellValue } from "@/lib/format";
import { entryCodeButtonLabel } from "@/lib/property-entry-code";
import type { ColumnDef } from "@/lib/columns";
import type { Property } from "@/lib/types";

interface PropertyDetailPanelProps {
  property: Property;
  onCollapse: () => void;
  onEdit: () => void;
  onEntryCode: () => void;
  onArchive: () => void;
  archiving?: boolean;
}

function PropertyFieldGrid({
  columns,
  property,
}: {
  columns: ColumnDef[];
  property: Property;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {columns.map((col) => (
        <div key={col.key} className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1">
            {col.label}
          </div>
          <div className="text-sm text-zinc-100 break-words">
            {formatCellValue(property[col.key as keyof Property], col.type) || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PropertyDetailPanel({
  property,
  onCollapse,
  onEdit,
  onEntryCode,
  onArchive,
  archiving = false,
}: PropertyDetailPanelProps) {
  const sections = getPropertyFormSections();

  return (
    <section className="rounded-xl border border-emerald-600/40 bg-zinc-800/95 p-4 sm:p-6 mb-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-lg text-zinc-100">{property.property_name}</h3>
          <p className="text-sm text-zinc-400 mt-0.5">
            Legal ID: {property.legal_id}
            {property.business_name ? ` · ${property.business_name}` : ""}
            {property.status ? ` · ${property.status}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEntryCode}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-600/60 bg-red-950/40 text-red-300 hover:bg-red-900/50"
          >
            {entryCodeButtonLabel(property.entry_code)}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="text-xs px-3 py-1.5 rounded-lg border border-sky-600/60 bg-sky-950/40 text-sky-300 hover:bg-sky-900/50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onArchive}
            disabled={archiving}
            className="text-xs px-3 py-1.5 rounded-lg border border-amber-600/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 disabled:opacity-50"
          >
            {archiving ? "..." : "Archive"}
          </button>
          <button
            type="button"
            onClick={onCollapse}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-600 bg-zinc-700/80 text-zinc-200 hover:bg-zinc-700"
          >
            Collapse
          </button>
        </div>
      </div>
      <div className="space-y-5">
        <div className="rounded-xl border-2 border-emerald-700/50 bg-zinc-900/40 p-4 sm:p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-300 mb-4">
            Property Information
          </h4>
          <PropertyFieldGrid columns={sections.informationColumns} property={property} />
        </div>
        <div className="rounded-xl border border-zinc-600/70 bg-zinc-800/50 p-4 sm:p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-4">
            Financial
          </h4>
          <PropertyFieldGrid columns={sections.financialColumns} property={property} />
        </div>
      </div>
    </section>
  );
}