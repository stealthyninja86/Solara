import { useState, useRef, useEffect } from "react";
import { useThemeContext } from "../../context/ThemeProvider";
import type { ThemeChoice } from "../../context/ThemeProvider";

const OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "\u2600\uFE0F" },
  { value: "dark", label: "Dark", icon: "\u{1F319}" },
  { value: "system", label: "System", icon: "\u{1F4BB}" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useThemeContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const current = OPTIONS.find((option) => option.value === theme)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Change theme"
        className="mt-0! flex w-auto! cursor-pointer items-center gap-1.5 rounded-md bg-transparent! px-2! py-1! text-caption! text-[var(--color-text)]! transition-colors hover:bg-[var(--color-bg-hover)]!"
      >
        <span className="text-[0.85rem] leading-none">{current.icon}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-50">
          <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          <div className="px-3 py-2 text-tiny font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Theme
          </div>
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => { setTheme(option.value); setOpen(false); }}
              className={`mt-0! flex w-auto! cursor-pointer items-center gap-2.5 bg-transparent! px-3! py-2! text-caption! transition-colors hover:bg-[var(--color-bg-hover)]! ${
                theme === option.value
                  ? "text-[var(--color-text)]!"
                  : "text-[var(--color-text)]!"
              }`}
            >
              <span className="text-[0.85rem] leading-none">{option.icon}</span>
              <span className="flex-1 text-left">{option.label}</span>
              {theme === option.value && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[var(--color-text)]">
                  <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
