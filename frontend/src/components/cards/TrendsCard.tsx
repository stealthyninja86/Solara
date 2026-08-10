import { useTrends } from "../../hooks/useTrends";
import { CATEGORY_COLORS } from "../../constants";
import { formatCategory } from "../../utils";
import { UncategorizedLabel } from "../ui/UncategorizedLabel";

interface Props {
  refreshKey?: number;
}

const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 68;
const THICKNESS = 28;
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(startAngle: number, endAngle: number) {
  const start = polarToCartesian(CX, CY, R, startAngle);
  const end = polarToCartesian(CX, CY, R, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${large} 1 ${end.x} ${end.y}`;
}

export function TrendsCard({ refreshKey = 0 }: Props) {
  const { categories, totalSpend } = useTrends(refreshKey);

  return (
    <div className="card trends-card">
      <h2>Spending Trends</h2>

      {categories.length === 0 ? (
        <p className="text-[0.75rem] text-neutral-500 text-center py-4">
          No spending data for this month
        </p>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {(() => {
              const arcs: React.ReactNode[] = [];
              let currentAngle = 0;
              const top8 = categories.slice(0, 8);
              top8.forEach((c, i) => {
                const pct = totalSpend > 0 ? c.total / totalSpend : 0;
                const sweep = pct * 360;
                const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                arcs.push(
                  <path
                    key={c.category}
                    d={describeArc(currentAngle, currentAngle + sweep)}
                    fill="none"
                    stroke={color}
                    strokeWidth={THICKNESS}
                    strokeLinecap="round"
                  />
                );
                currentAngle += sweep;
              });
              if (categories.length > 8) {
                const remainingPct = categories.slice(8).reduce((s, c) => s + c.total, 0) / totalSpend;
                const sweep = remainingPct * 360;
                arcs.push(
                  <path
                    key="other"
                    d={describeArc(currentAngle, currentAngle + sweep)}
                    fill="none"
                    stroke="var(--color-text-muted)"
                    strokeWidth={THICKNESS}
                    strokeLinecap="round"
                  />
                );
              }
              return arcs;
            })()}
            <text
              x={CX} y={CY}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--color-text)"
              fontSize="16"
              fontWeight="700"
              fontFamily="'JetBrains Mono', monospace"
            >
              {'\u20B9'}{totalSpend.toFixed(0)}
            </text>
          </svg>

          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
            {categories.slice(0, 8).map((c, i) => {
              const pct = totalSpend > 0 ? (c.total / totalSpend) * 100 : 0;
              const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
              return (
                <div key={c.category} className="flex items-center gap-1.5 text-[0.6rem]">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span className="text-neutral-400">
                    <UncategorizedLabel category={c.category}>{formatCategory(c.category)}</UncategorizedLabel>
                  </span>
                  <span className="text-white">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
            {categories.length > 8 && (
              <div className="flex items-center gap-1.5 text-[0.6rem]">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-text-muted)", flexShrink: 0 }} />
                <span className="text-neutral-400">Other</span>
                <span className="text-white">
                  {((categories.slice(8).reduce((s, c) => s + c.total, 0) / totalSpend) * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
