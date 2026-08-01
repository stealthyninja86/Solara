import type { PaymentMode, TransactionType } from "../types";
import { PAYMENT_MODES, TRANSACTION_TYPES } from "../constants";

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
}

export function TransactionForm({
  merchant, amount, paymentMode, transactionType, description, loading, error,
  onMerchantChange, onAmountChange, onPaymentModeChange, onTransactionTypeChange,
  onDescriptionChange, onSubmit,
}: Props) {
  return (
    <div>
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
  );
}
