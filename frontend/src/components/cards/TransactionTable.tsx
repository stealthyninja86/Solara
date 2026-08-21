import type { CategorizedTransactionResponse } from "../../types";
import type { TrackedSubscription, SubscriptionKind } from "../../types/reports";
import { CATEGORY_DESCRIPTIONS, SUGGESTED_CATEGORIES, PAYMENT_MODES } from "../../constants";
import { categoryWithEmoji, formatCategory, formatDate } from "../../utils";
import { HowItWorks, type HowItWorksItem } from "../ui/HowItWorks";
import { Icon } from "../ui/Icon";

interface TransactionsState {
  transactions: CategorizedTransactionResponse[];
  currentPage: number;
  totalPages: number;
  totalElements: number;
  listLoading: boolean;
  categoryFilter: string;
  paymentFilter: string;
  dateFrom: string;
  dateTo: string;
  dateUI: "idle" | "from" | "to";
  updatedAtFrom: string;
  updatedUI: "idle" | "from";
  dateFilterKey: number;
  fetchTransactions: (page: number) => Promise<void>;
  handleDelete: (id: string) => Promise<boolean>;
  toggleSort: (field: string) => void;
  sortIndicator: (field: string) => string;
  setCategoryFilter: (v: string) => void;
  setPaymentFilter: (v: string) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  setDateUI: (v: "idle" | "from" | "to") => void;
  setUpdatedAtFrom: (v: string) => void;
  setUpdatedUI: (v: "idle" | "from") => void;
  setDateFilterKey: (v: number | ((k: number) => number)) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  highlightTransactionId?: string | null;
  onRowClick?: (transaction: CategorizedTransactionResponse) => void;
}

const KIND_BADGE: Record<SubscriptionKind, { label: string; color: string; border: string; background: string }> = {
  SUBSCRIPTION: { label: "SUBSCRIPTION", color: "var(--color-badge-subscription)", border: "var(--color-badge-subscription-border)", background: "var(--color-badge-subscription-bg)" },
  BILL: { label: "BILL", color: "var(--color-badge-bill)", border: "var(--color-badge-bill-border)", background: "var(--color-badge-bill-bg)" },
  RENT: { label: "RENT", color: "var(--color-badge-rent)", border: "var(--color-badge-rent-border)", background: "var(--color-badge-rent-bg)" },
  EMI: { label: "EMI", color: "var(--color-badge-emi)", border: "var(--color-badge-emi-border)", background: "var(--color-badge-emi-bg)" },
};

function findSubscriptionKind(
  transactionMerchant: string,
  subscriptions: TrackedSubscription[],
): SubscriptionKind | null {
  const txLower = (transactionMerchant ?? "").toLowerCase();
  if (!txLower) return null;

  for (const sub of subscriptions) {
    if (sub.status !== "ACTIVE") continue;
    const subLower = sub.merchant.toLowerCase();
    // Exact match
    if (txLower === subLower) return sub.kind ?? "SUBSCRIPTION";
    // Transaction contains subscription merchant (e.g. "UPI/DR/.../RENT/..." matches "rent")
    if (txLower.includes(subLower)) return sub.kind ?? "SUBSCRIPTION";
    // Subscription contains transaction merchant (e.g. "HDFC Bank Loan" matches "HDFC")
    if (subLower.includes(txLower) && txLower.length >= 3) return sub.kind ?? "SUBSCRIPTION";
  }
  return null;
}

export function TransactionTable({ state, onDelete, subscriptions, highlightTransactionId, onRowClick }: { state: TransactionsState; onDelete?: () => void; subscriptions?: TrackedSubscription[]; highlightTransactionId?: string | null; onRowClick?: (transaction: CategorizedTransactionResponse) => void }) {
  const activeSubscriptions = subscriptions ?? [];
  if (state.listLoading) {
    return (
      <div className="card">
        <div className="tx-header">
          <h2><Icon name="transactions" size={14} /> All Transactions</h2>
          <div className="tx-page-size">
            <span className="tx-page-size-label">Rows:</span>
            <select
              className="tx-page-size-select"
              value={state.pageSize}
              onChange={(e) => state.setPageSize(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
        <p className="loading-text">Loading\u2026</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="tx-header">
        <h2><Icon name="transactions" size={14} /> All Transactions</h2>
        <div className="tx-page-size">
          <span className="tx-page-size-label">Rows:</span>
          <select
            className="tx-page-size-select"
            value={state.pageSize}
            onChange={(e) => state.setPageSize(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
      <div className="transaction-table">
        <div className="transaction-row transaction-row--header">
          <span className="transaction-cell tx-col-num">#</span>
          <span
            className="transaction-cell tx-col-sortable"
            onClick={() => state.toggleSort("merchant")}
          >
            {state.sortIndicator("merchant")} Merchant
          </span>
          <span
            className="transaction-cell tx-col-sortable tx-col-amount"
            onClick={() => state.toggleSort("amount")}
          >
            {state.sortIndicator("amount")} Amount
          </span>
          <span
            className="transaction-cell tx-col-sortable"
            onClick={() => state.toggleSort("category")}
          >
            {state.sortIndicator("category")} Category
          </span>
          <span className="transaction-cell">Payment</span>
          <span className="transaction-cell">Status</span>
          <span
            className="transaction-cell tx-col-sortable"
            onClick={() => state.toggleSort("createdAt")}
          >
            {state.sortIndicator("createdAt")} Date
          </span>
          <span
            className="transaction-cell tx-col-sortable"
            onClick={() => state.toggleSort("updatedAt")}
          >
            {state.sortIndicator("updatedAt")} Updated
          </span>
          <span className="transaction-cell" />
        </div>

        <div className="transaction-row transaction-row--filters">
          <div className="transaction-cell tx-col-num" />
          <div className="transaction-cell transaction-cell--merchant" />
          <div className="transaction-cell transaction-cell--amount" />
          <div className="transaction-cell transaction-cell--category">
            <select
              className="filter-select"
              value={state.categoryFilter}
              onChange={(e) => state.setCategoryFilter(e.target.value)}
              title={state.categoryFilter ? CATEGORY_DESCRIPTIONS[state.categoryFilter] ?? "" : ""}
            >
              <option value="">All</option>
              <option value="__uncategorized__" title={CATEGORY_DESCRIPTIONS["UNCATEGORIZED"]}>Uncategorized - {CATEGORY_DESCRIPTIONS["UNCATEGORIZED"]}</option>
              {SUGGESTED_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} title={CATEGORY_DESCRIPTIONS[cat]}>{formatCategory(cat)} - {CATEGORY_DESCRIPTIONS[cat]}</option>
              ))}
              <option value="OTHER" title={CATEGORY_DESCRIPTIONS["OTHER"]}>{formatCategory("OTHER")} - {CATEGORY_DESCRIPTIONS["OTHER"]}</option>
            </select>
          </div>
          <div className="transaction-cell transaction-cell--payment">
            <select
              className="filter-select"
              value={state.paymentFilter}
              onChange={(e) => state.setPaymentFilter(e.target.value)}
            >
              <option value="">All</option>
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </div>
          <div className="transaction-cell transaction-cell--status" />
          <div className="transaction-cell transaction-cell--date" />
          <div className="transaction-cell transaction-cell--updated" />
          <div className="transaction-cell transaction-cell--action" />
        </div>

        {state.transactions.length === 0 ? (
          <div className="py-8 text-center">
            {state.totalElements === 0 ? (
              <>
                <p className="empty-text">
                  No transactions yet
                </p>
                <p className="mt-1 text-[0.75rem]" style={{ color: "var(--color-text-muted)" }}>
                  Add one manually or import a bank CSV to get started.
                </p>
              </>
            ) : (
              <p className="empty-text">
                No matching transactions
              </p>
            )}
          </div>
        ) : (
          state.transactions.map((transaction, index) => (
            <div
              key={transaction.transactionId}
              className={`transaction-row transaction-row--data${highlightTransactionId && highlightTransactionId === transaction.transactionId ? " transaction-row--highlight" : ""}`}
              onClick={() => onRowClick?.(transaction)}
            >
              <span className="transaction-cell tx-col-num">
                {state.currentPage * state.pageSize + index + 1}
              </span>
              <span className="transaction-cell transaction-cell--merchant">
                {transaction.merchant}
                {(() => {
                  const kind = findSubscriptionKind(transaction.merchant ?? "", activeSubscriptions);
                  if (!kind) return null;
                  const badge = KIND_BADGE[kind];
                  return (
                    <span
                      className="tx-badge"
                      style={{ color: badge.color, borderColor: badge.border, background: badge.background }}
                    >
                      {badge.label}
                    </span>
                  );
                })()}
              </span>
              <span className="transaction-cell transaction-cell--amount">
                <span className={transaction.type === "DEBIT" ? "text-red-400" : "text-green-400"}>
                  {transaction.type === "DEBIT" ? "\u2193" : "\u2191"}
                </span>
                {'\u20B9'}{transaction.amount.toFixed(2)}
              </span>
              <span className="transaction-cell transaction-cell--category" title={transaction.category ? CATEGORY_DESCRIPTIONS[transaction.category] ?? "" : ""}>
                {categoryWithEmoji(transaction.category)}
              </span>
              <span className="transaction-cell transaction-cell--payment">
                {transaction.paymentMode ?? "\u2014"}
              </span>
              <span className="transaction-cell transaction-cell--status">
                {transaction.needsReview ? (
                  <span className="needs-review">Review</span>
                ) : (
                  <span className="status-done">Done</span>
                )}
              </span>
              <span className="transaction-cell transaction-cell--date">
                {formatDate(transaction.createdAt)}
              </span>
              <span className="transaction-cell transaction-cell--updated">
                {formatDate(transaction.updatedAt)}
              </span>
              <span className="transaction-cell transaction-cell--action">
                  <button
                    className="btn-delete"
                    title="Delete transaction"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const success = await state.handleDelete(transaction.transactionId);
                      if (success) {
                        onDelete?.();
                      }
                    }}
                  >
                    {'\u2715'}
                  </button>
              </span>
            </div>
          ))
        )}
      </div>

      {state.totalPages > 1 && (
        <div className="pagination">
          <button
            className="button"
            disabled={state.currentPage === 0}
            onClick={() => state.fetchTransactions(state.currentPage - 1)}
          >
            {'\u2190'} Prev
          </button>
          <span className="page-info">
            Page {state.currentPage + 1} of {state.totalPages}
          </span>
          <button
            className="button"
            disabled={state.currentPage >= state.totalPages - 1}
            onClick={() => state.fetchTransactions(state.currentPage + 1)}
          >
            Next {'\u2192'}
          </button>
        </div>
      )}

      <HowItWorks items={HOW_IT_WORKS} />
    </div>
  );
}

const HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "What's shown",
    description: "Every categorized transaction for the selected month, filtered by category or payment mode when you set them.",
  },
  {
    title: "Managing transactions",
    description: "Click a row to open the detail view and edit; the ✕ deletes a transaction. Transactions that match a tracked payment get a small badge (subscription, bill, rent, or EMI).",
  },
  {
    title: "Adding transactions",
    description: "Add transactions manually with Add Transaction or import a bank CSV — each one lands here once categorized.",
  },
];
