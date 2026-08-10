import { useMemo, useState } from "react";
import type { DateRange, SpendingChange, TimePeriod } from "../../types/reports";
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from "../../constants";
import { PeriodSelect } from "../ui/PeriodSelect";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";
import { UncategorizedLabel } from "../ui/UncategorizedLabel";
import { formatCategory } from "../../utils";
import { formatDateRange } from "../../utils/date";

interface Props {
  data: Record<TimePeriod, SpendingChange[]>;
  ranges: Record<TimePeriod, DateRange>;
}

export function SpendingBehaviour({ data, ranges }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const items = data[period];
  const range = ranges[period];
  const hasRange = range && range.from && range.to;
  const hasPreviousData = items.some((d) => d.previousAmount > 0);

  const maxVal = useMemo(
    () => Math.max(...items.flatMap((d) => [d.amount, d.previousAmount]), 1),
    [items],
  );

  const tip = useMemo(() => {
    if (items.length === 0) return "No spending recorded in this period yet.";
    const compared = items.filter((d) => d.previousAmount > 0);
    if (compared.length > 0) {
      const biggest = compared.reduce((a, b) =>
        Math.abs(b.changePercent) > Math.abs(a.changePercent) ? b : a,
      );
      if (biggest.changePercent !== 0) {
        const direction = biggest.changePercent > 0 ? "rose" : "fell";
        return `${formatCategory(biggest.category)} ${direction} ${Math.abs(biggest.changePercent)}% vs the previous period — the biggest change.`;
      }
    }
    const top = items.reduce((a, b) => (b.amount > a.amount ? b : a));
    return `${formatCategory(top.category)} leads this period's spending at \u20B9${top.amount.toLocaleString("en-IN")}.`;
  }, [items]);

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-card">
          <Icon name="spending-behaviour" size={14} /> Spending Behaviour
        </h2>
        <div className="flex items-center gap-2">
          {hasRange && (
            <span className="text-small">{formatDateRange(range)}</span>
          )}
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>
      </div>

      <p className="mb-4 text-small">
        {hasPreviousData
          ? period === "weekly" ? "This week vs last week"
            : period === "yearly" ? "This year vs last year"
            : "This month vs last month"
          : period === "weekly" ? "This week's spending by category"
            : period === "yearly" ? "This year's spending by category"
            : "This month's spending by category"}
      </p>

      {hasPreviousData && (
        <div className="mb-3 flex items-center gap-4 text-tiny">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-text)]/20" />
            <span className="text-[var(--color-text)]">Previous</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-ok)]" />
            <span className="text-[var(--color-text)]">Current</span>
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {items.map((item, index) => {
          const isUp = item.changePercent > 0;
          const isDown = item.changePercent < 0;
          const isSame = item.changePercent === 0;
          const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          const isHovered = hoveredCategory === item.category;

          const currentWidth = maxVal > 0 ? (item.amount / maxVal) * 100 : 0;
          const previousWidth = maxVal > 0 ? (item.previousAmount / maxVal) * 100 : 0;

          return (
            <div
              key={item.category}
              className="group cursor-default rounded-lg px-2 py-1.5 transition-colors duration-200 hover:bg-[var(--color-bg-deep)]"
              onMouseEnter={() => setHoveredCategory(item.category)}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-small text-[var(--color-text)] transition-colors duration-200 group-hover:text-[var(--color-text)]">
                  {CATEGORY_EMOJIS[item.category] ?? ""}{" "}
                  <UncategorizedLabel category={item.category}>
                    {formatCategory(item.category)}
                  </UncategorizedLabel>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-small font-medium text-[var(--color-text)]">
                    {'\u20B9'}{item.amount.toLocaleString("en-IN")}
                  </span>
                  {hasPreviousData && (
                    <span
                      className={`text-tiny font-medium ${
                        isUp ? "text-[var(--color-warn)]" : isDown ? "text-[var(--color-ok)]" : "text-[var(--color-text-muted)]"
                      }`}
                    >
                      {isSame ? "0%" : `${isUp ? "+" : ""}${item.changePercent}%`}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {hasPreviousData && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-hover)]">
                    <div
                      key={`prev-${item.category}-${item.previousAmount}`}
                      className="h-full rounded-full bg-[var(--color-text)]/20 animate-fill"
                      style={{ width: `${previousWidth}%` }}
                    />
                  </div>
                )}
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-hover)]">
                  <div
                    key={`curr-${item.category}-${item.amount}`}
                    className="h-full rounded-full animate-fill"
                    style={{
                      width: `${currentWidth}%`,
                      backgroundColor: color,
                      boxShadow: isHovered ? `0 0 6px ${color}` : "none",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-caption leading-relaxed text-[var(--color-text)]">
        <Icon name="tip" size={14} /> {tip}
      </p>

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "Comparing periods",
    description: "Each bar shows your spending in a category for this period. The faded bar behind it is the previous period for comparison, with the % change.",
  },
  {
    title: "Switching periods",
    description: "Weekly compares this week vs last week, Monthly vs last month, and Yearly vs last year — use the dropdown to switch.",
  },
  {
    title: "Biggest change",
    description: "The tip below highlights your biggest spending change — the category where you moved the most vs the previous period.",
  },
];
