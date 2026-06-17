"use client";

interface MultiSelectFilterProps {
  label: string;
  emptyLabel: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCountLabel?: string;
  minWidthClass?: string;
}

function filterLabel(
  selected: string[],
  emptyLabel: string,
  selectedCountLabel?: string
): string {
  if (selected.length === 0) return emptyLabel;
  if (selected.length === 1) return selected[0];
  if (selectedCountLabel) return `${selected.length} ${selectedCountLabel} selected`;
  return `${selected.length} selected`;
}

export default function MultiSelectFilter({
  label,
  emptyLabel,
  options,
  selected,
  onToggle,
  onClear,
  open,
  onOpenChange,
  selectedCountLabel,
  minWidthClass = "min-w-[11rem]",
}: MultiSelectFilterProps) {
  return (
    <div className="relative">
      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <span className="whitespace-nowrap">{label}</span>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={`form-select py-1.5 ${minWidthClass} text-left flex items-center justify-between gap-2`}
        >
          <span className="truncate">{filterLabel(selected, emptyLabel, selectedCountLabel)}</span>
          <span className="text-zinc-500 shrink-0" aria-hidden>
            ▾
          </span>
        </button>
      </label>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute right-0 z-50 mt-1 min-w-[12rem] max-h-64 overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-800 shadow-xl py-1"
        >
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700/70 cursor-pointer"
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
          {selected.length > 0 && (
            <div className="border-t border-zinc-700/70 px-3 py-2">
              <button
                type="button"
                onClick={onClear}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}