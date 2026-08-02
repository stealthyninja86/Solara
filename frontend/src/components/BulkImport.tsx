import { useEffect } from "react";
import { Modal } from "./Modal";
import { useTransactions } from "../hooks/useTransactions";
import { TransactionTable } from "./TransactionTable";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { Icon } from "./Icon";

interface BulkImportProps {
  visible: boolean;
  onClose: () => void;
  importedCount?: number;
  importStartedAt?: number;
  onDelete?: () => void;
}

export function BulkImport({ visible, onClose, importedCount, importStartedAt, onDelete }: BulkImportProps) {
  return (
    <Modal visible={visible} onClose={onClose} titleId="bulk-import-title" className="modal modal-import">
      {visible && <BulkImportContent onClose={onClose} importedCount={importedCount} importStartedAt={importStartedAt} onDelete={onDelete} />}
    </Modal>
  );
}

function BulkImportContent({ onClose, importedCount, importStartedAt, onDelete }: { onClose: () => void; importedCount?: number; importStartedAt?: number; onDelete?: () => void }) {
  const transactionsManager = useTransactions();

  useEffect(() => {
    if (importStartedAt) {
      const date = new Date(importStartedAt);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      transactionsManager.setDateFrom(iso);
      transactionsManager.setDateFilterKey((k) => k + 1);
    }
    if (importedCount && importedCount > 0) {
      transactionsManager.setPageSize(importedCount);
    }
  }, []);

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 id="bulk-import-title" className="text-[1rem] font-medium text-[var(--color-text)]">
          <Icon name="imported-transactions" size={16} /> Imported Transactions
        </h2>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border-emphasis)] hover:text-[var(--color-text)]"
          title="Close"
        >
          {'\u2715'}
        </button>
      </div>

      <TransactionTable state={transactionsManager} onDelete={() => {
        transactionsManager.fetchTransactions(transactionsManager.currentPage);
        onDelete?.();
      }} />

      <TransactionDetailModal detail={transactionsManager} />

      <div className="flex justify-end mt-4">
        <button
          className="mt-0! w-auto! cursor-pointer rounded-md border border-[var(--color-border-emphasis)]! bg-transparent! px-6! py-2.5! text-[0.85rem]! text-[var(--color-text-light)]! transition-colors hover:bg-[var(--color-bg-hover)]! hover:text-[var(--color-text)]!"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </>
  );
}
