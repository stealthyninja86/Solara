import { useState } from "react";
import { useBudget } from "../../hooks/useBudget";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";

interface Props {
  refreshKey?: number;
  onBudgetUpdated?: () => void;
  month?: number;
  year?: number;
}

export function BudgetCard({ refreshKey = 0, onBudgetUpdated, month, year }: Props) {
  const {
    monthlyBudget, totalSpent, remaining,
    hasBudget, exceeded, setMonthlyBudget,
  } = useBudget(refreshKey, month, year);

  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState(String(monthlyBudget || ""));
  const [hover, setHover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const usagePct = hasBudget && monthlyBudget > 0
    ? Math.min(100, (totalSpent / monthlyBudget) * 100)
    : 0;
  const offset = hasBudget
    ? exceeded
      ? 0
      : circumference * (1 - usagePct / 100)
    : circumference;

  const ringColor =
    usagePct > 80 ? "var(--color-bad)" : usagePct > 50 ? "var(--color-warn)" : "var(--color-ok)";

  const centerLabel = exceeded ? "over" : "used";

  async function handleSave() {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    setSaveError(false);
    const ok = await setMonthlyBudget(val);
    setSaving(false);
    if (ok) {
      setShowInput(false);
      onBudgetUpdated?.();
    } else {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
  }

  return (
    <div className="card budget-card h-full">
      <h2 className="text-card"><Icon name="budget" size={16} /> Budget</h2>

      <div
        className="budget-ring-wrapper"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <svg viewBox="0 0 120 120" className="budget-ring">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="8" />
          {hasBudget && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 60 60)"
              strokeLinecap="round"
              className="budget-ring-progress"
            />
          )}
          {hasBudget && !hover && (
            <>
              <text x="60" y="52" textAnchor="middle" fill="var(--color-text)" fontSize="22" fontWeight="bold">
                {exceeded ? '100' : Math.round(usagePct)}%
              </text>
              <text x="60" y="68" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="9">
                {centerLabel}
              </text>
            </>
          )}
          {hasBudget && hover && (
            <>
              <text x="60" y="46" textAnchor="middle" fill="var(--color-text)" fontSize="11" fontWeight="bold">
                {'\u20B9'}{Math.abs(exceeded ? totalSpent : remaining).toFixed(0)}
              </text>
              <text x="60" y="60" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="8">
                {exceeded ? "spent /" : "left of"}
              </text>
              <text x="60" y="74" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="8">
                {'\u20B9'}{monthlyBudget.toFixed(0)}
              </text>
            </>
          )}
          {!hasBudget && (
            <text x="60" y="56" textAnchor="middle" fill="var(--color-text-muted)" fontSize="9" fontWeight="bold">
              No budget set
            </text>
          )}
        </svg>
      </div>

      <div className="budget-footer">
        {!showInput ? (
          <button
            className="btn-budget-set"
            onClick={() => {
              setInputValue(String(monthlyBudget || ""));
              setShowInput(true);
            }}
          >
            {hasBudget ? "Update Budget" : "Set Budget"}
          </button>
        ) : (
          <div className="budget-input-row">
            <span className="budget-rupee">{'\u20B9'}</span>
            <input
              className="budget-input"
              type="number"
              min="0"
              placeholder="Monthly budget"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setShowInput(false);
              }}
              autoFocus
            />
            <button className="btn-budget-save" onClick={handleSave} disabled={saving}>
              {saving ? "Saving\u2026" : "Save"}
            </button>
            <button className="btn-budget-cancel" onClick={() => { if (!saving) setShowInput(false); }}>
              {'\u2715'}
            </button>
          </div>
        )}
        {saveError && (
          <p className="budget-error">Failed to save budget. Check that the server is running.</p>
        )}
      </div>

      {exceeded && (
        <div className="mt-3 rounded border border-[var(--color-warn)] bg-[var(--color-warn)]/10 px-3 py-2 text-center">
          <p className="text-caption font-semibold text-[var(--color-warn)]">
            You've gone {'\u20B9'}{Math.abs(remaining).toFixed(0)} above your budget
          </p>
          <p className="mt-1 text-small">
            Consider increasing your budget or reducing spends to get back on track.
          </p>
        </div>
      )}

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "Reading the ring",
    description: "Shows how much of your monthly budget you've used. Green means you're under 50%, amber is 50–80%, red means you're over 80%.",
  },
  {
    title: "Hover for details",
    description: "Hover over the ring to see exact numbers — how much is left, or how much you've overspent.",
  },
  {
    title: "How it connects",
    description: "Your budget directly drives the Safe to Spend card on the Overview page.",
  },
];
