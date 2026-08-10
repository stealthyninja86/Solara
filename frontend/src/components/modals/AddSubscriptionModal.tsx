import { useEffect, useRef, useState } from "react";
import { DEFAULT_USER_ID } from "../../constants";
import { api } from "../../utils/api";
import { getUserId } from "../../hooks/useAuth";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";
import type { PageResponse } from "../../types";
import type { SubscriptionKind } from "../../types/reports";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const FREQUENCIES = [
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
  { label: "Yearly", value: "YEARLY" },
] as const;

const KINDS: { value: SubscriptionKind; label: string }[] = [
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "BILL", label: "Bill" },
  { value: "RENT", label: "Rent" },
  { value: "EMI", label: "EMI" },
];

const MERCHANT_PLACEHOLDERS: Record<SubscriptionKind, string> = {
  SUBSCRIPTION: "e.g. Netflix",
  BILL: "e.g. BESCOM · electricity",
  RENT: "e.g. Flat rent · co-living",
  EMI: "e.g. iPhone 15 Pro · car loan",
};

interface KnownMerchant {
  name: string;
  amount: number;
}

export function AddSubscriptionModal({ visible, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<SubscriptionKind>("SUBSCRIPTION");
  const [merchant, setMerchant] = useState("");
  const [frequency, setFrequency] = useState<string>("MONTHLY");
  const [amount, setAmount] = useState("");
  const [tolerance, setTolerance] = useState(20);
  const [tenureMonths, setTenureMonths] = useState("");
  const [paidMonths, setPaidMonths] = useState("");
  const [payeeMerchant, setPayeeMerchant] = useState("");
  const [knownMerchants, setKnownMerchants] = useState<KnownMerchant[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!visible || loadedRef.current) return;
    loadedRef.current = true;
    const params = new URLSearchParams({
      userId: getUserId() ?? DEFAULT_USER_ID,
      page: "0",
      size: "100",
    });
    api(`/api/v1/category/transaction?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PageResponse | null) => {
        if (!data) return;
        const newestByMerchant = new Map<string, { amount: number; createdAt: number }>();
        for (const transaction of data.content) {
          const name = transaction.merchant?.trim();
          if (!name) continue;
          const timestamp = Date.parse(transaction.createdAt);
          const timestampMs = Number.isFinite(timestamp) ? timestamp : 0;
          const existing = newestByMerchant.get(name);
          if (!existing || timestampMs > existing.createdAt) {
            newestByMerchant.set(name, { amount: transaction.amount, createdAt: timestampMs });
          }
        }
        setKnownMerchants(
          [...newestByMerchant.entries()]
            .map(([name, value]) => ({ name, amount: value.amount }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setKind("SUBSCRIPTION");
      setMerchant("");
      setAmount("");
      setFrequency("MONTHLY");
      setTolerance(20);
      setTenureMonths("");
      setPaidMonths("");
      setPayeeMerchant("");
      setError("");
    }
  }, [visible]);

  const cadenceLabel = FREQUENCIES.find((entry) => entry.value === frequency)?.label.toLowerCase() ?? "";
  const amountValue = Number(amount);
  const isBill = kind === "BILL";
  const isEmi = kind === "EMI";
  const bandFormatted = isBill && Number.isFinite(amountValue) && amountValue > 0
    ? { low: (amountValue * (100 - tolerance)) / 100, high: (amountValue * (100 + tolerance)) / 100 }
    : null;

  function validate(): string | null {
    if (!merchant.trim()) return "Name is required.";
    if (!Number.isFinite(amountValue) || amountValue <= 0) return "Enter an amount greater than zero.";
    if (isEmi) {
      const tenure = Number(tenureMonths);
      if (!Number.isFinite(tenure) || tenure <= 0) return "Enter a tenure in months.";
      const paid = paidMonths === "" ? 0 : Number(paidMonths);
      if (!Number.isFinite(paid) || paid < 0 || paid > tenure) {
        return `Paid so far must be between 0 and ${tenure}.`;
      }
    }
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    const params = new URLSearchParams({ userId: getUserId() ?? DEFAULT_USER_ID });
    try {
      const res = await api(`/api/v1/insights/tracked-subscriptions?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: merchant.trim(),
          frequency,
          amount: amountValue,
          kind,
          ...(isBill ? { amountTolerancePercent: tolerance } : {}),
          ...(payeeMerchant ? { payeeMerchant } : {}),
          ...(isEmi ? { tenureMonths: Number(tenureMonths), paidMonths: paidMonths === "" ? 0 : Number(paidMonths) } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to save payment.");
        return;
      }
      onSaved();
    } catch {
      setError("Failed to save payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} titleId="add-subscription-title" className="modal modal-detail">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="add-subscription-title">
          <Icon name="recurring-payments" size={16} /> Track a payment
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
        Declare it once — we'll watch every charge and keep the next date updated.
      </p>

      <label className="mt-4 block text-label">What is it?</label>
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        {KINDS.map((entry) => {
          const selected = kind === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              aria-pressed={selected}
              className={`cursor-pointer rounded-md border px-2 py-1.5 text-small transition-colors ${
                selected
                  ? "border-[var(--color-border-emphasis)] bg-[var(--color-bg-hover)] text-[var(--color-text)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg-deep)] text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
              }`}
              onClick={() => setKind(entry.value)}
            >
              {selected ? "✓ " : ""}
              {entry.label}
            </button>
          );
        })}
      </div>

      <label className="mt-4 block text-label">
        Name
        <input
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-emphasis)]"
          value={merchant}
          onChange={(e) => {
            const value = e.target.value;
            setMerchant(value);
            const known = knownMerchants.find((entry) => entry.name === value);
            if (known) setAmount(String(known.amount));
          }}
          list="subscription-merchant-list"
          placeholder={MERCHANT_PLACEHOLDERS[kind]}
        />
        <datalist id="subscription-merchant-list">
          {knownMerchants.map((entry) => (
            <option key={entry.name} value={entry.name} />
          ))}
        </datalist>
      </label>

      <label className="mt-4 block text-label">
        Cadence
      </label>
      <div className="mt-1 grid grid-cols-4 gap-1.5">
        {FREQUENCIES.map((entry) => (
          <button
            key={entry.value}
            type="button"
            className={`cursor-pointer rounded-md border px-2 py-1.5 text-small transition-colors ${
              frequency === entry.value
                ? "border-[var(--color-border-emphasis)] bg-[var(--color-bg-hover)] text-[var(--color-text)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-deep)] text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
            }`}
            onClick={() => setFrequency(entry.value)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-label">
        Amount <span className="text-[var(--color-text-muted)]">({' \u20B9'} per {cadenceLabel})</span>
        <input
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-emphasis)]"
          type="number"
          min="0"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 649"
        />
      </label>

      {isBill && (
        <label className="mt-4 block text-label">
          Expect bills to vary by
          <input
            className="mt-1 w-full accent-[var(--color-cat-3)]"
            type="range"
            min={5}
            max={50}
            step={5}
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
          />
          <span className="mt-1 block text-small text-[var(--color-text-muted)]">
            ±{tolerance}%{bandFormatted ? ` — we'll match ₹${bandFormatted.low.toLocaleString("en-IN")} to ₹${bandFormatted.high.toLocaleString("en-IN")}` : ""}
          </span>
        </label>
      )}

      {isEmi && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-label">
            Tenure (months)
            <input
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-emphasis)]"
              type="number"
              min="1"
              inputMode="numeric"
              value={tenureMonths}
              onChange={(e) => setTenureMonths(e.target.value)}
              placeholder="e.g. 24"
            />
          </label>
          <label className="block text-label">
            Paid so far
            <input
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-emphasis)]"
              type="number"
              min="0"
              inputMode="numeric"
              value={paidMonths}
              onChange={(e) => setPaidMonths(e.target.value)}
              placeholder="e.g. 8"
            />
          </label>
        </div>
      )}

      <div className="mt-4">
        <label className="block text-label">Link a past payment (optional)</label>
        <select
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-emphasis)]"
          value={payeeMerchant}
          onChange={(e) => setPayeeMerchant(e.target.value)}
        >
          <option value="">No charge linked yet</option>
          {knownMerchants.map((entry) => (
            <option key={entry.name} value={entry.name}>{entry.name}</option>
          ))}
        </select>
        <p className="mt-1 text-small text-[var(--color-text-muted)]">
          {payeeMerchant
            ? "We'll match charges paid to this payee name."
            : "Paid already? Pick the matching transaction name so we match the exact payee — otherwise we'll match from the first charge to appear."}
        </p>
      </div>

      {error && <p className="mt-3 text-small text-[var(--color-bad)]">{error}</p>}

      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving\u2026" : "Save payment"}
        </button>
      </div>
    </Modal>
  );
}