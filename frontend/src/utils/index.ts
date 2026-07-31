import type { TransactionCategory } from "../types";
import { CATEGORY_EMOJIS } from "../constants";

export function categoryWithEmoji(category: TransactionCategory | null): string {
  if (!category) return "\u2014";
  const emoji = CATEGORY_EMOJIS[category];
  return emoji ? `${emoji} ${category}` : `\uD83D\uDCCB ${category}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}
