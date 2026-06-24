"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  disabledReason?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  disabled?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  emptyMessage = "No matches",
  searchPlaceholder = "Search...",
}: SearchableSelectProps) {
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

  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";

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

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
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
        <span className={`truncate ${value ? "" : "text-zinc-400"}`}>
          {value ? selectedLabel : placeholder}
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          id={listboxId}
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
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-700/70 ${
                    option.value === value
                      ? "bg-emerald-900/40 text-emerald-300"
                      : "text-zinc-200"
                  }`}
                >
                  <span>{option.label}</span>
                  {option.sublabel ? (
                    <span className="block text-xs text-zinc-400 truncate">{option.sublabel}</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}