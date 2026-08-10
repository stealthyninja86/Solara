import type { TransactionCategory } from "../../types";
import { SUGGESTED_CATEGORIES } from "../../constants";
import { formatCategory } from "../../utils";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";

interface Props {
  visible: boolean;
  selectedCategory: string;
  saving: boolean;
  onSelect: (category: TransactionCategory) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}

export function CategoryModal({
  visible, selectedCategory, saving,
  onSelect, onSave, onClose,
}: Props) {
  return (
    <Modal visible={visible} onClose={onClose} titleId="category-modal-title">
      <h2 id="category-modal-title"><Icon name="category-breakdown" size={16} /> Categorize Transaction</h2>
      <p className="modal-hint">This transaction needs review. Assign a category:</p>
      <div className="category-grid">
        {SUGGESTED_CATEGORIES.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className={`category-chip${selectedCategory === suggestion ? " active" : ""}`}
            onClick={() => onSelect(suggestion)}
          >
            {formatCategory(suggestion)}
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Skip
        </button>
        <button
          className="btn-primary"
          disabled={!selectedCategory.trim() || saving}
          onClick={onSave}
        >
          {saving ? "Saving\u2026" : "Save Category"}
        </button>
      </div>
    </Modal>
  );
}
