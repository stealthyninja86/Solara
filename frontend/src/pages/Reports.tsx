import { useCallback, useEffect, useState } from "react";
import { useReports } from "../hooks/useReports";
import { useAvailableDates } from "../hooks/useAvailableDates";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { FinancialSnapshot } from "../components/cards/FinancialSnapshot";
import { SpendingBehaviour } from "../components/charts/SpendingBehaviour";
import { TrendChart } from "../components/charts/TrendChart";
import { CategoryBreakdown } from "../components/charts/CategoryBreakdown";
import { Recommendations } from "../components/cards/Recommendations";
import { Icon } from "../components/ui/Icon";
import { DropdownSelect } from "../components/ui/DropdownSelect";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const NOW = new Date();
const STORAGE_KEY = "solara.reports.selected";

function loadSelected() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.year && parsed.month) return parsed;
    }
  } catch { /* ignore */ }
  return { year: NOW.getFullYear(), month: NOW.getMonth() + 1 };
}

export function Reports() {
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const periods = useAvailableDates(0);
  const [selected, setSelected] = useState(loadSelected);

  const reports = useReports(selected.month - 1, selected.year, 0);

  useEffect(() => {
    if (!reports.loading) setPullRefreshing(false);
  }, [reports.loading]);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  const { pullRef } = usePullToRefresh(handleRefresh, setPullRefreshing);

  function persist(next: { year: number; month: number }) {
    setSelected(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const currentIndex = periods.findIndex(
    (p) => p.year === selected.year && p.month === selected.month,
  );

  function shift(delta: number) {
    const next = periods[currentIndex + delta];
    if (next) persist(next);
  }

  return (
    <div ref={pullRef} className="flex w-full flex-col gap-6">
      {pullRefreshing && (
        <div className="flex justify-center py-2">
          <div className="spinner spinner--light" />
        </div>
      )}

      {periods.length > 0 && (
      <div className="flex flex-col items-start gap-1.5">
        <h1 className="text-page whitespace-nowrap"><Icon name="reports" size={18} /> Reports</h1>
        <div className="mx-auto flex items-center gap-1.5">
          <button
            onClick={() => shift(-1)}
            disabled={currentIndex <= 0}
            className="button flex !h-6 !w-6 !items-center !justify-center !rounded !p-0"
          >
            {'\u2190'}
          </button>
          <DropdownSelect
            value={selected.month}
            options={periods
              .filter((p) => p.year === selected.year)
              .map((p) => ({ value: p.month, label: MONTHS[p.month - 1] ?? "" }))}
            onChange={(v) => persist({ ...selected, month: Number(v) })}
          />
          <DropdownSelect
            value={selected.year}
            options={[...new Set(periods.map((p) => p.year))].map((y) => ({ value: y, label: String(y) }))}
            onChange={(v) => persist({ ...selected, year: Number(v) })}
          />
          <button
            onClick={() => shift(1)}
            disabled={currentIndex >= periods.length - 1}
            className="button flex !h-6 !w-6 !items-center !justify-center !rounded !p-0"
          >
            {'\u2192'}
          </button>
        </div>
      </div>
      )}

      <Recommendations month={selected.month - 1} year={selected.year} />
      <FinancialSnapshot data={reports.summary} ranges={reports.ranges} />
      <SpendingBehaviour data={reports.spendingChanges} ranges={reports.ranges} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TrendChart data={reports.trends} ranges={reports.ranges} />
        <CategoryBreakdown data={reports.spendingChanges} ranges={reports.ranges} />
      </div>
    </div>
  );
}
