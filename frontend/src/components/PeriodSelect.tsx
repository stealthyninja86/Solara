import type { TimePeriod } from "../types/reports";

interface Props {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: "weekly", label: "This Week" },
  { value: "monthly", label: "This Month" },
  { value: "yearly", label: "This Year" },
];

export function PeriodSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as TimePeriod)}
      className="cursor-pointer appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-2.5 py-1 text-[0.7rem] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text)] focus:border-[var(--color-text-tertiary)] focus:outline-none"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
