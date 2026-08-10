import type { TransactionCategory } from "../types";
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from "../constants";

export function formatCategory(category: string): string {
  return CATEGORY_LABELS[category] ?? category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function categoryWithEmoji(category: TransactionCategory | null): string {
  if (!category) return "\u2014";
  const emoji = CATEGORY_EMOJIS[category];
  return emoji ? `${emoji} ${formatCategory(category)}` : `\uD83D\uDCCB ${formatCategory(category)}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatFilterDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}
