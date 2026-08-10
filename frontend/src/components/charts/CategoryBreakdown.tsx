import { useMemo, useState } from "react";
import type { DateRange, SpendingChange, TimePeriod } from "../../types/reports";
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from "../../constants";
import { PeriodSelect } from "../ui/PeriodSelect";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";
import { UncategorizedTip } from "../ui/UncategorizedTip";
import { UncategorizedLabel, UNCATEGORIZED_TIP } from "../ui/UncategorizedLabel";
import { formatCategory } from "../../utils";
import { formatDateRange } from "../../utils/date";

interface Props {
  data: Record<TimePeriod, SpendingChange[]>;
  ranges: Record<TimePeriod, DateRange>;
}

export function CategoryBreakdown({ data, ranges }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const items = data[period];
  const range = ranges[period];
  const hasRange = range && range.from && range.to;

  const total = useMemo(() => items.reduce((sum, d) => sum + d.amount, 0), [items]);
  const hasPreviousData = items.some((d) => d.previousAmount > 0);

  const size = 120;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;
  const segments = items.map((item, index) => {
    const pct = total > 0 ? (item.amount / total) * 100 : 0;
    const dashArray = `${(pct / 100) * circumference} ${circumference}`;
    const dashOffset = -(accumulatedPercent / 100) * circumference;
    accumulatedPercent += pct;
    const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
    return { ...item, pct, dashArray, dashOffset, color };
  });

  const tip = useMemo(() => {
    if (items.length === 0) return "No spending recorded yet for this period.";
    if (total === 0) return "No spending recorded yet for this period.";
    const top = items.reduce((a, b) => (b.amount > a.amount ? b : a));
    const pct = Math.round((top.amount / total) * 100);
    if (pct >= 25) {
      const cut = Math.round(top.amount * 0.1);
      return `${formatCategory(top.category)} is ${pct}% of spending — a 10% cut frees ~\u20B9${cut.toLocaleString("en-IN")}.`;
    }
    return "Spending is spread evenly — no single category dominates.";
  }, [items, total]);

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-card">
          <Icon name="category-breakdown" size={14} /> Category Breakdown
        </h2>
        <div className="flex items-center gap-2">
          {hasRange && (
            <span className="text-small">{formatDateRange(range)}</span>
          )}
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>
      </div>

      <p className="mb-4 text-small">
        {hasPreviousData ? "Comparing with previous period" : "Spending by category"}
      </p>

      <div className="flex items-center gap-6">
        <div className="relative shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-bg-hover)" strokeWidth={strokeWidth} />
            {segments.map((seg, i) => (
              <circle
                key={`${seg.category}-${seg.amount}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={hoveredCategory === seg.category ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.dashOffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="animate-fill"
                style={{
                  opacity: hoveredCategory && hoveredCategory !== seg.category ? 0.3 : 1,
                  filter: hoveredCategory === seg.category ? `drop-shadow(0 0 4px ${seg.color})` : "none",
                  animationDelay: `${i * 0.1}s`,
                }}
                onMouseEnter={() => setHoveredCategory(seg.category)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                {seg.category === "UNCATEGORIZED" && <title>{UNCATEGORIZED_TIP}</title>}
              </circle>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-tiny">Total</span>
            <span className="text-small font-bold text-[var(--color-text)]">
              {'\u20B9'}{(total / 1000).toFixed(1)}k
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          {segments.map((seg) => (
            <div
              key={seg.category}
              className="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-0.5 transition-colors duration-200 hover:bg-[var(--color-bg-deep)]"
              onMouseEnter={() => setHoveredCategory(seg.category)}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <span
                className="inline-block h-2 w-2 rounded-full transition-all duration-200"
                style={{
                  background: seg.color,
                  boxShadow: hoveredCategory === seg.category ? `0 0 6px ${seg.color}` : "none",
                  transform: hoveredCategory === seg.category ? "scale(1.3)" : "scale(1)",
                }}
              />
              <span className="flex-1 text-small text-[var(--color-text)] transition-colors duration-200 group-hover:text-[var(--color-text)]">
                {CATEGORY_EMOJIS[seg.category] ?? ""}{" "}
                <UncategorizedLabel category={seg.category}>{formatCategory(seg.category)}</UncategorizedLabel>
              </span>
              <span className="text-small font-medium text-[var(--color-text)]">{Math.round(seg.pct)}%</span>
            </div>
          ))}
        </div>
      </div>

      <UncategorizedTip categories={items} />

      <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-caption leading-relaxed text-[var(--color-text)]">
        <Icon name="tip" size={14} /> {tip}
      </p>

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "The donut",
    description: "Each slice is a category's share of your spending. The center shows the total across all categories.",
  },
  {
    title: "Hover to explore",
    description: "Hover over a slice or a row to highlight that category and see its exact percentage.",
  },
  {
    title: "Uncategorized",
    description: "Uncategorized transactions show as \"Other\" — categorize them for a more accurate picture.",
  },
];
