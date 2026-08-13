import type { TransactionResponse } from "../../types";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";

interface DetailField {
  label: string;
  value: string;
  mono?: boolean;
}

interface Props {
  visible: boolean;
  createdTransaction?: TransactionResponse | null;
  title?: string;
  message?: string;
  details?: DetailField[];
  onDone: () => void;
}

export function SuccessModal({ visible, createdTransaction, title, message, details, onDone }: Props) {
  const effectiveTitle = title ?? "Transaction Submitted";
  const effectiveMessage = message ?? "Your transaction has been entered successfully.";
  const effectiveDetails = details ?? (createdTransaction
    ? [
        { label: "Merchant", value: createdTransaction.merchant },
        { label: "Amount", value: `${'\u20B9'}${createdTransaction.amount.toFixed(2)}` },
        { label: "Payment", value: createdTransaction.paymentMode },
        { label: "Transaction ID", value: createdTransaction.id, mono: true },
      ]
    : []);

  if (!createdTransaction && !details) return null;

  return (
    <Modal visible={visible} onClose={onDone} titleId="success-modal-title" className="modal modal-success">
      <button
        className="button modal-close"
        onClick={onDone}
        title="Close"
      >
        {'\u2715'}
      </button>
      <div className="success-icon">{'\u2705'}</div>
      <h2 id="success-modal-title"><Icon name="success" size={16} /> {effectiveTitle}</h2>
      <p className="success-message">
        {effectiveMessage}
      </p>
      <div className="success-details">
        {effectiveDetails.map((field) => (
          <div className="detail-field" key={field.label}>
            <span className="label">{field.label}</span>
            <span className={`value${field.mono ? " mono" : ""}`}>{field.value}</span>
          </div>
        ))}
      </div>
      <button
        className="btn-primary"
        onClick={onDone}
        style={{ marginTop: "1.25rem", width: "100%" }}
      >
        Done
      </button>
    </Modal>
  );
}
