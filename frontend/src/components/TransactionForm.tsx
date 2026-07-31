import { useState } from "react";
import type { PaymentMode, TransactionType } from "../types";
import { PAYMENT_MODES, TRANSACTION_TYPES } from "../constants";
import { BulkImport } from "./BulkImport";

interface Props {
  merchant: string;
  amount: string;
  paymentMode: PaymentMode;
  transactionType: TransactionType;
  description: string;
  loading: boolean;
  error: string | null;
  onMerchantChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onPaymentModeChange: (v: PaymentMode) => void;
  onTransactionTypeChange: (v: TransactionType) => void;
  onDescriptionChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onImportComplete?: () => void;
  /** When set to "single", hides view toggle arrows and only shows the transaction form. */
  mode?: "single";
}

export function TransactionForm({
  merchant, amount, paymentMode, transactionType, description, loading, error,
  onMerchantChange, onAmountChange, onPaymentModeChange, onTransactionTypeChange,
  onDescriptionChange, onSubmit, onImportComplete, mode,
}: Props) {
  const [index, setIndex] = useState(0);
  const items = ["single", "bulk"] as const;
  const isSingle = mode === "single" ? true : items[index] === "single";
  const showToggle = mode !== "single";

  function goPrev() {
    setIndex((i) => (i === 0 ? items.length - 1 : i - 1));
  }

  function goNext() {
    setIndex((i) => (i === items.length - 1 ? 0 : i + 1));
  }

  return (
    <div style={{ position: 'relative' }}>
      {showToggle && (
        <>
          <button
            onClick={goPrev}
            title="Previous view"
            style={{
              position: 'absolute', top: '50%', left: '4px', zIndex: 10, width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, margin: 0,
              transform: 'translateY(-50%)', transition: 'all 0.15s',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth={2}>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={goNext}
            title="Next view"
            style={{
              position: 'absolute', top: '50%', right: '4px', zIndex: 10, width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, margin: 0,
              transform: 'translateY(-50%)', transition: 'all 0.15s',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth={2}>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      <div className={`card relative ${showToggle ? "!pb-8" : ""}`}>
        <h2>{isSingle ? "New Transaction" : "Bulk Import"}</h2>

        <div className="overflow-hidden">
          <div
            className="flex"
            style={{
              transform: `translateX(-${index * 100}%)`,
              transition: showToggle ? 'transform 300ms ease-in-out' : 'none',
              width: showToggle ? undefined : '100%',
            }}
          >
            <div style={{ width: showToggle ? '100%' : '100%', flexShrink: 0 }}>
              <form onSubmit={onSubmit}>
                <div className="form-group">
                  <label htmlFor="merchant">Merchant</label>
                  <input
                    id="merchant"
                    placeholder="e.g. Starbucks Coffee"
                    value={merchant}
                    onChange={(e) => onMerchantChange(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <input
                    id="description"
                    placeholder="e.g. 1 caramel latte, 1 brownie"
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                  />
                </div>

                  <div className="row">
                  <div className="form-group">
                    <label htmlFor="amount">Amount (INR)</label>
                    <div className="amount-wrap">
                      <span className="amount-prefix">{'\u20B9'}</span>
                      <input
                        id="amount"
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => onAmountChange(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="transactionType">Type</label>
                    <select
                      id="transactionType"
                      value={transactionType}
                      onChange={(e) => onTransactionTypeChange(e.target.value as TransactionType)}
                    >
                      {TRANSACTION_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="paymentMode">Payment</label>
                    <select
                      id="paymentMode"
                      value={paymentMode}
                      onChange={(e) => onPaymentModeChange(e.target.value as PaymentMode)}
                    >
                      {PAYMENT_MODES.map((mode) => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={"btn-submit" + (loading ? " btn-loading" : "")}
                >
                  {loading ? <span className="spinner" /> : "Submit Transaction"}
                </button>
              </form>

              {error && <div className="error">{error}</div>}
            </div>

            <div style={{ width: '100%', flexShrink: 0 }}>
              <BulkImport onImportComplete={onImportComplete} />
            </div>
          </div>
        </div>

        {showToggle && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${index === 0 ? "bg-white" : "bg-neutral-700"}`} />
            <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${index === 1 ? "bg-white" : "bg-neutral-700"}`} />
          </div>
        )}
      </div>
    </div>
  );
}
