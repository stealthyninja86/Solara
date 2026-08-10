import { useEffect } from "react";
import { Modal } from "../ui/Modal";
import { useTransactions } from "../../hooks/useTransactions";
import { useTransactionSubmit } from "../../hooks/useTransactionSubmit";
import { TransactionTable } from "./TransactionTable";
import { QuickReviewModal } from "../modals/QuickReviewModal";
import { Icon } from "../ui/Icon";

interface BulkImportProps {
  visible: boolean;
  onClose: () => void;
  importStartedAt?: number;
  onDelete?: () => void;
}

export function BulkImport({ visible, onClose, importStartedAt, onDelete }: BulkImportProps) {
  return (
    <Modal visible={visible} onClose={onClose} titleId="bulk-import-title" className="modal modal-import">
      {visible && <BulkImportContent onClose={onClose} importStartedAt={importStartedAt} onDelete={onDelete} />}
    </Modal>
  );
}

function BulkImportContent({ onClose, importStartedAt, onDelete }: { onClose: () => void; importStartedAt?: number; onDelete?: () => void }) {
  const transactionsManager = useTransactions();
  const transactionSubmit = useTransactionSubmit();

  useEffect(() => {
    if (importStartedAt) {
      const date = new Date(importStartedAt);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      transactionsManager.setDateFrom(iso);
      transactionsManager.setDateFilterKey((k) => k + 1);
    }
    transactionsManager.setBulkImportFilter(true);
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 id="bulk-import-title" className="text-card">
          <Icon name="imported-transactions" size={16} /> Imported Transactions
        </h2>
        <button
          onClick={onClose}
          className="button flex !h-7 !w-7 !items-center !justify-center !rounded-full !p-0"
          title="Close"
        >
          {'\u2715'}
        </button>
      </div>

      <TransactionTable state={transactionsManager} onDelete={() => {
        transactionsManager.fetchTransactions(transactionsManager.currentPage);
        onDelete?.();
      }} onRowClick={(tx) => transactionSubmit.openDetailModal(tx)} />

      <QuickReviewModal
        visible={transactionSubmit.showQuickReviewModal}
        mode={transactionSubmit.detailMode}
        createdTransaction={transactionSubmit.createdTransaction}
        reviewData={transactionSubmit.reviewData}
        pollFailed={transactionSubmit.pollFailed}
        onRetryPolling={transactionSubmit.retryPollTransaction}
        selectedCategory={transactionSubmit.selectedCategory}
        onCategoryChange={transactionSubmit.setSelectedCategory}
        reviewDescription={transactionSubmit.reviewDescription}
        onDescriptionChange={transactionSubmit.setReviewDescription}
        editMerchant={transactionSubmit.editMerchant}
        onMerchantChange={transactionSubmit.setEditMerchant}
        editAmount={transactionSubmit.editAmount}
        onAmountChange={transactionSubmit.setEditAmount}
        editPaymentMode={transactionSubmit.editPaymentMode}
        onPaymentModeChange={transactionSubmit.setEditPaymentMode}
        onLooksGood={() => transactionSubmit.handleLooksGood(transactionsManager.fetchTransactions)}
        onReview={() => transactionSubmit.handleReview(transactionsManager.fetchTransactions)}
        onDetailSave={async () => {
          const ok = await transactionSubmit.handleDetailSave();
          if (ok) transactionsManager.fetchTransactions(transactionsManager.currentPage);
          transactionSubmit.setShowQuickReviewModal();
        }}
        detailSaveLoading={transactionSubmit.detailLoading}
        onClose={() => transactionSubmit.setShowQuickReviewModal()}
      />

      <div className="flex justify-end mt-4">
        <button
          className="button !w-auto !px-6 !py-2.5 !text-[0.85rem]"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </>
  );
}
