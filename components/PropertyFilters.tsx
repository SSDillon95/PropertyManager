"use client";

interface PropertyFiltersProps {
  businessOptions: string[];
  businessSelected: string[];
  onBusinessToggle: (value: string) => void;
  typeOptions: readonly string[];
  typeSelected: string[];
  onTypeToggle: (value: string) => void;
  statusOptions: readonly string[];
  statusSelected: string[];
  onStatusToggle: (value: string) => void;
  onClearAll: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function filterSummary(
  businessSelected: string[],
  typeSelected: string[],
  statusSelected: string[]
): string {
  const parts: string[] = [];
  if (businessSelected.length > 0) {
    parts.push(
      businessSelected.length === 1
        ? businessSelected[0]
        : `${businessSelected.length} businesses`
    );
  }
  if (typeSelected.length > 0) {
    parts.push(
      typeSelected.length === 1 ? typeSelected[0] : `${typeSelected.length} types`
    );
  }
  if (statusSelected.length > 0) {
    parts.push(
      statusSelected.length === 1 ? statusSelected[0] : `${statusSelected.length} statuses`
    );
  }
  if (parts.length === 0) return "All properties";
  if (parts.length === 1) return parts[0];
  return `${parts.length} filters active`;
}

function FilterSection({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="py-2">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
        {title}
      </p>
      {options.map((option) => (
        <label
          key={option}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700/70 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
            className="rounded border-zinc-500"
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

export default function PropertyFilters({
  businessOptions,
  businessSelected,
  onBusinessToggle,
  typeOptions,
  typeSelected,
  onTypeToggle,
  statusOptions,
  statusSelected,
  onStatusToggle,
  onClearAll,
  open,
  onOpenChange,
}: PropertyFiltersProps) {
  const activeCount =
    businessSelected.length + typeSelected.length + statusSelected.length;
  const summary = filterSummary(businessSelected, typeSelected, statusSelected);

  return (
    <div className="relative">
      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <span className="whitespace-nowrap">Filter</span>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="form-select py-1.5 min-w-[12rem] text-left flex items-center justify-between gap-2"
        >
          <span className="truncate">{summary}</span>
          <span className="text-zinc-500 shrink-0" aria-hidden>
            ▾
          </span>
        </button>
        {activeCount > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300 border border-emerald-600/40">
            {activeCount}
          </span>
        )}
      </label>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute right-0 z-50 mt-1 w-64 max-h-80 overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-800 shadow-xl py-1"
        >
          <FilterSection
            title="Business"
            options={businessOptions}
            selected={businessSelected}
            onToggle={onBusinessToggle}
          />
          <div className="border-t border-zinc-700/70" />
          <FilterSection
            title="Property Type"
            options={typeOptions}
            selected={typeSelected}
            onToggle={onTypeToggle}
          />
          <div className="border-t border-zinc-700/70" />
          <FilterSection
            title="Status"
            options={statusOptions}
            selected={statusSelected}
            onToggle={onStatusToggle}
          />
          {activeCount > 0 && (
            <div className="border-t border-zinc-700/70 px-3 py-2">
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}