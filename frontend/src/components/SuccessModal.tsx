import type { TransactionResponse } from "../types";
import { Modal } from "./Modal";

interface Props {
  visible: boolean;
  createdTransaction: TransactionResponse | null;
  onDone: () => void;
}

export function SuccessModal({ visible, createdTransaction, onDone }: Props) {
  if (!createdTransaction) return null;

  return (
    <Modal visible={visible} onClose={onDone} titleId="success-modal-title" className="modal modal-success">
      <button
        className="modal-close"
        onClick={onDone}
        title="Close"
      >
        {'\u2715'}
      </button>
      <div className="success-icon">{'\u2705'}</div>
      <h2 id="success-modal-title">Transaction Submitted</h2>
      <p className="success-message">
        Your transaction has been entered successfully.
      </p>
      <div className="success-details">
        <div className="detail-field">
          <span className="label">Merchant</span>
          <span className="value">{createdTransaction.merchant}</span>
        </div>
        <div className="detail-field">
          <span className="label">Amount</span>
          <span className="value">{'\u20B9'}{createdTransaction.amount.toFixed(2)}</span>
        </div>
        <div className="detail-field">
          <span className="label">Payment</span>
          <span className="value">{createdTransaction.paymentMode}</span>
        </div>
        <div className="detail-field">
          <span className="label">Transaction ID</span>
          <span className="value mono">{createdTransaction.id}</span>
        </div>
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
