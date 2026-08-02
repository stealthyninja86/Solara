import { useState, useMemo } from "react";
import type { SpendingChange, TimePeriod } from "../types/reports";
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from "../constants";
import { PeriodSelect } from "./PeriodSelect";
import { Icon } from "./Icon";

interface Props {
  data: Record<TimePeriod, SpendingChange[]>;
}

function formatCategory(category: string): string {
  return category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PERIOD_TIPS: Record<TimePeriod, string> = {
  weekly: "Compare this week to last week to spot spending habits early.",
  monthly: "Compare this month to last month to track progress toward your goals.",
  yearly: "Compare this year to last year to see long-term trends.",
};

export function SpendingBehaviour({ data }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const items = data[period];
  const hasPreviousData = items.some((d) => d.previousAmount > 0);

  const maxVal = useMemo(
    () => Math.max(...items.flatMap((d) => [d.amount, d.previousAmount]), 1),
    [items],
  );

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            <Icon name="spending-behaviour" size={14} /> Spending Behaviour
          </h2>
          <p className="mt-0.5 text-[0.7rem] text-[var(--color-text-muted)]">
            {hasPreviousData
              ? period === "weekly" ? "This week vs last week"
                : period === "yearly" ? "This year vs last year"
                : "This month vs last month"
              : period === "weekly" ? "This week's spending by category"
                : period === "yearly" ? "This year's spending by category"
                : "This month's spending by category"}
          </p>
        </div>
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>

      {/* Legend — only show when comparing */}
      {hasPreviousData && (
        <div className="mb-3 flex items-center gap-4 text-[0.6rem]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-text)]/20" />
            <span className="text-[var(--color-text-muted)]">Previous</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-ok)]" />
            <span className="text-[var(--color-text-muted)]">Current</span>
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
              {/* Category label + amounts */}
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[0.72rem] text-[var(--color-text-secondary)] transition-colors duration-200 group-hover:text-[var(--color-text)]">
                  {CATEGORY_EMOJIS[item.category] ?? ""} {formatCategory(item.category)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[0.72rem] font-medium text-[var(--color-text)]">
                    {'\u20B9'}{item.amount.toLocaleString("en-IN")}
                  </span>
                  {hasPreviousData && (
                    <span
                      className={`text-[0.65rem] font-medium ${
                        isUp ? "text-[var(--color-warn)]" : isDown ? "text-[var(--color-ok)]" : "text-[var(--color-text-muted)]"
                      }`}
                    >
                      {isSame ? "0%" : `${isUp ? "+" : ""}${item.changePercent}%`}
                    </span>
                  )}
                </div>
              </div>

              {/* Bars */}
              <div className="flex flex-col gap-1">
                {/* Previous bar — only when comparing */}
                {hasPreviousData && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-hover)]">
                    <div
                      key={`prev-${item.category}-${item.previousAmount}`}
                      className="h-full rounded-full bg-[var(--color-text)]/20 animate-fill"
                      style={{ width: `${previousWidth}%` }}
                    />
                  </div>
                )}
                {/* Current bar */}
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

      {/* Tip */}
      <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-[0.85rem] leading-relaxed text-[var(--color-text)]">
        <Icon name="tip" size={14} /> {PERIOD_TIPS[period]}
      </p>
    </div>
  );
}
