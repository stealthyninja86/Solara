import { Modal } from "./Modal";
import { useTransactions } from "../hooks/useTransactions";
import { TransactionTable } from "./TransactionTable";
import { TransactionDetailModal } from "./TransactionDetailModal";

interface BulkImportProps {
  visible: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

export function BulkImport({ visible, onClose, onDelete }: BulkImportProps) {
  return (
    <Modal visible={visible} onClose={onClose} titleId="bulk-import-title" className="modal modal-import">
      {visible && <BulkImportContent onClose={onClose} onDelete={onDelete} />}
    </Modal>
  );
}

function BulkImportContent({ onClose, onDelete }: { onClose: () => void; onDelete?: () => void }) {
  const transactionsManager = useTransactions();

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h2 id="bulk-import-title" className="text-[1rem] font-medium text-[var(--color-text)]">
          Imported Transactions
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
