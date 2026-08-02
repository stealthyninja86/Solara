import { useState, useMemo } from "react";
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from "../constants";

interface ExpenseNode {
  category: string;
  total: number;
}

interface Props {
  categories: ExpenseNode[];
  totalSpend: number;
}

// Pre-computed positions for 5 nodes in a cluster layout (center + 4 surrounding)
const LAYOUT = [
  { x: 150, y: 90 },   // center (largest)
  { x: 60, y: 40 },    // top-left
  { x: 240, y: 40 },   // top-right
  { x: 60, y: 150 },   // bottom-left
  { x: 240, y: 150 },  // bottom-right
];

export function ExpenseNodes({ categories, totalSpend }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const top5 = useMemo(() => categories.slice(0, 5), [categories]);

  const { minAmount, range } = useMemo(() => {
    const amounts = top5.map((c) => c.total);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    return { minAmount: min, range: max - min || 1 };
  }, [top5]);

  const svgWidth = 300;
  const svgHeight = 200;

  const getRadius = (value: number) => {
    const minR = 28;
    const maxR = 44;
    const normalized = (value - minAmount) / range;
    return minR + normalized * (maxR - minR);
  };

  // Sort by amount descending so largest is first (center position)
  const sorted = useMemo(() => [...top5].sort((a, b) => b.total - a.total), [top5]);

  const positioned = sorted.map((item, i) => ({
    ...item,
    x: LAYOUT[i]?.x ?? 150,
    y: LAYOUT[i]?.y ?? 90,
    radius: getRadius(item.total),
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  return (
    <div className="card">
      <div className="mb-3">
        <h2 className="text-[0.8rem] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          🔵 Top Expenses
        </h2>
        <p className="mt-0.5 text-[0.7rem] text-[var(--color-text-muted)]">Your biggest spending categories</p>
      </div>

      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" style={{ maxHeight: 220 }}>
        <defs>
          {positioned.map((node, i) => (
            <radialGradient key={i} id={`nodeGrad${i}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor={node.color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={node.color} stopOpacity="0.5" />
            </radialGradient>
          ))}
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines from center node to others */}
        {positioned.length > 0 && positioned.slice(1).map((node, i) => {
          const center = positioned[0];
          if (!center) return null;
          return (
            <line
              key={`line-${i}`}
              x1={center.x}
              y1={center.y}
              x2={node.x}
              y2={node.y}
              stroke="var(--color-bg-hover)"
              strokeWidth="1"
              strokeDasharray="3,3"
              opacity={hoveredIndex === 0 || hoveredIndex === i + 1 ? 0.6 : 0.2}
              className="transition-opacity duration-200"
            />
          );
        })}

        {/* Nodes */}
        {positioned.map((node, i) => {
          const isHovered = hoveredIndex === i;
          const isCenter = i === 0;
          const opacity = hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1;

          return (
            <g
              key={node.category}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
              style={{ opacity, transition: "opacity 0.2s" }}
            >
              {/* Glow ring on hover */}
              {isHovered && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius + 4}
                  fill="none"
                  stroke={node.color}
                  strokeWidth="1"
                  opacity="0.3"
                />
              )}

              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isHovered ? node.radius + 2 : node.radius}
                fill={`url(#nodeGrad${i})`}
                filter={isHovered ? "url(#nodeGlow)" : "none"}
                className="animate-scale-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              />

              {/* Category emoji */}
              <text
                x={node.x}
                y={node.y - 6}
                textAnchor="middle"
                fontSize={isCenter ? "14" : "11"}
                className="pointer-events-none"
              >
                {CATEGORY_EMOJIS[node.category] ?? ""}
              </text>

              {/* Amount */}
              <text
                x={node.x}
                y={node.y + 8}
                textAnchor="middle"
                fill="var(--color-bg)"
                fontSize={isCenter ? "10" : "8"}
                fontWeight="bold"
                fontFamily="monospace"
                className="pointer-events-none"
              >
                {'\u20B9'}{(node.total / 1000).toFixed(1)}k
              </text>

              {/* Category label (smaller nodes) */}
              {!isCenter && (
                <text
                  x={node.x}
                  y={node.y + 18}
                  textAnchor="middle"
                  fill="var(--color-text-secondary)"
                  fontSize="6"
                  className="pointer-events-none"
                >
                  {node.category.replace(/_/g, " ").toLowerCase().split(" ")[0]}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Total */}
      {totalSpend > 0 && (
        <div className="mt-2 text-center">
          <span className="text-[0.65rem] text-[var(--color-text-muted)]">
            Total: {'\u20B9'}{totalSpend.toLocaleString("en-IN")}
          </span>
        </div>
      )}
    </div>
  );
}
