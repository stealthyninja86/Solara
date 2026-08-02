import type { CategorizedTransactionResponse, TransactionResponse } from "../types";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

interface Props {
  visible: boolean;
  createdTransaction: TransactionResponse | null;
  createdDescription: string;
  reviewData: CategorizedTransactionResponse | null;
  onLooksGood: () => void;
  onReview: () => void;
}

export function QuickReviewModal({
  visible, createdTransaction, createdDescription,
  reviewData, onLooksGood, onReview,
}: Props) {
  return (
    <Modal visible={visible} onClose={onLooksGood} titleId="review-modal-title" className="modal modal-detail">
      <h2 id="review-modal-title"><Icon name="review-transaction" size={16} /> Review Transaction</h2>
      <p className="modal-hint">Categorization result for your transaction</p>

      <div className="detail-field">
        <span className="label">Merchant</span>
        <span className="value">{createdTransaction?.merchant ?? ""}</span>
      </div>
      <div className="detail-field">
        <span className="label">Description</span>
        <span className="value">{createdDescription || "\u2014"}</span>
      </div>
      <div className="detail-field">
        <span className="label">Amount</span>
        <span className="value">{'\u20B9'}{(createdTransaction?.amount ?? 0).toFixed(2)}</span>
      </div>

      <hr />

      <div className="detail-field">
        <span className="label">Suggested Category</span>
        <span className="value">
          {reviewData ? reviewData.category || "Uncategorized" : "Loading\u2026"}
        </span>
      </div>
      <div className="detail-field">
        <span className="label">Confidence</span>
        <span className="value">
          {reviewData
            ? reviewData.confidence != null
              ? (reviewData.confidence * 100).toFixed(1) + "%"
              : "\u2014"
            : "Loading\u2026"}
        </span>
      </div>
      {reviewData?.llmMessage && (
        <div className="detail-field" style={{ alignItems: "flex-start" }}>
          <span className="label">LLM Note</span>
          <span className="value" style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", textAlign: "right", maxWidth: "60%" }}>
            {reviewData.llmMessage}
          </span>
        </div>
      )}

      <div className="modal-actions">
        <button className="btn-secondary" onClick={onLooksGood}>
          Looks Good!
        </button>
        <button className="btn-primary" onClick={onReview}>
          Review
        </button>
      </div>
    </Modal>
  );
}
