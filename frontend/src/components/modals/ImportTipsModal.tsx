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
          A few quick tips before you upload — they help us read your file correctly and keep your data safe.
        </p>

        <ul className="flex flex-col gap-3 text-[0.85rem] leading-relaxed text-[var(--color-text)]">
          <li className="flex gap-2">
            <span className="shrink-0 text-[var(--color-ok)]">•</span>
            <span>
              Upload your bank CSV file. Maximum size is <strong>2 MB</strong> — that is about 10 to 15 years of
              statements, so most files fit easily.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 text-[var(--color-ok)]">•</span>
            <span>
              If your file is larger than 2 MB, split it into smaller files.{" "}
              <strong>Keep the first row with headings like Date, Description, Amount in each file</strong> — we need
              that row to understand your data. Upload the files one at a time.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 text-[var(--color-ok)]">•</span>
            <span>
              You can remove private details before uploading — like account number, address, or name. We mainly need
              columns like <strong>Date, Description, Amount etc.</strong> — keep those so we can read your file
              correctly.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 text-[var(--color-ok)]">•</span>
            <span>After you upload, it takes a moment to process. You can keep using the app — we will show you when it is done.</span>
          </li>
        </ul>

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
