import { Icon } from "./Icon";

interface Props {
  categories: { category: string }[];
}

export function UncategorizedTip({ categories }: Props) {
  const hasUncategorized = categories.some(
    (item) => item.category === "UNCATEGORIZED"
  );
  if (!hasUncategorized) return null;

  return (
    <p className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-small leading-relaxed">
      <Icon name="tip" size={12} /> If you see Uncategorized spending, the AI
      wasn't sure about those transactions — they've been put in review.
      Review them to view your data correctly.
    </p>
  );
}
