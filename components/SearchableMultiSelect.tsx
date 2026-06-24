"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SearchableSelectOption } from "@/components/SearchableSelect";

interface SearchableMultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  disabled?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
}

function selectionSummary(values: string[], placeholder: string): string {
  if (values.length === 0) return placeholder;
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]}, ${values[1]}`;
  return `${values.length} properties selected`;
}

export default function SearchableMultiSelect({
  values,
  onChange,
  options,
  placeholder,
  disabled = false,
  emptyMessage = "No matches",
  searchPlaceholder = "Search...",
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        (option.sublabel?.toLowerCase().includes(query) ?? false)
    );
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const toggleValue = (optionValue: string) => {
    const option = options.find((item) => item.value === optionValue);
    if (option?.disabled && !values.includes(optionValue)) return;
    if (values.includes(optionValue)) {
      onChange(values.filter((value) => value !== optionValue));
      return;
    }
    onChange([...values, optionValue]);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`form-select w-full text-left flex items-center justify-between gap-2 ${
          disabled ? "text-zinc-400 cursor-not-allowed bg-zinc-700/50" : ""
        }`}
      >
        <span className={`truncate ${values.length > 0 ? "" : "text-zinc-400"}`}>
          {selectionSummary(values, placeholder)}
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          id={listboxId}
          aria-multiselectable="true"
          className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-zinc-600 bg-zinc-800 shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-zinc-700/70">
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="form-field py-1.5 h-9 text-sm"
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">{emptyMessage}</p>
            ) : (
              filteredOptions.map((option) => {
                const checked = values.includes(option.value);
                const isDisabled = Boolean(option.disabled) && !checked;
                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-2 px-3 py-2 text-sm ${
                      isDisabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-zinc-700/70 cursor-pointer"
                    } ${checked ? "bg-emerald-900/20" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isDisabled}
                      onChange={() => toggleValue(option.value)}
                      className="mt-0.5 rounded border-zinc-500 disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0">
                      <span
                        className={
                          checked
                            ? "text-emerald-300"
                            : isDisabled
                              ? "text-zinc-500"
                              : "text-zinc-200"
                        }
                      >
                        {option.label}
                      </span>
                      {option.sublabel ? (
                        <span className="block text-xs text-zinc-400 truncate">
                          {option.sublabel}
                        </span>
                      ) : null}
                      {isDisabled && option.disabledReason ? (
                        <span className="block text-xs text-zinc-500 truncate">
                          {option.disabledReason}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {values.length > 0 && (
            <div className="border-t border-zinc-700/70 px-3 py-2">
              <button
                type="button"
                onClick={() => onChange([])}
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