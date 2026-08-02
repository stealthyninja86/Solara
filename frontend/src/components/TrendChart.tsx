import { useMemo, useState } from "react";
import type { TrendPoint, TimePeriod } from "../types/reports";
import { PeriodSelect } from "./PeriodSelect";
import { Icon } from "./Icon";

interface Props {
  data: Record<TimePeriod, TrendPoint[]>;
}

export function TrendChart({ data }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const points = data[period];

  const width = 320;
  const height = 180;
  const padding = { top: 16, right: 16, bottom: 28, left: 44 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const allValues = useMemo(() => points.flatMap((d) => [d.income, d.expenses]), [points]);
  const maxVal = Math.max(...allValues);
  const range = maxVal || 1;

  const toX = (i: number) => padding.left + (i / (points.length - 1)) * chartW;
  const toY = (val: number) => padding.top + chartH - (val / range) * chartH;

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

  const incomeAreaPath = `${incomePath} L${toX(points.length - 1)},${padding.top + chartH} L${toX(0)},${padding.top + chartH} Z`;
  const expenseAreaPath = `${expensePath} L${toX(points.length - 1)},${padding.top + chartH} L${toX(0)},${padding.top + chartH} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const val = range * pct;
    return {
      y: toY(val),
      label: val >= 100000 ? `${Math.round(val / 100000)}L` : val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val).toString(),
    };
  });

  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            <Icon name="spending-trend" size={14} /> Spending Trend
          </h2>
          <p className="mt-0.5 text-[0.7rem] text-[var(--color-text-muted)]">Income vs Expenses</p>
        </div>
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>

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

          {/* Grid */}
          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={padding.left} y1={g.y} x2={width - padding.right} y2={g.y} stroke="var(--color-bg-hover)" strokeWidth="1" />
              <text x={padding.left - 8} y={g.y + 3} textAnchor="end" fill="var(--color-text-secondary)" fontSize="7" fontFamily="monospace">
                {g.label}
              </text>
            </g>
          ))}

          {/* Area fills */}
          <path d={incomeAreaPath} fill="url(#incomeGrad)" className="animate-fill" style={{ animationDuration: "0.8s" }} />
          <path d={expenseAreaPath} fill="url(#expenseGrad)" className="animate-fill" style={{ animationDuration: "0.8s", animationDelay: "0.15s" }} />

          {/* Lines */}
          <path d={incomePath} fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" className="animate-fill" style={{ animationDuration: "0.8s" }} />
          <path d={expensePath} fill="none" stroke="var(--color-bad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" className="animate-fill" style={{ animationDuration: "0.8s", animationDelay: "0.15s" }} />

          {/* Hover vertical line */}
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

          {/* Data points */}
          {points.map((d, i) => (
            <g
              key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* Hover target area */}
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
              <text x={toX(i)} y={height - 8} textAnchor="middle" fill="var(--color-text-muted)" fontSize="7" fontFamily="monospace">
                {d.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-lg border border-[var(--color-border-emphasis)] bg-[var(--color-surface)] px-3 py-2 shadow-xl">
            <div className="mb-1 text-[0.65rem] font-medium text-[var(--color-text)]">{hovered.label}</div>
            <div className="flex items-center gap-2 text-[0.6rem]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-ok)]" />
              <span className="text-[var(--color-text-secondary)]">Income</span>
              <span className="font-medium text-[var(--color-text)]">{'\u20B9'}{hovered.income.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center gap-2 text-[0.6rem]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-bad)]" />
              <span className="text-[var(--color-text-secondary)]">Expenses</span>
              <span className="font-medium text-[var(--color-text)]">{'\u20B9'}{hovered.expenses.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-5 text-[0.65rem]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-ok)] shadow-[0_0_6px_var(--color-ok)]" />
          <span className="text-[var(--color-text-secondary)]">Income</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-bad)] shadow-[0_0_6px_var(--color-bad)]" />
          <span className="text-[var(--color-text-secondary)]">Expenses</span>
        </span>
      </div>

      <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-[0.85rem] leading-relaxed text-[var(--color-text)]">
        <Icon name="tip" size={14} /> When the green line stays above red, you're saving money. If red crosses above green, expenses are outpacing income.
      </p>
    </div>
  );
}
