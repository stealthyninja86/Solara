import { useState, useMemo } from "react";
import type { SpendingChange, TimePeriod } from "../types/reports";
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from "../constants";
import { PeriodSelect } from "./PeriodSelect";
import { Icon } from "./Icon";

interface Props {
  data: Record<TimePeriod, SpendingChange[]>;
}

export function CategoryBreakdown({ data }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const items = data[period];
  const total = useMemo(() => items.reduce((sum, d) => sum + d.amount, 0), [items]);

  // Donut chart calculations
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

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            <Icon name="category-breakdown" size={14} /> Category Breakdown
          </h2>
          <p className="mt-0.5 text-[0.7rem] text-[var(--color-text-muted)]">Share of total spending</p>
        </div>
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>

      <div className="flex items-center gap-6">
        {/* Donut chart */}
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
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[0.6rem] text-[var(--color-text-muted)]">Total</span>
            <span className="text-[0.75rem] font-bold text-[var(--color-text)]">
              {'\u20B9'}{(total / 1000).toFixed(1)}k
            </span>
          </div>
        </div>

        {/* Legend */}
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
              <span className="flex-1 text-[0.68rem] text-[var(--color-text-secondary)] transition-colors duration-200 group-hover:text-[var(--color-text)]">
                {CATEGORY_EMOJIS[seg.category] ?? ""} {seg.category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <span className="text-[0.68rem] font-medium text-[var(--color-text)]">{Math.round(seg.pct)}%</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-[0.85rem] leading-relaxed text-[var(--color-text)]">
        <Icon name="tip" size={14} /> If one category dominates, that's where small cuts have the biggest impact.
      </p>
    </div>
  );
}
