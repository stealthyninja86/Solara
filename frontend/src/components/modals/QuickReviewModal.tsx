import type { CategorizedTransactionResponse, PaymentMode, TransactionCategory, TransactionResponse } from "../../types";
import { CATEGORY_DESCRIPTIONS, SUGGESTED_CATEGORIES, PAYMENT_MODES } from "../../constants";
import { categoryWithEmoji, formatCategory } from "../../utils";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";

interface Props {
  visible: boolean;
  mode?: "review" | "detail";
  createdTransaction: TransactionResponse | null;
  reviewData: CategorizedTransactionResponse | null;
  pollFailed?: boolean;
  onRetryPolling?: () => void;
  selectedCategory: TransactionCategory | "";
  onCategoryChange: (v: TransactionCategory | "") => void;
  reviewDescription: string;
  onDescriptionChange: (v: string) => void;
  editMerchant: string;
  onMerchantChange: (v: string) => void;
  editAmount: string;
  onAmountChange: (v: string) => void;
  editPaymentMode: PaymentMode;
  onPaymentModeChange: (v: PaymentMode) => void;
  onLooksGood: () => void;
  onReview: () => void;
  onDetailSave?: () => void;
  detailSaveLoading?: boolean;
  onClose: () => void;
}

export function QuickReviewModal({
  visible, mode = "review", createdTransaction, reviewData, pollFailed, onRetryPolling,
  selectedCategory, onCategoryChange,
  reviewDescription, onDescriptionChange,
  editMerchant, onMerchantChange,
  editAmount, onAmountChange,
  editPaymentMode, onPaymentModeChange,
  onLooksGood, onReview, onDetailSave, detailSaveLoading,
  onClose,
}: Props) {
  const data = reviewData;
  const isBulkImport = data?.bulkImport ?? false;

  const inputClass = "rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-2.5 py-1 text-[0.8rem] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]";
  const labelClass = "text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]";

  return (
    <Modal visible={visible} onClose={() => {}} titleId="review-modal-title" className="modal modal-detail">
      <div className="flex items-center justify-between">
        <h2 id="review-modal-title"><Icon name="review-transaction" size={16} /> {mode === "detail" ? "Transaction Details" : "Review Transaction"}</h2>
        <button
          onClick={onClose}
          className="button flex !h-7 !w-7 !items-center !justify-center !rounded-full !p-0"
          title="Close"
        >
          ✕
        </button>
      </div>
      <p className="modal-hint">{mode === "detail" ? "View and edit your transaction details" : "Review and edit your transaction details before saving"}</p>

      {/* Transaction Details */}
      <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className={`${labelClass} mb-2`}>Transaction Details</p>
        <div className="space-y-2">
          {mode === "detail" && data?.transactionId && (
            <div className="flex items-center gap-3">
              <label className={`${labelClass} w-20 shrink-0 text-right`}>Tx ID</label>
              <span className="text-[0.75rem] text-[var(--color-text-muted)] mono truncate">{data.transactionId}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className={`${labelClass} w-20 shrink-0 text-right`}>Merchant</label>
            <input
              type="text"
              value={editMerchant}
              onChange={(e) => onMerchantChange(e.target.value)}
              className={`${inputClass} flex-1`}
            />
          </div>
          {mode === "detail" && data?.originalDescription && (
            <div className="flex items-center gap-3">
              <label className={`${labelClass} w-20 shrink-0 text-right`}>Orig Desc</label>
              <span className="text-[0.75rem] leading-snug text-[var(--color-text-muted)] break-words flex-1">{data.originalDescription}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className={`${labelClass} w-20 shrink-0 text-right`}>Amount</label>
            <div className="flex flex-1 items-center gap-1.5">
              <span className="text-[var(--color-text-muted)]">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editAmount}
                onChange={(e) => onAmountChange(e.target.value)}
                className={`${inputClass} w-28`}
              />
              <span className="ml-1 text-[0.75rem] text-[var(--color-text-muted)]">{data?.currency ?? createdTransaction?.currency ?? "INR"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className={`${labelClass} w-20 shrink-0 text-right`}>Payment</label>
            <select
              value={editPaymentMode}
              onChange={(e) => onPaymentModeChange(e.target.value as PaymentMode)}
              className={`${inputClass} flex-1`}
            >
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>{mode.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Categorization */}
      <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <p className={`${labelClass} mb-2`}>Categorization</p>

        {data ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.75rem] text-[var(--color-text-muted)]">Suggested</span>
              <span className="text-[0.8rem] text-[var(--color-text)]">{categoryWithEmoji(data.category) || "Uncategorized"}</span>
            </div>
            {data.confidence != null && (
              <div className="flex items-center justify-between">
                <span className="text-[0.75rem] text-[var(--color-text-muted)]">Confidence</span>
                <span className="text-[0.8rem] text-[var(--color-text)]">{(data.confidence * 100).toFixed(1)}%</span>
              </div>
            )}
            {data.categorizationMethod && (
              <div className="flex items-center justify-between">
                <span className="text-[0.75rem] text-[var(--color-text-muted)]">Method</span>
                <span className="text-[0.8rem] text-[var(--color-text)]">{data.categorizationMethod}</span>
              </div>
            )}
            {mode === "detail" && (
              <div className="flex items-center justify-between">
                <span className="text-[0.75rem] text-[var(--color-text-muted)]">Status</span>
                {data.needsReview ? (
                  <span className="needs-review">Needs Review</span>
                ) : (
                  <span className="status-done">Categorized</span>
                )}
              </div>
            )}
          </div>
        ) : pollFailed ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <span className="text-[0.8rem] text-[var(--color-text-muted)]">Categorization is taking longer than expected.</span>
            {onRetryPolling && (
              <button
                onClick={onRetryPolling}
                className="button !w-auto !px-3 !py-1 !text-[0.75rem] text-[var(--color-text-secondary)]!"
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border-emphasis)] border-t-[var(--color-accent)]" />
            <span className="text-[0.8rem] text-[var(--color-text-muted)]">Categorizing your transaction...</span>
          </div>
        )}

        {data?.needsReview && (
          <span className="needs-review mt-2 inline-block">Needs Review</span>
        )}

        <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
          <label htmlFor="review-category" className={`${labelClass} mb-1 block`}>Override Category</label>
          <select
            id="review-category"
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value as TransactionCategory | "")}
            className={`${inputClass} w-full`}
          >
            <option value="">Keep suggestion</option>
            {SUGGESTED_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} title={CATEGORY_DESCRIPTIONS[cat]}>
                {formatCategory(cat)} - {CATEGORY_DESCRIPTIONS[cat]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[0.65rem] leading-snug text-[var(--color-text-muted)]">
            {selectedCategory ? CATEGORY_DESCRIPTIONS[selectedCategory] : "Leave empty to keep the AI suggestion."}
          </p>
        </div>

        {data?.llmMessage && (
          <div className="mt-2 rounded bg-[var(--color-bg-deep)] p-2">
            <p className="text-[0.65rem] text-[var(--color-text-muted)]">{data.llmMessage}</p>
          </div>
        )}
      </div>

      {/* Description — for bulk imports and detail mode */}
      {(isBulkImport || mode === "detail") && (
        <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className={`${labelClass} mb-2`}>Description</p>
          <textarea
            id="review-description"
            rows={2}
            value={reviewDescription || data?.description || ""}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className={`${inputClass} w-full resize-none`}
          />
        </div>
      )}

      {/* Timestamps */}
      {(data?.createdAt || data?.updatedAt) && (
        <div className="flex gap-4 border-t border-[var(--color-border)] pt-2">
          {data?.createdAt && (
            <span className="text-[0.65rem] text-[var(--color-text-muted)]">
              Created: {new Date(data.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {data?.updatedAt && (
            <span className="text-[0.65rem] text-[var(--color-text-muted)]">
              Updated: {new Date(data.updatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      <div className="modal-actions mt-3">
        {mode === "detail" ? (
          <>
            <button className="btn-secondary" onClick={onClose}>Close</button>
            <button className="btn-primary" disabled={detailSaveLoading} onClick={onDetailSave}>
              {detailSaveLoading ? "Saving\u2026" : "Save Changes"}
            </button>
          </>
        ) : (
          <>
            <button className="btn-secondary" onClick={onReview}>Review</button>
            <button className="btn-primary" onClick={onLooksGood}>Looks Good!</button>
          </>
        )}
      </div>
    </Modal>
  );
}
