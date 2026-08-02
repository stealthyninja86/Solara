import { useState } from "react";
import { useIncome } from "../hooks/useIncome";
import { Icon } from "./Icon";

interface Props {
  refreshKey?: number;
  totalSpend?: number;
}

export function IncomeCard({ refreshKey = 0, totalSpend = 0 }: Props) {
  const { monthlyIncome, hasIncome, setMonthlyIncome } = useIncome(refreshKey);

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
      {/* Header row */}
      <div className="mb-6">
        <h2 className="text-[1rem] font-medium text-[var(--color-text)]"><Icon name="income" size={16} /> Income</h2>
      </div>

      {/* Display mode */}
      {!showInput ? (
        <div className="flex flex-col gap-4">
          {hasIncome ? (
            <>
              <div>
                <p className="text-[0.7rem] uppercase tracking-wider text-[var(--color-text-muted)]">Monthly Income</p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-ok)]">
                  {'\u20B9'}{monthlyIncome.toLocaleString("en-IN")}
                </p>
              </div>
              {totalSpend > 0 && (
                <div>
                  <p className="text-[0.7rem] uppercase tracking-wider text-[var(--color-text-muted)]">Total Expenses</p>
                  <p className="mt-1 text-xl font-bold text-[var(--color-bad)]">
                    {'\u20B9'}{totalSpend.toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-[0.85rem] text-[var(--color-text-muted)]">No income set</p>
          )}
        </div>
      ) : (
        /* Edit mode */
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[0.85rem] text-[var(--color-text-secondary)]">{'\u20B9'}</span>
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
            className="min-w-0 flex-1 rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-1.5 text-[0.85rem] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-0! w-auto! shrink-0 cursor-pointer rounded-md bg-[var(--color-ok)]! px-4! py-1.5! text-[0.75rem]! font-medium! text-black! transition-colors hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving\u2026" : "Save"}
          </button>
          <button
            onClick={() => { if (!saving) setShowInput(false); }}
            className="mt-0! w-auto! shrink-0 cursor-pointer rounded-md bg-[var(--color-border)]! px-2! py-1.5! text-[0.75rem]! text-[var(--color-text-secondary)]! transition-colors hover:text-[var(--color-text)]!"
          >
            {'\u2715'}
          </button>
        </div>
      )}

      {saveError && (
        <p className="mt-2 text-[0.7rem] text-[var(--color-bad)]">Failed to save.</p>
      )}

      {/* Action button */}
      {!showInput && (
        <button
          onClick={() => {
            setInputValue(String(monthlyIncome || ""));
            setShowInput(true);
          }}
          className="mt-6 w-full cursor-pointer rounded-md border border-[var(--color-border-emphasis)] bg-transparent py-2 text-[0.8rem] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]"
        >
          {hasIncome ? "Update Income" : "Set Income"}
        </button>
      )}
    </div>
  );
}
