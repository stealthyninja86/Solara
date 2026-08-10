import type { CategorizedTransactionResponse, TransactionCategory } from "../../types";
import { SUGGESTED_CATEGORIES } from "../../constants";
import { categoryWithEmoji, formatCategory } from "../../utils";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";

interface DetailState {
  detailTransaction: CategorizedTransactionResponse | null;
  editMerchant: string;
  editDescription: string;
  editCategory: TransactionCategory | "";
  detailLoading: boolean;
  setDetailTransaction: (v: CategorizedTransactionResponse | null) => void;
  setEditMerchant: (v: string) => void;
  setEditDescription: (v: string) => void;
  setEditCategory: (v: TransactionCategory | "") => void;
  handleDetailSave: () => Promise<void>;
}

export function TransactionDetailModal({ detail }: { detail: DetailState }) {
  const visible = detail.detailTransaction !== null;

  const handleClose = () => detail.setDetailTransaction(null);

  return (
    <Modal visible={visible} onClose={handleClose} titleId="detail-modal-title" className="modal modal-detail">
      <h2 id="detail-modal-title"><Icon name="transaction-details" size={16} /> Transaction Details</h2>

      <div className="detail-field">
        <span className="label">Transaction ID</span>
        <span className="value mono">{detail.detailTransaction?.transactionId}</span>
      </div>

      <div className="detail-field">
        <span className="label">User ID</span>
        <span className="value mono">{detail.detailTransaction?.userId}</span>
      </div>

      <div className="detail-field">
        <label htmlFor="detail-merchant">Merchant</label>
        <input
          id="detail-merchant"
          value={detail.editMerchant}
          onChange={(e) => detail.setEditMerchant(e.target.value)}
        />
      </div>

      <div className="detail-field">
        <span className="label">Original Description</span>
        <span className="value">{detail.detailTransaction?.originalDescription ?? "\u2014"}</span>
      </div>

      <div className="detail-field">
        <label htmlFor="detail-description">Description</label>
        <input
          id="detail-description"
          value={detail.editDescription}
          onChange={(e) => detail.setEditDescription(e.target.value)}
        />
      </div>

      <div className="row">
        <div className="detail-field">
          <span className="label">Amount</span>
          <span className="value">{'\u20B9'}{(detail.detailTransaction?.amount ?? 0).toFixed(2)}</span>
        </div>
        <div className="detail-field">
          <span className="label">Currency</span>
          <span className="value">{detail.detailTransaction?.currency}</span>
        </div>
      </div>

      <div className="detail-field">
        <span className="label">Payment Mode</span>
        <span className="value">{detail.detailTransaction?.paymentMode ?? "\u2014"}</span>
      </div>

      <div className="detail-field">
        <span className="label">Categorization Method</span>
        <span className="value">{detail.detailTransaction?.categorizationMethod ?? "uncategorized"}</span>
      </div>

      {detail.detailTransaction?.confidence !== null && detail.detailTransaction?.confidence !== undefined && (
        <div className="detail-field">
          <span className="label">AI Confidence</span>
          <span className="value">{((detail.detailTransaction?.confidence ?? 0) * 100).toFixed(0)}%</span>
        </div>
      )}

      <div className="detail-field">
        <span className="label">Status</span>
        {detail.detailTransaction?.needsReview ? (
          <span className="needs-review">Needs Review</span>
        ) : (
          <span className="status-done">Categorized</span>
        )}
      </div>

      <div className="detail-field">
        <span className="label">Current Category</span>
        <span className="value">{categoryWithEmoji(detail.detailTransaction?.category ?? null)}</span>
      </div>
      <div className="detail-field">
        <label htmlFor="detail-category">New Category</label>
        <select
          id="detail-category"
          value={detail.editCategory}
          onChange={(e) => detail.setEditCategory(e.target.value as TransactionCategory | "")}
        >
          <option value="">-- Select category --</option>
          {SUGGESTED_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{formatCategory(cat)}</option>
          ))}
        </select>
      </div>

      <div className="detail-timestamps">
        <div className="detail-field">
          <span className="label">Created</span>
          <span className="value mono">{detail.detailTransaction?.createdAt}</span>
        </div>
        <div className="detail-field">
          <span className="label">Updated</span>
          <span className="value mono">{detail.detailTransaction?.updatedAt}</span>
        </div>
      </div>

      <div className="modal-actions">
        <button
          className="btn-secondary"
          onClick={handleClose}
        >
          Close
        </button>
        <button
          className="btn-primary"
          disabled={detail.detailLoading}
          onClick={detail.handleDetailSave}
        >
          {detail.detailLoading ? "Saving\u2026" : "Save Changes"}
        </button>
      </div>
    </Modal>
  );
}
