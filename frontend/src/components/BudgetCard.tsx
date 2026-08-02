import { useState } from "react";
import { useBudget } from "../hooks/useBudget";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

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
  const [showExceeded, setShowExceeded] = useState(false);
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

  const showModal = exceeded && showExceeded;

  return (
    <div className="card budget-card h-full">
      <h2><Icon name="budget" size={16} /> Budget</h2>

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
                {exceeded ? '-' : Math.round(usagePct)}%
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
              No Budget
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

      {exceeded && !showExceeded && (
        <button
          className="btn-budget-exceeded mt-3"
          onClick={() => setShowExceeded(true)}
        >
          {'\u26A0'} Budget Exceeded
        </button>
      )}

      {showModal && (
        <Modal visible={showModal} onClose={() => setShowExceeded(false)} titleId="budget-exceeded-title" className="modal modal-success">
          <div className="success-icon" style={{ fontSize: "2.5rem" }}><Icon name="budget-exceeded" size={40} /></div>
          <h2 id="budget-exceeded-title"><Icon name="budget-exceeded" size={16} /> Budget Exceeded</h2>
          <p className="success-message">
            Your budget of {'\u20B9'}{monthlyBudget.toFixed(0)} has been exceeded for this month.
          </p>
          <div className="success-details">
            <div className="detail-field">
              <span className="label">Budget</span>
              <span className="value">{'\u20B9'}{monthlyBudget.toFixed(0)}</span>
            </div>
            <div className="detail-field">
              <span className="label">Spent</span>
              <span className="value">{'\u20B9'}{totalSpent.toFixed(0)}</span>
            </div>
            <div className="detail-field">
              <span className="label">Overshoot</span>
              <span className="value" style={{ color: "var(--color-error)" }}>{'\u20B9'}{Math.abs(remaining).toFixed(0)}</span>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowExceeded(false)}
            style={{ marginTop: "1.25rem", width: "100%" }}
          >
            Got it
          </button>
        </Modal>
      )}
    </div>
  );
}
