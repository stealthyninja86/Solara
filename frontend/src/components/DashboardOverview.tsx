import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, getUserId } from "../hooks/useAuth";
import { useTransactions } from "../hooks/useTransactions";
import { useTransactionSubmit } from "../hooks/useTransactionSubmit";
import { useSpendAnalysis } from "../hooks/useSpendAnalysis";
import { useTrends } from "../hooks/useTrends";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { TransactionForm } from "./TransactionForm";
import { BulkImport } from "./BulkImport";
import { SuccessModal } from "./SuccessModal";
import { QuickReviewModal } from "./QuickReviewModal";
import { CategoryModal } from "./CategoryModal";
import { TransactionTable } from "./TransactionTable";
import { TransactionDetailModal } from "./TransactionDetailModal";
import { Modal } from "./Modal";
import { IncomeCard } from "./IncomeCard";
import { BudgetCard } from "./BudgetCard";
import { SpendingCard } from "./SpendingCard";
import { ExpenseNodes } from "./ExpenseNodes";
import { api } from "../utils/api";
import { DEFAULT_USER_ID } from "../constants";
import { Icon } from "./Icon";
import type { PageResponse } from "../types";

const SAMPLE_INSIGHTS = [
  { iconName: "recurring-payments", text: "Netflix renews tomorrow — ₹799" },
  { iconName: "spending-trend", text: "Food spending is 18% higher this month" },
  { iconName: "safe-to-spend", text: "You saved ₹5,200 this month" },
];

const ACTIVE_IMPORT_KEY = "solara.active-import.v1";
const IMPORT_TTL_MS = 15 * 60 * 1000;

interface ActiveImport {
  jobId: string;
  expectedCount: number;
  baselineCount: number;
  startedAt: number;
}

function loadActiveImport(): ActiveImport | null {
  try {
    const raw = localStorage.getItem(ACTIVE_IMPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveImport;
    if (
      !parsed.jobId ||
      !Number.isFinite(parsed.expectedCount) ||
      !Number.isFinite(parsed.baselineCount) ||
      !Number.isFinite(parsed.startedAt)
    ) {
      localStorage.removeItem(ACTIVE_IMPORT_KEY);
      return null;
    }
    if (Date.now() - parsed.startedAt > IMPORT_TTL_MS) {
      localStorage.removeItem(ACTIVE_IMPORT_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(ACTIVE_IMPORT_KEY);
    return null;
  }
}

function saveActiveImport(activeImport: ActiveImport) {
  try {
    localStorage.setItem(ACTIVE_IMPORT_KEY, JSON.stringify(activeImport));
  } catch {
    // storage unavailable — degrade to current behavior
  }
}

function clearActiveImport() {
  try {
    localStorage.removeItem(ACTIVE_IMPORT_KEY);
  } catch {
    // ignore
  }
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function DashboardOverview() {
  const auth = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [budgetKey, setBudgetKey] = useState(0);
  const transactionSubmit = useTransactionSubmit();
  const transactionsManager = useTransactions();
  const spendAnalysis = useSpendAnalysis(budgetKey, selectedMonth, selectedYear);
  const trends = useTrends(budgetKey, selectedMonth, selectedYear);
  const [showManualModal, setShowManualModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importStartedAt, setImportStartedAt] = useState<number | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    const activeImport = loadActiveImport();
    if (activeImport) resumeActiveImport(activeImport);
    // run once on mount; getUserId() is a module-level read, safe before auth settles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const from = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const to = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    transactionsManager.setDateFrom(from);
    transactionsManager.setDateTo(to);
    transactionsManager.setDateFilterKey((k) => k + 1);
  }, [selectedMonth, selectedYear]);

  async function readModelCount(): Promise<number | null> {
    try {
      const params = new URLSearchParams();
      params.set("userId", getUserId() ?? DEFAULT_USER_ID);
      params.set("page", "0");
      params.set("size", "1");
      const res = await api(`/api/v1/category/transaction?${params}`);
      if (!res.ok) return null;
      const data: PageResponse = await res.json();
      return data.totalElements;
    } catch {
      return null;
    }
  }

  function startReadModelPolling(expectedCount: number, baselineCount: number, jobId: string, startedAt: number) {
    setImportStatus("Processing transactions\u2026");
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      if (Date.now() - startedAt > IMPORT_TTL_MS) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        clearActiveImport();
        setImporting(false);
        setImportStatus("Import is taking longer than expected. Please try again.");
        setTimeout(() => setImportStatus(""), 4000);
        return;
      }
      try {
        const jobRes = await api(`/api/v1/transactions/bulk/${jobId}`);
        if (jobRes.ok) {
          const job = await jobRes.json();
          if (job.status === "FAILED") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            clearActiveImport();
            setImporting(false);
            setImportStatus("Import failed. Please try again.");
            setTimeout(() => setImportStatus(""), 3000);
            return;
          }
        }
        const total = await readModelCount();
        if (total === null) return;
        const categorized = Math.min(total - baselineCount, expectedCount);
        setImportStatus(`Processing\u2026 ${categorized}/${expectedCount} rows categorized`);
        if (total - baselineCount >= expectedCount) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          clearActiveImport();
          setImporting(false);
          setImportStatus("");
          setImportedCount(expectedCount);
          setShowReviewModal(true);
          transactionsManager.fetchTransactions(0);
        }
      } catch {
        // retry on next tick
      }
    }, 2000);
  }

  async function resumeActiveImport(activeImport: ActiveImport) {
    const { jobId, baselineCount, startedAt } = activeImport;
    setImportStartedAt(startedAt);
    setImporting(true);
    setImportStatus("Resuming import\u2026");
    try {
      const jobRes = await api(`/api/v1/transactions/bulk/${jobId}`);
      if (!jobRes.ok) {
        clearActiveImport();
        setImporting(false);
        setImportStatus("");
        return;
      }
      const job = await jobRes.json();
      if (job.status === "FAILED") {
        clearActiveImport();
        setImporting(false);
        setImportStatus("Import failed. Please try again.");
        setTimeout(() => setImportStatus(""), 3000);
        return;
      }
      if (job.status !== "COMPLETED") {
        clearActiveImport();
        setImporting(false);
        setImportStatus("");
        return;
      }
      const authoritativeExpected = job.importedRows;
      const total = await readModelCount();
      if (total === null) {
        setImporting(false);
        setImportStatus("");
        return;
      }
      if (total - baselineCount >= authoritativeExpected) {
        clearActiveImport();
        setImporting(false);
        setImportedCount(authoritativeExpected);
        setShowReviewModal(true);
        transactionsManager.fetchTransactions(0);
      } else {
        startReadModelPolling(authoritativeExpected, baselineCount, jobId, startedAt);
      }
    } catch {
      setImporting(false);
      setImportStatus("");
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportStatus("Uploading\u2026");

    const measuredBaseline = await readModelCount();
    const baselineCount = measuredBaseline ?? 0;

    const formData = new FormData();
    formData.append("userId", getUserId() ?? DEFAULT_USER_ID);
    formData.append("file", file);

    try {
      const response = await api("/api/v1/transactions/bulk/upload", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setImportStatus("Processing transactions\u2026");
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        try {
          const pollRes = await api(`/api/v1/transactions/bulk/${data.jobId}`);
          if (pollRes.ok) {
            const status = await pollRes.json();
            if (status.status === "COMPLETED") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              const expectedCount = status.importedRows;
              if (expectedCount <= 0) {
                setImporting(false);
                setImportStatus("No rows were imported from the file.");
                setTimeout(() => setImportStatus(""), 3000);
                return;
              }
              const startedAt = Date.now();
              setImportStartedAt(startedAt);
              saveActiveImport({ jobId: data.jobId, expectedCount, baselineCount, startedAt });
              startReadModelPolling(expectedCount, baselineCount, data.jobId, startedAt);
            } else if (status.status === "FAILED") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setImporting(false);
              setImportStatus("Import failed. Please try again.");
              setTimeout(() => setImportStatus(""), 3000);
            }
          }
        } catch {
          // retry on next interval
        }
      }, 1500);
    } catch {
      setImporting(false);
      setImportStatus("Upload failed. Please try again.");
      setTimeout(() => setImportStatus(""), 3000);
    }
  }

  const handleRefresh = useCallback(() => {
    transactionsManager.fetchTransactions(0);
  }, [transactionsManager.fetchTransactions]);

  const { pullRef } = usePullToRefresh(handleRefresh, transactionsManager.setPullRefreshing);

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const emailPrefix = (auth.email?.split("@")[0] ?? "there");
  const displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

  function shiftMonth(delta: number) {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    if (newYear > now.getFullYear() || (newYear === now.getFullYear() && newMonth > now.getMonth())) return;
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  }

  const canGoForward = selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth < now.getMonth());

  return (
    <div ref={pullRef} style={{ width: "100%" }} className="flex flex-col gap-8">
      {transactionsManager.pullRefreshing && (
        <div className="flex justify-center py-3">
          <div className="spinner spinner--light" />
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-2 self-center" style={{ maxWidth: "1000px", width: "100%" }}>
        <button
          onClick={() => shiftMonth(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text)]"
          title="Previous month"
        >
          {'\u2190'}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowMonthPicker((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-1.5 text-[0.75rem] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text)]"
          >
            {MONTHS[selectedMonth]} {selectedYear} <span className="text-[0.6rem]">{'\u25BE'}</span>
          </button>
          {showMonthPicker && (
            <div className="absolute left-1/2 top-full z-50 mt-1 w-40 -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg">
              {MONTHS.map((month, index) => (
                <button
                  key={month}
                  onClick={() => {
                    setSelectedMonth(index);
                    setShowMonthPicker(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[0.72rem] transition-colors hover:bg-[var(--color-bg-hover)] ${
                    index === selectedMonth ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {month}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => shiftMonth(1)}
          disabled={!canGoForward}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-deep)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-30"
          title="Next month"
        >
          {'\u2192'}
        </button>
      </div>

        <section className="card self-center max-w-[1000px] w-full !p-10" style={{ "--section-delay": "0ms" } as React.CSSProperties}>
        <div className="flex flex-col items-center py-6 text-center">
          <h2 className="text-4xl font-bold text-[var(--color-text)]">
            <Icon name="logo" size={28} /> {timeGreeting}, {displayName} <Icon name="greeting" size={28} />
          </h2>
          <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-[var(--color-text)]">
            Solara helps you understand where your money goes — no spreadsheets, no hassle.
          </p>

          {/* Getting started tutorial */}
          <div className="mt-6 w-full max-w-sm text-left">
            <p className="text-[0.85rem] uppercase tracking-[0.1em] font-semibold text-[var(--color-text)]">
              Getting started in 3 steps
            </p>
            <ol className="mt-3 space-y-2.5 text-[0.9rem] text-[var(--color-text)]">
              <li className="flex gap-2">
                <span className="shrink-0"><Icon name="add" size={16} /></span>
                <span>Add a few transactions manually to try things out</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0"><Icon name="import" size={16} /></span>
                <span>Import your bank CSV when you're ready — your data stays private</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0"><Icon name="budget" size={16} /></span>
                <span>Set your monthly income and budget to unlock insights</span>
              </li>
            </ol>
          </div>

          <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-3">
            <button
              onClick={() => setShowManualModal(true)}
              className="mt-0! w-auto! cursor-pointer rounded-md border border-[var(--color-border-emphasis)]! bg-transparent! px-4! py-2.5! text-[0.8rem]! text-[var(--color-text-light)]! transition-colors hover:bg-[var(--color-bg-hover)]! hover:text-[var(--color-text)]!"
            >
              <Icon name="add" size={14} /> Add Transaction
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="mt-0! w-auto! cursor-pointer rounded-md border border-[var(--color-border-emphasis)]! bg-transparent! px-4! py-2.5! text-[0.8rem]! text-[var(--color-text-light)]! transition-colors hover:bg-[var(--color-bg-hover)]! hover:text-[var(--color-text)]! disabled:opacity-50 disabled:cursor-not-allowed!"
            >
              {importing ? importStatus || "Importing\u2026" : <><Icon name="import" size={14} /> Import CSV</>}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
          {importing && (
            <div className="mt-3 flex items-center gap-2 text-[0.75rem] text-[var(--color-text)]">
              <span className="spinner !w-3 !h-3" />
              <span>{importStatus}</span>
            </div>
          )}
          {importStatus && !importing && !showReviewModal && (
            <p className="mt-3 text-[0.75rem] text-[var(--color-text)]">{importStatus}</p>
          )}

          <p className="mt-5 text-[0.85rem] uppercase tracking-[0.12em] font-semibold text-[var(--color-text)]">
            What Solara does for you
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[0.9rem] text-[var(--color-text)]">
            <li className="flex items-center gap-1.5"><Icon name="category-breakdown" size={14} /> Categorize transactions</li>
            <li className="flex items-center gap-1.5"><Icon name="recurring-payments" size={14} /> Detect subscriptions</li>
            <li className="flex items-center gap-1.5"><Icon name="safe-to-spend" size={14} /> Calculate safe-to-spend</li>
            <li className="flex items-center gap-1.5"><Icon name="ai-insights" size={14} /> Generate AI insights</li>
            <li className="flex items-center gap-1.5"><Icon name="reports" size={14} /> Build monthly reports</li>
          </ul>
        </div>

        {/* Tips */}
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <p className="text-[0.85rem] leading-relaxed text-[var(--color-text)]">
            <Icon name="tip" size={14} /> <strong>Tip:</strong> Set your monthly income and budget in the cards below to unlock the safe-to-spend calculator.
          </p>
        </div>
      </section>

      <section className="card self-center max-w-[1000px] w-full !px-10 !py-10 text-center" style={{ "--section-delay": "80ms" } as React.CSSProperties}>
        <p className="text-[0.75rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          <Icon name="safe-to-spend" size={14} /> Safe To Spend
        </p>
        <p className="mt-3 text-5xl font-bold text-[var(--color-text)]">
          ₹{spendAnalysis.safeToSpend.toLocaleString("en-IN")}
        </p>
        <p className="mt-3 text-[0.85rem] text-[var(--color-text-muted)]">
          After bills + upcoming expenses
        </p>
        <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-[0.85rem] leading-relaxed text-[var(--color-text)]">
          <Icon name="tip" size={14} /> This is your budget-aware spending limit. Set a monthly budget above to get a personalized number.
        </p>
      </section>

      <section className="card !p-10" style={{ "--section-delay": "160ms" } as React.CSSProperties}>
        <h2 className="text-[1rem] font-medium text-[var(--color-text)]"><Icon name="ai-insights" size={16} /> Solara Insights</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {SAMPLE_INSIGHTS.map((insight) => (
            <li key={insight.text} className="flex items-center gap-3 text-[0.85rem] text-[var(--color-text-light)]">
              <span className="text-[0.8rem] leading-none"><Icon name={insight.iconName} size={14} /></span>
              {insight.text}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[0.7rem] text-[var(--color-text-tertiary)]">
          Sample data — backend endpoint pending
        </p>
        <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-[0.85rem] leading-relaxed text-[var(--color-text)]">
          <Icon name="tip" size={14} /> As you add more transactions, Solara will surface real patterns — spending spikes, subscription renewals, and savings opportunities.
        </p>
      </section>

      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3" style={{ width: "100%", maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ "--card-delay": "240ms" } as React.CSSProperties}><IncomeCard refreshKey={budgetKey} totalSpend={trends.totalSpend} /></div>
        <div style={{ "--card-delay": "320ms" } as React.CSSProperties}><BudgetCard refreshKey={budgetKey} onBudgetUpdated={() => setBudgetKey((previous) => previous + 1)} month={selectedMonth} year={selectedYear} /></div>
        <div style={{ "--card-delay": "400ms" } as React.CSSProperties}><SpendingCard categories={trends.categories} totalSpend={trends.totalSpend} /></div>
      </div>

      <div className="self-center max-w-[1000px] w-full" style={{ "--card-delay": "480ms" } as React.CSSProperties}>
        <ExpenseNodes categories={trends.categories} totalSpend={trends.totalSpend} />
      </div>

      {transactionsManager.transactions.length > 0 && (
      <section className="card self-center max-w-[1000px] w-full !p-10" style={{ "--section-delay": "320ms" } as React.CSSProperties}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[1rem] font-medium text-[var(--color-text)]"><Icon name="transactions" size={16} /> Transactions</h2>
            <span className="flex items-center gap-2 text-[0.8rem] text-[var(--color-text-muted)]">
              Search <span className="text-[0.85rem]">🔍</span>
            </span>
          </div>
          <TransactionTable state={transactionsManager} onDelete={() => setBudgetKey((previous) => previous + 1)} />
        </section>
      )}

      <SuccessModal
        visible={
          transactionSubmit.showSuccessModal &&
          !transactionSubmit.showCategoryModal &&
          !transactionSubmit.showQuickReviewModal
        }
        createdTransaction={transactionSubmit.createdTransaction}
        onDone={() => {
          transactionSubmit.dismissSuccessModal(transactionsManager.fetchTransactions);
            setBudgetKey((previous) => previous + 1);
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

      <TransactionDetailModal detail={transactionsManager} />

      <BulkImport visible={showReviewModal} onClose={() => { setShowReviewModal(false); window.location.reload(); }} importedCount={importedCount} importStartedAt={importStartedAt} onDelete={() => {
        setBudgetKey((previous) => previous + 1);
        transactionsManager.fetchTransactions(transactionsManager.currentPage);
      }} />

      {showManualModal && (
        <Modal visible={showManualModal} onClose={() => setShowManualModal(false)} titleId="manual-entry-title" className="modal relative">
          <button
            onClick={() => setShowManualModal(false)}
            className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border-emphasis)] hover:text-[var(--color-text)]"
            title="Close"
          >
            ✕
          </button>
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
            onSubmit={async (e) => {
              await transactionSubmit.handleSubmit(e);
              setShowManualModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
