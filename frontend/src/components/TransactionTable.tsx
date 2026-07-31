import type { CategorizedTransactionResponse } from "../types";
import { SUGGESTED_CATEGORIES, PAYMENT_MODES } from "../constants";
import { categoryWithEmoji, formatDate } from "../utils";

interface TransactionsState {
  transactions: CategorizedTransactionResponse[];
  currentPage: number;
  totalPages: number;
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
  openDetailModal: (transaction: CategorizedTransactionResponse) => void;
  handleDelete: (id: string) => Promise<void>;
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
}

export function TransactionTable({ state, onDelete }: { state: TransactionsState; onDelete?: () => void }) {
  if (state.listLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <h2>All Transactions</h2>
          <div className="flex items-center gap-1.5">
            <span className="text-[0.65rem] text-neutral-500">Rows:</span>
            <select
              className="bg-black border border-neutral-700 rounded px-2 py-1 text-white text-[0.65rem] outline-none cursor-pointer"
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
      <div className="flex items-center justify-between">
        <h2>All Transactions</h2>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.65rem] text-neutral-500">Rows:</span>
          <select
            className="bg-black border border-neutral-700 rounded px-2 py-1 text-white text-[0.65rem] outline-none cursor-pointer"
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
        <div className="transaction-row transaction-row--header text-neutral-400 uppercase tracking-widest text-[0.65rem] hover:bg-white/[0.02]">
          <span className="transaction-cell text-center text-[0.6rem]">#</span>
          <span
            className="transaction-cell text-white cursor-pointer select-none hover:text-white text-left"
            onClick={() => state.toggleSort("merchant")}
          >
            {state.sortIndicator("merchant")} Merchant
          </span>
          <span
            className="transaction-cell text-white cursor-pointer select-none hover:text-white text-right pr-3"
            onClick={() => state.toggleSort("amount")}
          >
            {state.sortIndicator("amount")} Amount
          </span>
          <span
            className="transaction-cell text-white cursor-pointer select-none hover:text-white pl-2 text-left"
            onClick={() => state.toggleSort("category")}
          >
            {state.sortIndicator("category")} Category
          </span>
          <span className="transaction-cell text-white text-[0.65rem] uppercase tracking-wide">
            Payment
          </span>
          <span className="transaction-cell text-center">
            Status
          </span>
          <span
            className="transaction-cell text-neutral-400 cursor-pointer select-none hover:text-white text-[0.65rem] text-left"
            onClick={() => state.toggleSort("createdAt")}
          >
            {state.sortIndicator("createdAt")} Date
          </span>
          <span className="transaction-cell text-neutral-400 text-[0.6rem]">
            Updated
          </span>
          <span className="transaction-cell" />
        </div>

        <div className="transaction-row transaction-row--filters">
          <div className="transaction-cell text-center text-[0.55rem] text-neutral-600" />
          <div className="transaction-cell transaction-cell--merchant" />
          <div className="transaction-cell transaction-cell--amount" />
          <div className="transaction-cell transaction-cell--category">
            <select
              className="filter-select"
              value={state.categoryFilter}
              onChange={(e) => state.setCategoryFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="__uncategorized__">Uncategorized</option>
              {SUGGESTED_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
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
          <div className="transaction-cell transaction-cell--date">
            {state.dateUI === "idle" ? (
              !state.dateFrom && !state.dateTo ? (
                <span
                  className="filter-chip"
                  onClick={() => state.setDateUI("from")}
                >
                  + Date
                </span>
              ) : (
                <span
                  className="filter-chip filter-chip--active"
                  onClick={() => {
                    state.setDateFrom("");
                    state.setDateTo("");
                    state.setDateUI("idle");
                    state.setDateFilterKey((k) => k + 1);
                  }}
                >
                  {state.dateFrom ? `From: ${state.dateFrom}` : ""}
                  {state.dateFrom && state.dateTo ? " \u2192 " : ""}
                  {state.dateTo ? `To: ${state.dateTo}` : ""}
                </span>
              )
            ) : state.dateUI === "from" ? (
              <input
                type="date"
                className="filter-date"
                value={state.dateFrom}
                onChange={(e) => {
                  state.setDateFrom(e.target.value);
                  state.setDateUI("to");
                }}
                autoFocus
              />
            ) : (
              <input
                type="date"
                className="filter-date"
                value={state.dateTo}
                onChange={(e) => {
                  state.setDateTo(e.target.value);
                  state.setDateUI("idle");
                  state.setDateFilterKey((k) => k + 1);
                }}
                autoFocus
              />
            )}
          </div>
          <div className="transaction-cell transaction-cell--updated">
            {state.updatedUI === "idle" ? (
              !state.updatedAtFrom ? (
                <span
                  className="filter-chip"
                  onClick={() => state.setUpdatedUI("from")}
                >
                  + From
                </span>
              ) : (
                <span
                  className="filter-chip filter-chip--active"
                  onClick={() => {
                    state.setUpdatedAtFrom("");
                    state.setUpdatedUI("idle");
                  }}
                >
                  From: {state.updatedAtFrom}
                </span>
              )
            ) : (
              <input
                type="date"
                className="filter-date"
                value={state.updatedAtFrom}
                onChange={(e) => {
                  state.setUpdatedAtFrom(e.target.value);
                  state.setUpdatedUI("idle");
                }}
                autoFocus
              />
            )}
          </div>
          <div className="transaction-cell transaction-cell--action" />
        </div>

        {state.transactions.length === 0 ? (
          <p className="empty-text">No matching transactions</p>
        ) : (
          state.transactions.map((transaction, index) => (
            <div
              key={transaction.transactionId}
              className="transaction-row transaction-row--data"
              onClick={() => state.openDetailModal(transaction)}
            >
              <span className="transaction-cell text-center text-[0.6rem] text-neutral-500">
                {state.currentPage * state.pageSize + index + 1}
              </span>
              <span className="transaction-cell transaction-cell--merchant">
                {transaction.merchant}
              </span>
              <span className="transaction-cell transaction-cell--amount">
                <span className={transaction.type === "DEBIT" ? "text-red-400" : "text-green-400"}>
                  {transaction.type === "DEBIT" ? "\u2198" : "\u2197"}
                </span>
                {'\u20B9'}{transaction.amount.toFixed(2)}
              </span>
              <span className="transaction-cell transaction-cell--category">
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
                      await state.handleDelete(transaction.transactionId);
                      onDelete?.();
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
            disabled={state.currentPage === 0}
            onClick={() => state.fetchTransactions(state.currentPage - 1)}
          >
            {'\u2190'} Prev
          </button>
          <span className="page-info">
            Page {state.currentPage + 1} of {state.totalPages}
          </span>
          <button
            disabled={state.currentPage >= state.totalPages - 1}
            onClick={() => state.fetchTransactions(state.currentPage + 1)}
          >
            Next {'\u2192'}
          </button>
        </div>
      )}
    </div>
  );
}
