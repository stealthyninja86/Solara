import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";

interface Props {
  visible: boolean;
  onClose: () => void;
  onChooseFile: () => void;
}

export function ImportTipsModal({ visible, onClose, onChooseFile }: Props) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  function handleChooseFile() {
    onClose();
    onChooseFile();
  }

  return (
    <Modal visible={visible} onClose={onClose} titleId="import-tips-title" className="modal modal-detail">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="import-tips-title">
          <Icon name="import" size={16} /> Import Bank Statement
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="button flex !h-7 !w-7 !items-center !justify-center !rounded-full !p-0"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="modal-body flex flex-col gap-4">
        <p className="text-[0.85rem] leading-relaxed text-[var(--color-text-muted)]">
          Upload a CSV file from your bank and we will categorize your transactions automatically.
        </p>

        <ul className="flex flex-col gap-2 text-[0.85rem] leading-relaxed text-[var(--color-text)]">
          <li className="flex gap-2">
            <span className="shrink-0 text-[var(--color-ok)]">•</span>
            <span>
              Download the statement as <strong>Excel</strong> from your bank (most banks password-protect PDFs, but Excel downloads work fine). Then open it and <strong>Save As → CSV</strong>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 text-[var(--color-ok)]">•</span>
            <span>
              Columns like <strong>Date, Description, Amount</strong> are needed. You can remove account number, address, or other private columns before uploading.
            </span>
          </li>
        </ul>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-hover)]/50 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setExportOpen((value) => !value)}
            className="flex w-full items-center justify-between text-left text-[0.8rem] font-medium text-[var(--color-text)]"
            aria-expanded={exportOpen}
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden>{exportOpen ? "▴" : "▾"}</span> How to export from your bank
            </span>
          </button>
          {exportOpen && (
            <div className="mt-2 text-[0.8rem] leading-relaxed text-[var(--color-text-muted)]">
              <p className="mb-2 font-medium text-[var(--color-text)]">From your bank&apos;s website:</p>
              <ol className="mb-3 list-decimal pl-5">
                <li>Log in to your bank&apos;s website</li>
                <li>Go to <strong>Accounts → Statement</strong> or <strong>Transaction History</strong></li>
                <li>Select the date range you want</li>
                <li>Look for <strong>Download</strong> or <strong>Export</strong> button</li>
                <li>Choose <strong>CSV</strong> or <strong>Excel</strong> format</li>
                <li>Click Download</li>
              </ol>
              <p className="mb-2 font-medium text-[var(--color-text)]">From your bank&apos;s mobile app:</p>
              <ol className="mb-3 list-decimal pl-5">
                <li>Open your bank app</li>
                <li>Tap on the account</li>
                <li>Go to <strong>Transactions</strong> or <strong>Statement</strong></li>
                <li>Look for <strong>Download</strong> or <strong>Export</strong> icon (usually ⬇ or 📤)</li>
                <li>Select <strong>CSV</strong> or <strong>Excel</strong> format</li>
              </ol>
              <p className="mb-2 font-medium text-[var(--color-text)]">If you downloaded an Excel file (.xlsx):</p>
              <ol className="mb-2 list-decimal pl-5">
                <li>Open the file in Excel or Google Sheets</li>
                <li>Go to <strong>File → Save As</strong> (or <strong>Download → CSV</strong>)</li>
                <li>Choose <strong>CSV</strong> as the format</li>
                <li>Save the file</li>
              </ol>
              <p className="mt-2 text-[0.75rem] italic">
                Tip: Most banks support CSV export. If your bank only offers PDF, check their website — PDF
                downloads are usually available there.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-hover)]/50 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setPrivacyOpen((value) => !value)}
            className="flex w-full items-center justify-between text-left text-[0.8rem] font-medium text-[var(--color-text)]"
            aria-expanded={privacyOpen}
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden>{privacyOpen ? "▴" : "▾"}</span> Privacy note
            </span>
          </button>
          {privacyOpen && (
            <p className="mt-2 text-[0.8rem] leading-relaxed text-[var(--color-text-muted)]">
              Your file is only used to create your transactions. We do not store or share anything else from the file.
            </p>
          )}
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={handleChooseFile} className="btn-primary">
          <Icon name="import" size={12} /> Choose file
        </button>
      </div>
    </Modal>
  );
}
