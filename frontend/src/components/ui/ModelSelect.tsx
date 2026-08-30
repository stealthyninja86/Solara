import { useEffect, useRef, useState } from "react";
import { useDropdownKeyboard } from "../../hooks/useDropdownKeyboard";
import type { ModelInfo } from "../../types";

interface Props {
  value: string;
  models: ModelInfo[];
  onChange: (value: string) => void;
  dashboardUrl?: string | null;
}

function formatContextWindow(tokens: number | null | undefined): string | null {
  if (!tokens) return null;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M tokens`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K tokens`;
  return `${tokens} tokens`;
}

export function ModelSelect({ value, models, onChange, dashboardUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const selected = models.find((m) => m.name === value);

  const { triggerRef, handleTriggerKeyDown, handleOptionKeyDown } = useDropdownKeyboard({
    itemCount: models.length,
    isOpen: open,
    activeIndex,
    setActiveIndex,
    onSelect: (index) => {
      const model = models[index];
      if (model) onChange(model.name);
      setOpen(false);
      triggerRef.current?.focus();
    },
    onClose: () => setOpen(false),
    onOpen: () => setOpen(true),
    listboxRef,
  });

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      const option = listboxRef.current?.children[activeIndex] as HTMLElement | undefined;
      option?.focus();
    }
  }, [open, activeIndex]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={ref} className="relative inline-block">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={handleTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex! items-center! gap-1 rounded-md! border border-[var(--color-border)]! bg-[var(--color-bg-deep)]! px-3! py-1.5! text-sm! text-[var(--color-text)]! hover:bg-[var(--color-bg-hover)]! focus:outline-none! w-auto! font-medium!"
        >
          <span className="truncate">{selected?.name ?? "Select"}</span>
          <svg className="h-3 w-3 opacity-50! text-[var(--color-text)]!" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5l3 3 3-3" />
          </svg>
        </button>
        {open && (
          <div
            ref={listboxRef}
            role="listbox"
            aria-label="Select model"
            className="absolute left-0 z-50 mt-1 min-w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-1 shadow-lg"
          >
            {models.map((model, index) => (
              <button
                key={model.name}
                type="button"
                role="option"
                aria-selected={model.name === value}
                tabIndex={-1}
                onClick={() => {
                  onChange(model.name);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                onKeyDown={(e) => handleOptionKeyDown(e, index)}
                className={`flex! w-full! items-center! gap-2! rounded! px-3! py-1.5! text-left! text-sm! bg-transparent! border-none! hover:bg-[var(--color-bg-hover)]! ${model.name === value ? "font-semibold! text-[var(--color-text)]!" : "text-[var(--color-text-secondary)]!"}`}
              >
                <span className="truncate">{model.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2 text-small text-[var(--color-text-secondary)]">
          {selected.description && selected.description !== selected.name && (
            <p>{selected.description}</p>
          )}
          {selected.contextWindow && (
            <p className="mt-1 text-tiny text-[var(--color-text-tertiary)]">
              Context: {formatContextWindow(selected.contextWindow)}
            </p>
          )}
          {dashboardUrl && (
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-tiny text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4.5 2.5h5.5v5.5M10 2L2 10" />
              </svg>
              Check pricing
            </a>
          )}
        </div>
      )}
    </div>
  );
}
