import { useCallback, useState } from "react";
import { useTransactions } from "../hooks/useTransactions";
import { useTransactionSubmit } from "../hooks/useTransactionSubmit";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { TransactionForm } from "./TransactionForm";
import { BudgetCard } from "./BudgetCard";
import { SpendAnalysisCard } from "./SpendAnalysisCard";
import { TrendsCard } from "./TrendsCard";
import { SuccessModal } from "./SuccessModal";
import { QuickReviewModal } from "./QuickReviewModal";
import { CategoryModal } from "./CategoryModal";
import { TransactionTable } from "./TransactionTable";
import { TransactionDetailModal } from "./TransactionDetailModal";

export function Dashboard() {
  const transactionSubmit = useTransactionSubmit();
  const transactionsManager = useTransactions();
  const [budgetKey, setBudgetKey] = useState(0);

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
          loading={transactionSubmit.loading}
          error={transactionSubmit.error}
          onMerchantChange={transactionSubmit.setMerchant}
          onAmountChange={transactionSubmit.setAmount}
          onPaymentModeChange={transactionSubmit.setPaymentMode}
          onTransactionTypeChange={transactionSubmit.setTransactionType}
          onDescriptionChange={transactionSubmit.setDescription}
          onSubmit={transactionSubmit.handleSubmit}
        />
        <BudgetCard refreshKey={budgetKey} onBudgetUpdated={() => setBudgetKey((previous) => previous + 1)} />
      </div>

      <SuccessModal
        visible={
          transactionSubmit.showSuccessModal &&
          !transactionSubmit.showCategoryModal &&
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
        createdTransaction={transactionSubmit.createdTransaction}
        createdDescription={transactionSubmit.description}
        reviewData={transactionSubmit.reviewData}
        onLooksGood={() => transactionSubmit.setShowQuickReviewModal(false)}
        onReview={() => {
          transactionSubmit.setShowQuickReviewModal(false);
          transactionSubmit.setShowCategoryModal(true);
        }}
      />

      <CategoryModal
        visible={transactionSubmit.showCategoryModal}
        selectedCategory={transactionSubmit.selectedCategory}
        saving={transactionSubmit.modalLoading}
        onSelect={transactionSubmit.setSelectedCategory}
        onSave={() => transactionSubmit.handleCategorySubmit(transactionsManager.fetchTransactions)}
        onClose={() => transactionSubmit.setShowCategoryModal(false)}
      />

      <TransactionTable state={transactionsManager} onDelete={() => setBudgetKey(k => k + 1)} />

      <div className="cards-row">
        <SpendAnalysisCard refreshKey={budgetKey} />
        <TrendsCard refreshKey={budgetKey} />
      </div>

      <TransactionDetailModal detail={transactionsManager} />
    </div>
  );
}
