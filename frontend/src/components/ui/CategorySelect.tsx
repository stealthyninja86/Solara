import { useEffect, useRef, useState } from "react";
import { CATEGORY_DESCRIPTIONS, SUGGESTED_CATEGORIES } from "../../constants";
import { formatCategory } from "../../utils";
import type { TransactionCategory } from "../../types";

interface Props {
  value: TransactionCategory | "";
  onChange: (value: TransactionCategory | "") => void;
  placeholder?: string;
}

export function CategorySelect({ value, onChange, placeholder = "Keep suggestion" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = value ? formatCategory(value) : placeholder;
  const selectedDescription = value ? CATEGORY_DESCRIPTIONS[value] : "";

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-2.5 py-1.5 text-left text-[0.8rem] text-[var(--color-text)] outline-none transition-colors hover:border-[var(--color-text-tertiary)] focus:border-[var(--color-text-tertiary)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedLabel}</span>
        <svg className="ml-2 h-3 w-3 shrink-0 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {selectedDescription && (
        <p className="mt-1 text-[0.65rem] leading-snug text-[var(--color-text-muted)]">{selectedDescription}</p>
      )}
      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-lg"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === ""}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`block w-full rounded px-3 py-2 text-left hover:bg-[var(--color-bg-hover)] ${value === "" ? "bg-[var(--color-bg-hover)] font-semibold text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"}`}
          >
            <span className="text-[0.8rem]">{placeholder}</span>
            <span className="mt-0.5 block text-[0.65rem] text-[var(--color-text-muted)]">Keep the AI suggestion</span>
          </button>
          {SUGGESTED_CATEGORIES.map((category) => {
            const isSelected = value === category;
            return (
              <button
                key={category}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(category);
                  setOpen(false);
                }}
                className={`block w-full rounded px-3 py-2 text-left hover:bg-[var(--color-bg-hover)] ${isSelected ? "bg-[var(--color-bg-hover)] font-semibold text-[var(--color-text)]" : "text-[var(--color-text)]"}`}
              >
                <span className="text-[0.8rem]">{formatCategory(category)}</span>
                <span className="mt-0.5 block text-[0.65rem] leading-snug text-[var(--color-text-muted)]">
                  {CATEGORY_DESCRIPTIONS[category]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
