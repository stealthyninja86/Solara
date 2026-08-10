import { DropdownSelect } from "./DropdownSelect";
import type { TimePeriod } from "../../types/reports";

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
    <DropdownSelect
      value={value}
      options={OPTIONS}
      onChange={(v) => onChange(v as TimePeriod)}
    />
  );
}
