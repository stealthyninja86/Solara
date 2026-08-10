import { useSpendAnalysis } from "../../hooks/useSpendAnalysis";
import { useBudget } from "../../hooks/useBudget";

interface Props {
  refreshKey?: number;
}

export function SpendAnalysisCard({ refreshKey = 0 }: Props) {
  const { totalSpent, monthlyBudget, safeToSpend, remaining } =
    useSpendAnalysis(refreshKey);
  const { exceeded } = useBudget(refreshKey);

  const budgetPct = monthlyBudget > 0
    ? Math.min(100, (totalSpent / monthlyBudget) * 100)
    : 0;

  return (
    <div className="card analysis-card">
      <h2>Spend Analysis</h2>

      <div className="analysis-grid">
        <div className="analysis-stat">
          <span className="analysis-label">Total Spent</span>
          <span className={`analysis-value ${exceeded ? "text-[var(--color-bad)]" : ""}`}>
            {'\u20B9'}{totalSpent.toFixed(0)}
          </span>
        </div>
        <div className="analysis-stat">
          <span className="analysis-label">Safe to Spend</span>
          <span className={`analysis-value ${safeToSpend < 0 ? "text-[var(--color-bad)]" : ""}`}>
            {'\u20B9'}{safeToSpend.toFixed(0)}
          </span>
        </div>
        <div className="analysis-stat">
          <span className="analysis-label">Remaining</span>
          <span className={`analysis-value ${remaining < 0 ? "text-[var(--color-bad)]" : ""}`}>
            {remaining < 0 ? "-" : ""}{'\u20B9'}{Math.abs(remaining).toFixed(0)}
          </span>
        </div>
      </div>

      {monthlyBudget > 0 && (
        <div className="analysis-bar-wrap">
          <div className="analysis-bar-track">
            <div
              className="analysis-bar-fill"
              style={{
                width: `${Math.min(budgetPct, 100)}%`,
                background: exceeded ? "var(--color-bad)" : budgetPct > 80 ? "var(--color-warn)" : "var(--color-ok)",
              }}
            />
          </div>
          <span className="analysis-bar-label">{budgetPct.toFixed(0)}% used</span>
        </div>
      )}
    </div>
  );
}
