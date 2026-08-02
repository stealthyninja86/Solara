import { CATEGORY_EMOJIS, CATEGORY_COLORS } from "../constants";
import { Icon } from "./Icon";

interface SpendingCategory {
  category: string;
  total: number;
}

interface Props {
  categories: SpendingCategory[];
  totalSpend: number;
}

export function SpendingCard({ categories, totalSpend }: Props) {
  const top5 = categories.slice(0, 5);
  const maxAmount = top5[0]?.total ?? 0;

  return (
    <div className="card h-full rounded-2xl p-10">
      <h2 className="text-[1rem] font-medium text-[var(--color-text)]"><Icon name="spending" size={16} /> Spending</h2>
      {top5.length === 0 ? (
        <p className="mt-4 text-[0.85rem] text-[var(--color-text-muted)]">No spending yet this month.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {top5.map((item, index) => {
            const barWidth = maxAmount > 0 ? (item.total / maxAmount) * 100 : 0;
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <div key={item.category}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[0.8rem] text-[var(--color-text-dim)]">
                    {CATEGORY_EMOJIS[item.category] ?? ""}{" "}
                    {item.category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="text-[0.8rem] font-medium text-[var(--color-text)]">
                    {'\u20B9'}{item.total.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-hover)]">
                  <div
                    key={`${item.category}-${item.total}`}
                    className="h-full rounded-full animate-fill"
                    style={{ width: `${barWidth}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {totalSpend > 0 && (
        <p className="mt-4 text-[0.75rem] text-[var(--color-text-muted)]">
          Total: {'\u20B9'}{totalSpend.toLocaleString("en-IN")}
        </p>
      )}
    </div>
  );
}
