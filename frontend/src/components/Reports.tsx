import { useCallback, useEffect, useState } from "react";
import { useReports } from "../hooks/useReports";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { FinancialSnapshot } from "./FinancialSnapshot";
import { SpendingBehaviour } from "./SpendingBehaviour";
import { TrendChart } from "./TrendChart";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { InsightFeed } from "./InsightFeed";
import { SubscriptionCard } from "./SubscriptionCard";
import { Icon } from "./Icon";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function Reports() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const reports = useReports(selectedMonth, selectedYear, refreshKey);

  useEffect(() => {
    if (!reports.loading) setPullRefreshing(false);
  }, [reports.loading]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const { pullRef } = usePullToRefresh(handleRefresh, setPullRefreshing);

  function shiftMonth(delta: number) {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    if (newYear > now.getFullYear() || (newYear === now.getFullYear() && newMonth > now.getMonth())) return;
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  }

  const canGoForward = selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth < now.getMonth());

  return (
    <div ref={pullRef} className="flex w-full flex-col gap-6">
      {pullRefreshing && (
        <div className="flex justify-center py-2">
          <div className="spinner spinner--light" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[1.1rem] font-bold text-[var(--color-text)]"><Icon name="reports" size={18} /> Reports</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text)]"
            title="Previous month"
          >
            {'\u2190'}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMonthPicker((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-1.5 text-[0.75rem] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text)]"
            >
              {MONTHS[selectedMonth]} {selectedYear} <span className="text-[0.6rem]">{'\u25BE'}</span>
            </button>
            {showMonthPicker && (
              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg">
                {MONTHS.map((month, index) => (
                  <button
                    key={month}
                    onClick={() => {
                      setSelectedMonth(index);
                      setShowMonthPicker(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-[0.72rem] transition-colors hover:bg-[var(--color-bg-hover)] ${
                      index === selectedMonth ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => shiftMonth(1)}
            disabled={!canGoForward}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-30"
            title="Next month"
          >
            {'\u2192'}
          </button>
        </div>
      </div>

      {/* Financial Snapshot */}
      <FinancialSnapshot data={reports.summary} />

      {/* Spending Behaviour */}
      <SpendingBehaviour data={reports.spendingChanges} />

      {/* Trend + Category Breakdown side by side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TrendChart data={reports.trends} />
        <CategoryBreakdown data={reports.spendingChanges} />
      </div>

      {/* AI Insights */}
      <InsightFeed data={reports.insights} />

      {/* Subscriptions */}
      <SubscriptionCard data={reports.subscriptions} totalAnnual={reports.totalSubscriptions} />
    </div>
  );
}
