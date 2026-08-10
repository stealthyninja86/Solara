import { useCallback, useState, useEffect } from "react";
import { useTransactions } from "../hooks/useTransactions";
import { useTransactionSubmit } from "../hooks/useTransactionSubmit";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { TransactionForm } from "../components/cards/TransactionForm";
import { BudgetCard } from "../components/cards/BudgetCard";
import { SpendAnalysisCard } from "../components/cards/SpendAnalysisCard";
import { TrendsCard } from "../components/cards/TrendsCard";
import { SuccessModal } from "../components/modals/SuccessModal";
import { QuickReviewModal } from "../components/modals/QuickReviewModal";
import { TransactionTable } from "../components/cards/TransactionTable";

export function Dashboard() {
  const transactionSubmit = useTransactionSubmit();
  const transactionsManager = useTransactions();
  const [budgetKey, setBudgetKey] = useState(0);
  const [highlightTransactionId, setHighlightTransactionId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("solara.highlight.transaction");
      if (raw) {
        const parsed = JSON.parse(raw);
        setHighlightTransactionId(parsed.transactionId);
        localStorage.removeItem("solara.highlight.transaction");
        const timer = setTimeout(() => setHighlightTransactionId(null), 3000);
        return () => clearTimeout(timer);
      }
    } catch { /* ignore */ }
  }, []);

  const handleRefresh = useCallback(() => {
    transactionsManager.fetchTransactions(0);
  }, [transactionsManager.fetchTransactions]);

  const { pullRef } = usePullToRefresh(handleRefresh, transactionsManager.setPullRefreshing);

  return (
    <div
      ref={pullRef}
      style={{ width: "100%" }}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12"
    >
      {transactionsManager.pullRefreshing && (
        <div className="flex justify-center py-3">
          <div className="spinner spinner--light" />
        </div>
      )}

      <div className="cards-row">
        <TransactionForm
          merchant={transactionSubmit.merchant}
          amount={transactionSubmit.amount}
          paymentMode={transactionSubmit.paymentMode}
          transactionType={transactionSubmit.transactionType}
          description={transactionSubmit.description}
          transactionDate={transactionSubmit.transactionDate}
          loading={transactionSubmit.loading}
          error={transactionSubmit.error}
          onMerchantChange={transactionSubmit.setMerchant}
          onAmountChange={transactionSubmit.setAmount}
          onPaymentModeChange={transactionSubmit.setPaymentMode}
          onTransactionTypeChange={transactionSubmit.setTransactionType}
          onDescriptionChange={transactionSubmit.setDescription}
          onTransactionDateChange={transactionSubmit.setTransactionDate}
          onSubmit={transactionSubmit.handleSubmit}
        />
        <BudgetCard refreshKey={budgetKey} onBudgetUpdated={() => setBudgetKey((previous) => previous + 1)} />
      </div>

      <SuccessModal
        visible={
          transactionSubmit.showSuccessModal &&
          !transactionSubmit.showQuickReviewModal
        }
        createdTransaction={transactionSubmit.createdTransaction}
        onDone={() => {
          transactionSubmit.dismissSuccessModal(transactionsManager.fetchTransactions);
          setBudgetKey((k) => k + 1);
        }}
      />

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

      <TransactionTable state={transactionsManager} onDelete={() => setBudgetKey(k => k + 1)} highlightTransactionId={highlightTransactionId} onRowClick={(tx) => transactionSubmit.openDetailModal(tx)} />

      <div className="cards-row">
        <SpendAnalysisCard refreshKey={budgetKey} />
        <TrendsCard refreshKey={budgetKey} />
      </div>
    </div>
  );
}
