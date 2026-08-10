import { useMemo, useState } from "react";
import type { DateRange, TimePeriod, TrendPoint } from "../../types/reports";
import { PeriodSelect } from "../ui/PeriodSelect";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";
import { formatDateRange } from "../../utils/date";

interface Props {
  data: Record<TimePeriod, TrendPoint[]>;
  ranges: Record<TimePeriod, DateRange>;
}

export function TrendChart({ data, ranges }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const points = data[period];
  const range = ranges[period];
  const hasRange = range && range.from && range.to;

  const width = 320;
  const height = 180;
  const padding = { top: 16, right: 16, bottom: 28, left: 44 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const allValues = useMemo(() => points.flatMap((d) => [d.income, d.expenses]), [points]);
  const maxVal = Math.max(...allValues);
  const rangeMax = maxVal || 1;

  const toX = (i: number) => padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
  const toY = (val: number) => padding.top + chartH - (val / rangeMax) * chartH;

  const smoothPath = (values: number[]) => {
    if (values.length < 2) return "";
    const coords = values.map((v, i) => ({ x: toX(i), y: toY(v) }));
    const first = coords[0];
    if (!first) return "";
    let d = `M${first.x},${first.y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      if (!curr || !next) continue;
      const cpx = (curr.x + next.x) / 2;
      d += ` C${cpx},${curr.y} ${cpx},${next.y} ${next.x},${next.y}`;
    }
    return d;
  };

  const incomeValues = points.map((d) => d.income);
  const expenseValues = points.map((d) => d.expenses);
  const incomePath = smoothPath(incomeValues);
  const expensePath = smoothPath(expenseValues);

  const lastX = points.length > 1 ? toX(points.length - 1) : padding.left + chartW;
  const baseY = padding.top + chartH;
  const incomeAreaPath = `${incomePath} L${lastX},${baseY} L${toX(0)},${baseY} Z`;
  const expenseAreaPath = `${expensePath} L${lastX},${baseY} L${toX(0)},${baseY} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const val = rangeMax * pct;
    return {
      y: toY(val),
      label: val >= 100000 ? `${Math.round(val / 100000)}L` : val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val).toString(),
    };
  });

  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null;

  const tip = useMemo(() => {
    if (points.length === 0) return "No trend data yet for this period.";
    const totalIncome = points.reduce((sum, point) => sum + point.income, 0);
    const totalExpenses = points.reduce((sum, point) => sum + point.expenses, 0);
    if (totalExpenses === 0) {
      return "No expenses recorded in this period — patterns will appear as transactions come in.";
    }
    const peak = points.reduce((a, b) => (b.expenses > a.expenses ? b : a));
    const incomeAhead = totalIncome >= totalExpenses;
    return incomeAhead
      ? `Income stayed ahead of expenses this period; ${peak.label} saw the highest spending at \u20B9${peak.expenses.toLocaleString("en-IN")}.`
      : `Expenses outpaced income this period — ${peak.label} was the heaviest at \u20B9${peak.expenses.toLocaleString("en-IN")}.`;
  }, [points]);

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-card">
          <Icon name="spending-trend" size={14} /> Spending Trend
        </h2>
        <div className="flex items-center gap-2">
          {hasRange && (
            <span className="text-small">{formatDateRange(range)}</span>
          )}
          <PeriodSelect value={period} onChange={setPeriod} />
        </div>
      </div>

      <p className="mb-4 text-small">Income vs Expenses</p>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--color-ok)" }} stopOpacity="0.3" />
              <stop offset="100%" style={{ stopColor: "var(--color-ok)" }} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--color-bad)" }} stopOpacity="0.3" />
              <stop offset="100%" style={{ stopColor: "var(--color-bad)" }} stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={padding.left} y1={g.y} x2={width - padding.right} y2={g.y} stroke="var(--color-bg-hover)" strokeWidth="1" />
              <text x={padding.left - 8} y={g.y + 3} textAnchor="end" fill="var(--color-text)" fontSize="7" fontFamily="monospace">
                {g.label}
              </text>
            </g>
          ))}

          <path d={incomeAreaPath} fill="url(#incomeGrad)" className="animate-fill" style={{ animationDuration: "0.8s" }} />
          <path d={expenseAreaPath} fill="url(#expenseGrad)" className="animate-fill" style={{ animationDuration: "0.8s", animationDelay: "0.15s" }} />

          <path d={incomePath} fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" className="animate-fill" style={{ animationDuration: "0.8s" }} />
          <path d={expensePath} fill="none" stroke="var(--color-bad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" className="animate-fill" style={{ animationDuration: "0.8s", animationDelay: "0.15s" }} />

          {hoveredIndex !== null && (
            <line
              x1={toX(hoveredIndex)}
              y1={padding.top}
              x2={toX(hoveredIndex)}
              y2={padding.top + chartH}
              stroke="var(--color-text-tertiary)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          )}

          {points.map((d, i) => (
            <g
              key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              <rect
                x={toX(i) - 16}
                y={padding.top}
                width={32}
                height={chartH}
                fill="transparent"
              />
              <circle
                cx={toX(i)}
                cy={toY(d.income)}
                r={hoveredIndex === i ? 5 : 3}
                fill="var(--color-ok)"
                stroke="var(--color-ok)"
                strokeWidth="2"
                className="transition-all duration-200"
              />
              <circle
                cx={toX(i)}
                cy={toY(d.expenses)}
                r={hoveredIndex === i ? 5 : 3}
                fill="var(--color-bad)"
                stroke="var(--color-bad)"
                strokeWidth="2"
                className="transition-all duration-200"
              />
              <text x={toX(i)} y={height - 8} textAnchor="middle" fill="var(--color-text)" fontSize="7" fontFamily="monospace">
                {d.label}
              </text>
            </g>
          ))}
        </svg>

        {hovered && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-lg border border-[var(--color-border-emphasis)] bg-[var(--color-surface)] px-3 py-2 shadow-xl">
            <div className="mb-1 text-tiny font-medium text-[var(--color-text)]">{hovered.label}</div>
            <div className="flex items-center gap-2 text-tiny">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-ok)]" />
              <span className="text-[var(--color-text)]">Income</span>
              <span className="font-medium text-[var(--color-text)]">{'\u20B9'}{hovered.income.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center gap-2 text-tiny">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-bad)]" />
              <span className="text-[var(--color-text)]">Expenses</span>
              <span className="font-medium text-[var(--color-text)]">{'\u20B9'}{hovered.expenses.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-5 text-tiny">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-ok)] shadow-[0_0_6px_var(--color-ok)]" />
          <span className="text-[var(--color-text)]">Income</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-bad)] shadow-[0_0_6px_var(--color-bad)]" />
          <span className="text-[var(--color-text)]">Expenses</span>
        </span>
      </div>

      <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-caption leading-relaxed text-[var(--color-text)]">
        <Icon name="tip" size={14} /> {tip}
      </p>

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "Reading the chart",
    description: "The green line is income, the red line is expenses. Monthly view splits into weeks, Weekly into days, and Yearly into months.",
  },
  {
    title: "How income is shown",
    description: "Your income line is spread evenly — daily average for week/month views, and monthly for the yearly view.",
  },
  {
    title: "Hover for details",
    description: "Hover over any point to see exact numbers and spot which period had the highest spending.",
  },
];
