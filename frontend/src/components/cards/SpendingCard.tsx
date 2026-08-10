import { CATEGORY_EMOJIS, CATEGORY_COLORS } from "../../constants";
import { formatCategory } from "../../utils";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";
import { UncategorizedLabel } from "../ui/UncategorizedLabel";

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
      <h2 className="text-card"><Icon name="spending" size={16} /> Spending</h2>
      {top5.length === 0 ? (
        <div className="mt-4 text-center">
          <p className="text-caption text-[var(--color-text-muted)]">
            No spending data yet.
          </p>
          <p className="mt-1 text-[0.75rem] text-[var(--color-text-muted)]">
            Add transactions to see your spending breakdown by category.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {top5.map((item, index) => {
            const barWidth = maxAmount > 0 ? (item.total / maxAmount) * 100 : 0;
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <div key={item.category}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-caption text-[var(--color-text)]">
                    {CATEGORY_EMOJIS[item.category] ?? ""}{" "}
                    <UncategorizedLabel category={item.category}>
                      {formatCategory(item.category)}
                    </UncategorizedLabel>
                  </span>
                  <span className="text-caption font-medium text-[var(--color-text)]">
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
        <p className="mt-4 text-small">
          Total: {'\u20B9'}{totalSpend.toLocaleString("en-IN")}
        </p>
      )}

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "Top 5 categories",
    description: "Your top 5 spending categories for the month. The longest bar is your biggest expense.",
  },
  {
    title: "Total spend",
    description: "The total below the bars is everything you've spent this month across all categories.",
  },
  {
    title: "Keeping it current",
    description: "Updates as you add or import transactions — refresh to see the latest.",
  },
];
