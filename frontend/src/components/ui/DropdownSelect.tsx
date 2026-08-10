import { useEffect, useRef, useState } from "react";

interface Option {
  value: string | number;
  label: string;
}

interface Props {
  value: string | number;
  options: Option[];
  onChange: (value: string | number) => void;
}

export function DropdownSelect({ value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex! items-center! gap-1 rounded-md! border border-[var(--color-border)]! bg-[var(--color-bg-deep)]! px-3! py-1.5! text-sm! text-[var(--color-text)]! hover:bg-[var(--color-bg-hover)]! focus:outline-none! w-auto! font-medium!"
      >
        {selected?.label ?? "Select"}
        <svg className="h-3 w-3 opacity-50! text-[var(--color-text)]!" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1 min-w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`block! w-full! rounded! px-3! py-1.5! text-left! text-sm! bg-transparent! border-none! hover:bg-[var(--color-bg-hover)]! ${opt.value === value ? "font-semibold! text-[var(--color-text)]!" : "text-[var(--color-text-secondary)]!"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
