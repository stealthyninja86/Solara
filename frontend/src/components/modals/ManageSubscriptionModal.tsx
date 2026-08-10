import { useEffect, useRef, useState } from "react";
import { DEFAULT_USER_ID } from "../../constants";
import { api } from "../../utils/api";
import { getUserId } from "../../hooks/useAuth";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";
import type { PageResponse } from "../../types";
import type { SubscriptionKind, TrackedSubscription } from "../../types/reports";

interface Props {
  subscription: TrackedSubscription | null;
  onClose: () => void;
  onSaved: () => void;
}

const KINDS: { value: SubscriptionKind; label: string }[] = [
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "BILL", label: "Bill" },
  { value: "RENT", label: "Rent" },
  { value: "EMI", label: "EMI" },
];

const FREQUENCIES = [
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
  { label: "Yearly", value: "YEARLY" },
] as const;

export function ManageSubscriptionModal({ subscription, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<SubscriptionKind>("SUBSCRIPTION");
  const [merchant, setMerchant] = useState("");
  const [frequency, setFrequency] = useState<string>("MONTHLY");
  const [amount, setAmount] = useState("");
  const [tolerance, setTolerance] = useState(20);
  const [tenureMonths, setTenureMonths] = useState("");
  const [paidMonths, setPaidMonths] = useState("");
  const [payeeMerchant, setPayeeMerchant] = useState("");
  const [knownMerchants, setKnownMerchants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const loadedRef = useRef(false);

  const visible = subscription !== null;

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
        const merchants = data.content
          .map((transaction) => transaction.merchant)
          .filter((name): name is string => Boolean(name?.trim()));
        setKnownMerchants([...new Set(merchants)].sort());
      })
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (subscription) {
      setKind(subscription.kind ?? "SUBSCRIPTION");
      setMerchant(subscription.merchant);
      setFrequency(subscription.frequency);
      setAmount(String(subscription.amount));
      setTolerance(subscription.amountTolerancePercent ?? 20);
      setTenureMonths(subscription.tenureMonths != null ? String(subscription.tenureMonths) : "");
      setPaidMonths(subscription.paidMonths != null ? String(subscription.paidMonths) : "");
      setPayeeMerchant(subscription.payeeMerchant ?? "");
      setError("");
      setConfirmingCancel(false);
    }
  }, [subscription]);

  const cadenceLabel = FREQUENCIES.find((entry) => entry.value === frequency)?.label.toLowerCase() ?? "";
  const amountValue = Number(amount);
  const isBill = kind === "BILL";
  const isEmi = kind === "EMI";
  const bandFormatted = isBill && Number.isFinite(amountValue) && amountValue > 0
    ? { low: (amountValue * (100 - tolerance)) / 100, high: (amountValue * (100 + tolerance)) / 100 }
    : null;

  async function handleSave() {
    if (!subscription) return;
    const trimmed = merchant.trim();
    if (!trimmed) {
      setError("Merchant name is required.");
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (isEmi) {
      const tenure = Number(tenureMonths);
      if (!Number.isFinite(tenure) || tenure <= 0) {
        setError("Enter a tenure in months.");
        return;
      }
      const paid = paidMonths === "" ? 0 : Number(paidMonths);
      if (!Number.isFinite(paid) || paid < 0 || paid > tenure) {
        setError(`Paid so far must be between 0 and ${tenure}.`);
        return;
      }
    }
    setSaving(true);
    setError("");
    const params = new URLSearchParams({ userId: getUserId() ?? DEFAULT_USER_ID });
    try {
      const res = await api(`/api/v1/insights/tracked-subscriptions/${subscription.id}?${params}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: trimmed,
          frequency,
          amount: amountValue,
          kind,
          ...(isBill ? { amountTolerancePercent: tolerance } : {}),
          ...(isBill && payeeMerchant ? { payeeMerchant } : {}),
          ...(isEmi ? { tenureMonths: Number(tenureMonths), paidMonths: paidMonths === "" ? 0 : Number(paidMonths) } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to save subscription.");
        return;
      }
      onSaved();
    } catch {
      setError("Failed to save subscription.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!subscription) return;
    setSaving(true);
    setError("");
    const params = new URLSearchParams({ userId: getUserId() ?? DEFAULT_USER_ID });
    try {
      const res = await api(`/api/v1/insights/tracked-subscriptions/${subscription.id}/cancel?${params}`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to cancel subscription.");
        return;
      }
      onSaved();
    } catch {
      setError("Failed to cancel subscription.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} onClose={onClose} titleId="manage-subscription-title" className="modal modal-detail">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="manage-subscription-title">
          <Icon name="recurring-payments" size={16} /> Manage Subscription
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
        Edit the details, or stop tracking this subscription.
      </p>

      <label className="mt-4 block text-label">
        Merchant
        <input
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-emphasis)]"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          list="manage-subscription-merchant-list"
          placeholder="e.g. Netflix"
        />
        <datalist id="manage-subscription-merchant-list">
          {knownMerchants.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>

      <label className="mt-4 block text-label">What is it?</label>
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        {KINDS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            className={`cursor-pointer rounded-md border px-2 py-1.5 text-small transition-colors ${
              kind === entry.value
                ? "border-[var(--color-border-emphasis)] bg-[var(--color-bg-hover)] text-[var(--color-text)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-deep)] text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
            }`}
            onClick={() => setKind(entry.value)}
          >
            {entry.label}
          </button>
        ))}
      </div>

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
            />
          </label>
        </div>
      )}

      {isBill && (
        <div className="mt-4">
          <label className="block text-label">Payer name for matching</label>
          <select
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-border-emphasis)]"
            value={payeeMerchant}
            onChange={(e) => setPayeeMerchant(e.target.value)}
          >
            <option value="">No charge linked yet</option>
            {knownMerchants.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <p className="mt-1 text-small text-[var(--color-text-muted)]">
            {payeeMerchant
              ? "We'll match charges paid to this payee name."
              : "Pick the transaction name this bill is paid to so we match it."}
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-small text-[var(--color-bad)]">{error}</p>}

      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose} disabled={saving}>
          Keep
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving\u2026" : "Save changes"}
        </button>
      </div>

      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        {confirmingCancel ? (
          <div className="rounded-lg border border-[var(--color-bad)]/30 bg-[var(--color-bad)]/5 p-3">
            <p className="text-caption text-[var(--color-text)]">
              Stop tracking this subscription? It moves to your cancelled list and stops counting toward the annual total.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="button button-danger !px-3 !py-1.5 !text-small"
              >
                {saving ? "Cancelling\u2026" : "Yes, cancel it"}
              </button>
              <button
                onClick={() => setConfirmingCancel(false)}
                disabled={saving}
                className="button !px-3 !py-1.5 !text-small"
              >
                No, keep it
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingCancel(true)}
            className="button button-danger !px-3 !py-1.5 !text-small"
          >
            Cancel subscription
          </button>
        )}
      </div>
    </Modal>
  );
}
