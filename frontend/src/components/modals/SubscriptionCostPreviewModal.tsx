import { useEffect, useRef, useState } from "react";
import { DEFAULT_USER_ID } from "../../constants";
import { api } from "../../utils/api";
import { getUserId } from "../../hooks/useAuth";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";
import type { PageResponse } from "../../types";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const FREQUENCIES = [
  { label: "Daily", value: "DAILY", cyclesPerYear: 365 },
  { label: "Weekly", value: "WEEKLY", cyclesPerYear: 52 },
  { label: "Monthly", value: "MONTHLY", cyclesPerYear: 12 },
  { label: "Yearly", value: "YEARLY", cyclesPerYear: 1 },
] as const;

const HORIZON_YEARS = 5;

interface EstimateRow {
  id: number;
  name: string;
  frequency: string;
  amount: string;
}

let rowCounter = 0;

function buildRow(): EstimateRow {
  rowCounter += 1;
  return { id: rowCounter, name: "", frequency: "MONTHLY", amount: "" };
}

export function SubscriptionCostPreviewModal({ visible, onClose }: Props) {
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [knownMerchants, setKnownMerchants] = useState<string[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [hasIncome, setHasIncome] = useState(false);
  const loadedMerchantsRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    const params = new URLSearchParams({ userId: getUserId() ?? DEFAULT_USER_ID });
    api(`/api/v1/insights/income?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { monthlyIncome?: number } | null) => {
        if (!data) return;
        const value = data.monthlyIncome ?? 0;
        setMonthlyIncome(value);
        setHasIncome(value > 0);
      })
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (!visible || loadedMerchantsRef.current) return;
    loadedMerchantsRef.current = true;
    const params = new URLSearchParams({
      userId: getUserId() ?? DEFAULT_USER_ID,
      page: "0",
      size: "100",
    });
    api(`/api/v1/category/transaction?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PageResponse | null) => {
        if (!data) return;
        const merchants = data.content
          .map((transaction) => transaction.merchant)
          .filter((name): name is string => Boolean(name?.trim()));
        setKnownMerchants([...new Set(merchants)].sort());
      })
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (visible) setRows([buildRow()]);
  }, [visible]);

  function updateRow(id: number, patch: Partial<EstimateRow>) {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function annualCostFor(row: EstimateRow): number {
    const value = Number(row.amount);
    const cadence = FREQUENCIES.find((entry) => entry.value === row.frequency) ?? FREQUENCIES[2];
    return Number.isFinite(value) && value > 0 ? value * cadence.cyclesPerYear : 0;
  }

  const annualTotal = rows.reduce((sum, row) => sum + annualCostFor(row), 0);
  const total5Years = annualTotal * HORIZON_YEARS;
  const incomePercent = annualTotal > 0 && hasIncome && monthlyIncome > 0 ? (annualTotal / (monthlyIncome * 12)) * 100 : null;

  return (
    <Modal visible={visible} onClose={onClose} titleId="cost-preview-title" className="modal modal-detail">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="cost-preview-title">
          <Icon name="recurring-payments" size={16} /> Cost Preview
        </h2>
        <button
          onClick={onClose}
          className="button flex !h-7 !w-7 !items-center !justify-center !rounded-full !p-0"
          title="Close"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="modal-hint">
        Thinking of subscribing to a few things? Add each one and see what they cost together before you commit.
      </p>

      <div className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-small">
            No subscriptions added — add a row to estimate the cost.
          </p>
        ) : (
          rows.map((row) => {
            const annual = annualCostFor(row);
            return (
              <div key={row.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-3">
                <div className="flex items-center gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-emphasis)]"
                    value={row.name}
                    onChange={(event) => updateRow(row.id, { name: event.target.value })}
                    list="cost-preview-merchant-list"
                    placeholder="Name (optional) — e.g. Netflix"
                  />
                  <select
                    className="w-28 shrink-0 cursor-pointer rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-2 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-emphasis)]"
                    value={row.frequency}
                    onChange={(event) => updateRow(row.id, { frequency: event.target.value })}
                    aria-label="Subscription cadence"
                  >
                    {FREQUENCIES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-emphasis)]"
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(event) => updateRow(row.id, { amount: event.target.value })}
                      placeholder={`Amount (\u20B9 per period)`}
                    />
                  </div>
                  <span className="text-caption-muted">
                    {annual > 0 ? `≈ \u20B9${annual.toLocaleString("en-IN")}/yr` : "\u2014"}
                  </span>
                  <button
                    onClick={() => setRows((previous) => previous.filter((entry) => entry.id !== row.id))}
                    className="button flex !h-7 !w-7 !items-center !justify-center !rounded-full !p-0"
                    title="Remove subscription row"
                    aria-label="Remove subscription row"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
        <datalist id="cost-preview-merchant-list">
          {knownMerchants.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div className="mt-3">
        <button
          onClick={() => setRows((previous) => [...previous, buildRow()])}
          className="button !w-auto !px-3 !py-1.5 !text-[0.75rem]"
        >
          <Icon name="add" size={12} /> Add another subscription
        </button>
      </div>

      {annualTotal > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-4 py-3">
          <p className="text-tiny font-medium uppercase tracking-wider">
            Cost preview {rows.length > 1 ? `for ${rows.length} subscriptions` : ""}
          </p>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-caption">
              <span className="text-[var(--color-text)]">Per year</span>
              <span className="font-medium text-[var(--color-text)]">
                {'\u20B9'}{annualTotal.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between text-caption">
              <span className="text-[var(--color-text)]">Over {HORIZON_YEARS} years</span>
              <span className="font-medium text-[var(--color-text)]">
                {'\u20B9'}{total5Years.toLocaleString("en-IN")}
              </span>
            </div>
            {incomePercent !== null && (
              <div className="flex items-center justify-between text-caption">
                <span className="text-[var(--color-text)]">Share of your annual income</span>
                <span className="font-medium text-[var(--color-text)]">{incomePercent.toFixed(1)}%</span>
              </div>
            )}
          </div>
          <p className="mt-2 border-t border-[var(--color-border)] pt-2 text-tiny">
            Assuming no price changes.
            {!hasIncome && " Set your monthly income to see what share of it this would be."}
          </p>
        </div>
      )}

      <div className="modal-actions">
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}