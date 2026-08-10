import { useState, useMemo } from "react";
import { CATEGORY_EMOJIS, CATEGORY_COLORS } from "../../constants";
import { formatCategory } from "../../utils";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { UNCATEGORIZED_TIP } from "../ui/UncategorizedLabel";

interface ExpenseNode {
  category: string;
  total: number;
}

interface Props {
  categories: ExpenseNode[];
  totalSpend: number;
}

const LAYOUT = [
  { x: 150, y: 90 },
  { x: 60, y: 40 },
  { x: 240, y: 40 },
  { x: 60, y: 150 },
  { x: 240, y: 150 },
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
        <h2 className="text-card">
          🔵 Top Expenses
        </h2>
        <p className="mt-0.5 text-small">Your biggest spending categories</p>
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
              {node.category === "UNCATEGORIZED" && <title>{UNCATEGORIZED_TIP}</title>}

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

              <circle
                cx={node.x}
                cy={node.y}
                r={isHovered ? node.radius + 2 : node.radius}
                fill={`url(#nodeGrad${i})`}
                filter={isHovered ? "url(#nodeGlow)" : "none"}
                className="animate-scale-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              />

              <text
                x={node.x}
                y={node.y - 6}
                textAnchor="middle"
                fontSize={isCenter ? "14" : "11"}
                className="pointer-events-none"
              >
                {CATEGORY_EMOJIS[node.category] ?? ""}
              </text>

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

              {!isCenter && (
                <text
                  x={node.x}
                  y={node.y + 18}
                  textAnchor="middle"
                  fill="var(--color-text)"
                  fontSize="6"
                  className="pointer-events-none"
                >
                  {formatCategory(node.category)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {totalSpend > 0 && (
        <div className="mt-2 text-center">
          <span className="text-small">
            Total: {'\u20B9'}{totalSpend.toLocaleString("en-IN")}
          </span>
        </div>
      )}

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "The bubbles",
    description: "Your top 5 spending categories as bubbles — bigger bubbles mean more spending. The center is always the largest.",
  },
  {
    title: "Hover to explore",
    description: "Hover over any bubble to highlight it and see how it compares to the others.",
  },
  {
    title: "Quick glance",
    description: "Each bubble shows the category emoji and amount, so you can quickly spot where your money is going.",
  },
];
