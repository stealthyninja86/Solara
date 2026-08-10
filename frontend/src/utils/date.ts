import type { DateRange } from "../types/reports";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseIsoDate(value: string): { day: number; month: number; year: number } {
  const parts = value.split("-").map(Number);
  const [year, month, day] = parts as [number, number, number];
  return { day, month: month - 1, year };
}

export function formatDateRange(range: DateRange): string {
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);

  if (from.year !== to.year) {
    return `${from.day} ${MONTH_SHORT[from.month]} ${from.year} \u2013 ${to.day} ${MONTH_SHORT[to.month]} ${to.year}`;
  }
  if (from.month !== to.month) {
    return `${from.day} ${MONTH_SHORT[from.month]} \u2013 ${to.day} ${MONTH_SHORT[to.month]} ${to.year}`;
  }
  return `${from.day} \u2013 ${to.day} ${MONTH_SHORT[from.month]} ${to.year}`;
}
