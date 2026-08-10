import { useState } from "react";
import { useIncome } from "../../hooks/useIncome";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";

interface Props {
  refreshKey?: number;
  totalSpend?: number;
  month?: number;
  year?: number;
}

export function IncomeCard({ refreshKey = 0, totalSpend = 0, month, year }: Props) {
  const { monthlyIncome, hasIncome, setMonthlyIncome } = useIncome(refreshKey, month, year);

  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState(String(monthlyIncome || ""));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function handleSave() {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    setSaveError(false);
    const ok = await setMonthlyIncome(val);
    setSaving(false);
    if (ok) {
      setShowInput(false);
    } else {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
  }

  return (
    <div className="card h-full rounded-2xl p-10">
      <div className="mb-6">
        <h2 className="text-card"><Icon name="income" size={16} /> Income</h2>
      </div>

      {!showInput ? (
        <div className="flex flex-col gap-4">
          {hasIncome ? (
            <>
              <div>
                <p className="text-label">Monthly Income</p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-ok)]">
                  {'\u20B9'}{monthlyIncome.toLocaleString("en-IN")}
                </p>
              </div>
              {totalSpend > 0 && (
                <div>
                  <p className="text-label">Total Expenses</p>
                  <p className="mt-1 text-xl font-bold text-[var(--color-bad)]">
                    {'\u20B9'}{totalSpend.toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-caption text-[var(--color-text-muted)]">
              Your monthly income powers the safe-to-spend calculator, savings rate, and trend charts.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-caption text-[var(--color-text-secondary)]">{'\u20B9'}</span>
          <input
            type="number"
            min="0"
            placeholder="Monthly income"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setShowInput(false);
            }}
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-1.5 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="button button-primary shrink-0 !px-4 !py-1.5"
          >
            {saving ? "Saving\u2026" : "Save"}
          </button>
          <button
            onClick={() => { if (!saving) setShowInput(false); }}
            className="button shrink-0 !h-7 !w-7 !rounded-full !p-0"
          >
            {'\u2715'}
          </button>
        </div>
      )}

      {saveError && (
        <p className="mt-2 text-small text-[var(--color-bad)]">Failed to save.</p>
      )}

      {!showInput && (
        <button
          onClick={() => {
            setInputValue(String(monthlyIncome || ""));
            setShowInput(true);
          }}
          className="button mt-6 w-full text-[var(--color-text-secondary)]!"
        >
          {hasIncome ? "Update Income" : "Set Income"}
        </button>
      )}

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "What it powers",
    description: "This shows your monthly income — it powers the safe-to-spend calculation, the savings rate, and the income line on trend charts.",
  },
  {
    title: "Carries forward",
    description: "Set it once and it applies to every month — past, present and future — until you change it. Updating a specific month overrides just that month.",
  },
];
