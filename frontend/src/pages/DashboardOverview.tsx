import { useCallback, useEffect, useRef, useState } from "react";
import { useTransactions } from "../hooks/useTransactions";
import { useTransactionSubmit } from "../hooks/useTransactionSubmit";
import { useDashboard } from "../hooks/useDashboard";
// import { usePullToRefresh } from "../hooks/usePullToRefresh"; // temporarily disabled
import { useBulkImport } from "../hooks/useBulkImport";
import { getUserId } from "../hooks/useAuth";
import { api } from "../utils/api";
import { DEFAULT_USER_ID } from "../constants";
import { TransactionForm } from "../components/cards/TransactionForm";
import { SuccessModal } from "../components/modals/SuccessModal";
import { QuickReviewModal } from "../components/modals/QuickReviewModal";
import { TransactionTable } from "../components/cards/TransactionTable";
import { DropdownSelect } from "../components/ui/DropdownSelect";
import { Modal } from "../components/ui/Modal";
import { IncomeCard } from "../components/cards/IncomeCard";
import { BudgetCard } from "../components/cards/BudgetCard";
import { SpendingCard } from "../components/cards/SpendingCard";
import { ExpenseNodes } from "../components/charts/ExpenseNodes";
import { SubscriptionCard } from "../components/cards/SubscriptionCard";
import { AddSubscriptionModal } from "../components/modals/AddSubscriptionModal";
import { ManageSubscriptionModal } from "../components/modals/ManageSubscriptionModal";
import { SubscriptionCostPreviewModal } from "../components/modals/SubscriptionCostPreviewModal";
import { ImportTipsModal } from "../components/modals/ImportTipsModal";
import { HowItWorks, type HowItWorksItem } from "../components/ui/HowItWorks";
import { OnboardingChecklist } from "../components/cards/OnboardingChecklist";
import {
  clearActiveOverview,
  clearBannerData,
  consumeScrollToTransactions,
  HIGHLIGHT_TRANSACTION_KEY,
  loadActiveOverview,
  loadBannerData,
  loadSelectedMonth,
  persistSelectedMonth,
  saveActiveOverview,
  saveHighlightTransactionId,
  saveScrollToTransactions,
} from "../utils/storage";
import { Icon } from "../components/ui/Icon";
import { FinanceOverview } from "../components/cards/FinanceOverview";
import type { TrackedSubscription } from "../types/reports";

const SAFE_TO_SPEND_HOW_IT_WORKS: HowItWorksItem[] = [
  {
    title: "What it means",
    description: "How much you can still spend this month without going over budget, after reserving upcoming subscription charges.",
  },
  {
    title: "How it's calculated",
    description: "Monthly budget minus what you've spent so far minus the cost of subscriptions due this month.",
  },
  {
    title: "When it goes negative",
    description: "You've exceeded your budget — consider reducing spending or adjusting your budget.",
  },
];

const KIND_LABEL: Record<string, string> = {
  SUBSCRIPTION: "Subscriptions",
  BILL: "Bills",
  RENT: "Rent",
  EMI: "EMIs",
};

const KIND_ORDER = ["EMI", "RENT", "BILL", "SUBSCRIPTION"];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function DashboardOverview() {
  const transactionSubmit = useTransactionSubmit();
  const transactionsManager = useTransactions();
  const [selected] = useState(loadSelectedMonth);
  const [bannerData, setBannerData] = useState(loadBannerData);
  const [highlightTransactionId, setHighlightTransactionId] = useState<string | null>(null);
  const [scrollToTransactions, setScrollToTransactions] = useState(false);

  useEffect(() => {
    if (consumeScrollToTransactions()) setScrollToTransactions(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIGHLIGHT_TRANSACTION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setHighlightTransactionId(parsed.transactionId);
        localStorage.removeItem("solara.highlight.transaction");
        const timer = setTimeout(() => setHighlightTransactionId(null), 3000);
        return () => clearTimeout(timer);
      }
    } catch { /* ignore */ }
  }, []);

  const dashboard = useDashboard(selected.month - 1, selected.year, false);
  const {
    periods,
    spendAnalysis,
    income,
    trends,
    overviewCards,
    subscriptions,
    totalSubscriptions,
    load: reloadDashboard,
    loading: dashboardLoading,
    regenerating: dashboardRegenerating,
  } = dashboard;
  const [showManualModal, setShowManualModal] = useState(false);
  const [manageSubscription, setManageSubscription] = useState<TrackedSubscription | null>(null);
  const [showAddSubscriptionModal, setShowAddSubscriptionModal] = useState(false);
  const [showCostPreviewModal, setShowCostPreviewModal] = useState(false);
  const [showImportTipsModal, setShowImportTipsModal] = useState(false);

  useEffect(() => {
    if (!scrollToTransactions) return;
    if (!dashboardLoading && !transactionsManager.listLoading) {
      document.getElementById("transactions-card")?.scrollIntoView({ behavior: "smooth" });
      setScrollToTransactions(false);
    }
  }, [scrollToTransactions, dashboardLoading, transactionsManager.listLoading]);

  const bulkImport = useBulkImport();

  const [generatingOverview, setGeneratingOverview] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const regeneratePollRef = useRef<number | null>(null);
  const regenerateAttemptsRef = useRef(0);
  const regenerateWasEmptyRef = useRef(false);

  useEffect(() => {
    const fromMonth = String(selected.month).padStart(2, "0");
    const fromYear = selected.year;
    const lastDay = new Date(fromYear, selected.month, 0).getDate();
    transactionsManager.setDateFrom(`${fromYear}-${fromMonth}-01`);
    transactionsManager.setDateTo(`${fromYear}-${fromMonth}-${String(lastDay).padStart(2, "0")}`);
    transactionsManager.setDateFilterKey((k) => k + 1);
  }, [selected]);

  function persist(next: { year: number; month: number }) {
    persistSelectedMonth(next);
  }

  const currentIndex = periods.findIndex(
    (p) => p.year === selected.year && p.month === selected.month,
  );

  function shift(delta: number) {
    const next = periods[currentIndex + delta];
    if (next) persist(next);
  }

  // Pull-to-refresh temporarily disabled (see usePullToRefresh).
  // const handleRefresh = useCallback(() => {
  //   window.location.reload();
  // }, []);

  const handleGenerateOverview = useCallback((refresh = false) => {
    if (regeneratePollRef.current !== null) {
      window.clearInterval(regeneratePollRef.current);
      regeneratePollRef.current = null;
    }
    regenerateAttemptsRef.current = 0;
    regenerateWasEmptyRef.current = false;
    setGeneratingOverview(true);
    setGenerateError("");
    const userId = getUserId() ?? DEFAULT_USER_ID;
    const now = new Date();
    const at = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    saveActiveOverview({ at, startedAt: Date.now() });
    const force = refresh ? "&refresh=true" : "";
    api(`/api/v1/insights/overview?userId=${userId}&period=MONTHLY&at=${at}${force}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 429) {
            setGenerateError("Regeneration limit reached — try again tomorrow.");
          } else {
            throw new Error("Generation failed");
          }
          clearActiveOverview();
          setGeneratingOverview(false);
          return;
        }
        // Trigger first dashboard reload, then poll until cards appear (async generation)
        await reloadDashboard();
        regeneratePollRef.current = window.setInterval(async () => {
          regenerateAttemptsRef.current += 1;
          if (regenerateAttemptsRef.current > 30) {
            if (regeneratePollRef.current !== null) {
              window.clearInterval(regeneratePollRef.current);
              regeneratePollRef.current = null;
            }
            regenerateWasEmptyRef.current = false;
            clearActiveOverview();
            setGeneratingOverview(false);
            return;
          }
          await reloadDashboard();
        }, 3000);
      })
      .catch(() => {
        setGenerateError("Generation failed. Please try again.");
        if (regeneratePollRef.current !== null) {
          window.clearInterval(regeneratePollRef.current);
          regeneratePollRef.current = null;
        }
        regenerateWasEmptyRef.current = false;
        clearActiveOverview();
        setGeneratingOverview(false);
      });
  }, [reloadDashboard]);

  useEffect(() => {
    if (generatingOverview && overviewCards.length === 0) {
      regenerateWasEmptyRef.current = true;
    }
    if (generatingOverview && regenerateWasEmptyRef.current && overviewCards.length > 0) {
      if (regeneratePollRef.current !== null) {
        window.clearInterval(regeneratePollRef.current);
        regeneratePollRef.current = null;
      }
      regenerateAttemptsRef.current = 0;
      regenerateWasEmptyRef.current = false;
      clearActiveOverview();
      setGeneratingOverview(false);
    }
  }, [overviewCards, generatingOverview]);

  useEffect(() => {
    const active = loadActiveOverview();
    if (active) {
      setGeneratingOverview(true);
      regenerateAttemptsRef.current = Math.floor((Date.now() - active.startedAt) / 3000);
      regeneratePollRef.current = window.setInterval(async () => {
        regenerateAttemptsRef.current += 1;
        if (regenerateAttemptsRef.current > 30) {
          if (regeneratePollRef.current !== null) {
            window.clearInterval(regeneratePollRef.current);
            regeneratePollRef.current = null;
          }
          regenerateWasEmptyRef.current = false;
          clearActiveOverview();
          setGeneratingOverview(false);
          return;
        }
        await reloadDashboard();
      }, 3000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (regeneratePollRef.current !== null) {
        window.clearInterval(regeneratePollRef.current);
      }
    };
  }, []);

  // Pull-to-refresh temporarily disabled (see usePullToRefresh).
  // const { pullRef } = usePullToRefresh(handleRefresh, transactionsManager.setPullRefreshing);

  return (
    <div style={{ width: "100%" }} className="flex flex-col gap-8">

      {/* Success Banner */}
      {bannerData && (
        <div className="self-center max-w-[1000px] w-full rounded-md border border-[var(--color-ok)] bg-[var(--color-ok)]/5 px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-[0.85rem] text-[var(--color-text)]">
            <Icon name="success" size={14} />{" "}
            {bannerData.type === "import"
              ? `Imported ${bannerData.count} transactions for ${MONTHS[bannerData.month - 1]} ${bannerData.year}`
              : <>Transaction created on {bannerData.createdAt ? new Date(bannerData.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : `${MONTHS[bannerData.month - 1]} ${bannerData.year}`} — {bannerData.merchant} ₹{(bannerData.amount ?? 0).toFixed(2)}</>}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (bannerData.transactionId) saveHighlightTransactionId(bannerData.transactionId);
                saveScrollToTransactions();
                persist({ year: bannerData.year, month: bannerData.month });
                clearBannerData();
                setBannerData(null);
              }}
              className="button !w-auto !px-3 !py-1.5 !text-caption"
            >
              View
            </button>
            <button
              onClick={() => { clearBannerData(); setBannerData(null); }}
              className="button !w-auto !px-3 !py-1.5 !text-caption text-[var(--color-text-muted)]!"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Date Filter + Actions */}
      <div className="flex flex-col items-start gap-1.5 self-center" style={{ maxWidth: "1000px", width: "100%" }}>
        <div className="flex w-full items-center justify-between">
          <h1 className="text-page text-[var(--color-text)] whitespace-nowrap"><Icon name="overview" size={18} /> Overview</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowManualModal(true)}
              className="button flex items-center gap-1.5 !px-3 !py-1.5 !text-[0.75rem] text-[var(--color-text-secondary)]!"
            >
              <Icon name="add" size={12} /> Add
            </button>
            <button
              onClick={() => setShowImportTipsModal(true)}
              disabled={bulkImport.importing}
              className="button flex items-center gap-1.5 !px-3 !py-1.5 !text-[0.75rem] text-[var(--color-text-secondary)]!"
            >
              {bulkImport.importing ? <><span className="spinner !w-2.5 !h-2.5" /> {bulkImport.importStatus || "Importing\u2026"}</> : <><Icon name="import" size={12} /> Import</>}
            </button>
            <input
              ref={bulkImport.fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={bulkImport.handleFileChange}
            />
          </div>
        </div>
        {periods.length > 0 && (
        <div className="mx-auto flex items-center gap-1.5">
          <button
            onClick={() => shift(-1)}
            disabled={currentIndex <= 0}
            className="button flex !h-6 !w-6 !items-center !justify-center !rounded !p-0"
          >
            {'\u2190'}
          </button>
          <DropdownSelect
            value={selected.month}
            options={periods
              .filter((p) => p.year === selected.year)
              .map((p) => ({ value: p.month, label: MONTHS[p.month - 1] ?? "" }))}
            onChange={(v) => persist({ ...selected, month: Number(v) })}
          />
          <DropdownSelect
            value={selected.year}
            options={[...new Set(periods.map((p) => p.year))].map((y) => ({ value: y, label: String(y) }))}
            onChange={(v) => persist({ ...selected, year: Number(v) })}
          />
          <button
            onClick={() => shift(1)}
            disabled={currentIndex >= periods.length - 1}
            className="button flex !h-6 !w-6 !items-center !justify-center !rounded !p-0"
          >
            {'\u2192'}
          </button>
        </div>
        )}
      </div>

      {/* ── NEW: Onboarding checklist (replace with old card below to revert) ── */}
      <OnboardingChecklist
        hasIncome={income.hasIncome}
        hasTransactions={transactionsManager.totalElements > 0}
        hasBudget={spendAnalysis.monthlyBudget > 0}
      />

      {/* ── OLD: Welcome card (uncomment to restore) ── */}
      {/*
      <section className="card self-center max-w-[1000px] w-full !p-10" style={{ "--section-delay": "0ms" } as React.CSSProperties}>
        <div className="flex flex-col items-center py-6 text-center">
          <h2 className="text-4xl font-bold text-[var(--color-text)]">
            <Icon name="logo" size={28} /> {timeGreeting}, {capitalizedName} <Icon name="greeting" size={28} />
          </h2>
          <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-[var(--color-text)]">
            Solara helps you understand where your money goes — no spreadsheets, no hassle.
          </p>
          <div className="mt-6 w-full max-w-sm text-left">
            <p className="text-section text-[var(--color-text)]">
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
              className="mt-0! w-auto! cursor-pointer rounded-md border border-[var(--color-border-emphasis)]! bg-transparent! px-4! py-2.5! text-caption! text-[var(--color-text)]! transition-colors hover:bg-[var(--color-bg-hover)]! hover:text-[var(--color-text)]!"
            >
              <Icon name="add" size={14} /> Add Transaction
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="mt-0! w-auto! cursor-pointer rounded-md border border-[var(--color-border-emphasis)]! bg-transparent! px-4! py-2.5! text-caption! text-[var(--color-text)]! transition-colors hover:bg-[var(--color-bg-hover)]! hover:text-[var(--color-text)]! disabled:opacity-50 disabled:cursor-not-allowed!"
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
            <div className="mt-3 flex items-center gap-2 text-small">
              <span className="spinner !w-3 !h-3" />
              <span>{importStatus}</span>
            </div>
          )}
          {importStatus && !importing && !showReviewModal && (
            <p className="mt-3 text-small">{importStatus}</p>
          )}
          <p className="mt-5 text-section">
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
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <p className="text-[0.85rem] leading-relaxed text-[var(--color-text)]">
            <Icon name="tip" size={14} /> <strong>Tip:</strong> Set your monthly income and budget in the cards below to unlock the safe-to-spend calculator.
          </p>
        </div>
      </section>
      */}

      <section id="safe-to-spend-card" className="card self-center max-w-[1000px] w-full text-center" style={{ "--section-delay": "80ms" } as React.CSSProperties}>
        {(() => {
          const hasBudget = spendAnalysis.monthlyBudget > 0;
          const overBudget = spendAnalysis.safeToSpend < 0;
          const spentPct = hasBudget ? Math.min((spendAnalysis.totalSpent / spendAnalysis.monthlyBudget) * 100, 100) : 0;
          const subPct = hasBudget ? Math.min((spendAnalysis.recurringCosts / spendAnalysis.monthlyBudget) * 100, 100 - spentPct) : 0;
          const safePct = hasBudget && !overBudget ? Math.max(0, 100 - spentPct - subPct) : 0;
          const kindEntries = Object.entries(spendAnalysis.recurringCostsByKind)
            .filter(([, v]) => v > 0)
            .sort((a, b) => KIND_ORDER.indexOf(a[0]) - KIND_ORDER.indexOf(b[0]));
          const singleKind = kindEntries.length === 1 ? kindEntries[0] : undefined;
          const recurringLabel = singleKind
            ? (KIND_LABEL[singleKind[0]] ?? singleKind[0].toLowerCase())
            : kindEntries.length > 1 ? "recurring" : "";

          return (
            <>
              <p className="text-label text-[var(--color-text-muted)]">
                <Icon name="safe-to-spend" size={14} /> Safe To Spend
              </p>
              <p className="mt-3 text-5xl font-bold text-[var(--color-text)]">
                ₹{spendAnalysis.safeToSpend.toLocaleString("en-IN")}
              </p>

              {overBudget && (
                <p className="mt-3 text-caption-muted">
                  You've gone <span className="text-[var(--color-warn)]">₹{Math.abs(spendAnalysis.safeToSpend).toLocaleString("en-IN")}</span> above your budget
                </p>
              )}

              {hasBudget && (
                <div className="mx-auto mt-5 max-w-[500px]">
                  <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-bg-hover)]">
                    <div
                      key={`spent-${spendAnalysis.totalSpent}`}
                      className="animate-fill bg-[var(--color-bad)]"
                      style={{ width: `${spentPct}%` }}
                    />
                    {spendAnalysis.recurringCosts > 0 && (
                      <div
                        key={`sub-${spendAnalysis.recurringCosts}`}
                        className="animate-fill bg-[var(--color-warn)]"
                        style={{ width: `${subPct}%` }}
                      />
                    )}
                    {safePct > 0 && (
                      <div
                        key={`safe-${spendAnalysis.safeToSpend}`}
                        className="animate-fill bg-[var(--color-ok)]"
                        style={{ width: `${safePct}%` }}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex justify-between text-[0.7rem] text-[var(--color-text-muted)]">
                    <span>spent</span>
                    {spendAnalysis.recurringCosts > 0 && <span>{recurringLabel}</span>}
                    {safePct > 0 && <span>safe</span>}
                  </div>
                </div>
              )}

              <div className="mx-auto mt-5 max-w-[360px] text-left">
                {hasBudget && (
                  <div className="flex items-center justify-between py-1.5 text-[0.85rem]">
                    <span className="text-[var(--color-text-muted)]">Monthly budget</span>
                    <span className="font-medium text-[var(--color-ok)]">₹{spendAnalysis.monthlyBudget.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {!hasBudget && (
                  <p className="py-1.5 text-[0.85rem] text-[var(--color-text-muted)]">No budget set — set one in the cards below.</p>
                )}
                <div className="flex items-center justify-between py-1.5 text-[0.85rem]">
                  <span className="text-[var(--color-text-muted)]">Spent so far</span>
                  <span className="font-medium text-[var(--color-bad)]">−₹{spendAnalysis.totalSpent.toLocaleString("en-IN")}</span>
                </div>
                {singleKind && (
                  <div className="flex items-center justify-between py-1.5 text-[0.85rem]">
                    <span className="text-[var(--color-text-muted)]">{KIND_LABEL[singleKind[0]] ?? singleKind[0]}</span>
                    <span className="font-medium text-[var(--color-warn)]">−₹{singleKind[1].toLocaleString("en-IN")}</span>
                  </div>
                )}
                {kindEntries.length > 1 && kindEntries.map(([kind, amount]) => (
                  <div key={kind} className="flex items-center justify-between py-1.5 text-[0.85rem]">
                    <span className="text-[var(--color-text-muted)]">{KIND_LABEL[kind] ?? kind}</span>
                    <span className="font-medium text-[var(--color-warn)]">−₹{amount.toLocaleString("en-IN")}</span>
                  </div>
                ))}
                <div className="my-2 border-t border-[var(--color-border)]" />
                <div className="flex items-center justify-between py-1.5 text-[0.85rem]">
                  <span className="font-medium text-[var(--color-text)]">Available now</span>
                  <span className="font-bold text-[var(--color-text)]">₹{spendAnalysis.safeToSpend.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-left">
                {hasBudget ? (
                  <p className="text-[0.85rem] leading-relaxed text-[var(--color-text-muted)]">
                    <Icon name="tip" size={14} /> Based on your ₹{spendAnalysis.monthlyBudget.toLocaleString("en-IN")} monthly budget.
                  </p>
                ) : (
                  <p className="text-[0.85rem] leading-relaxed text-[var(--color-text-muted)]">
                    <Icon name="tip" size={14} /> Set a monthly budget above to see your safe-to-spend.
                  </p>
                )}
              </div>
            </>
          );
        })()}
        <div className="text-left">
          <HowItWorks items={SAFE_TO_SPEND_HOW_IT_WORKS} />
        </div>
      </section>

      <div id="finance-overview-card" className="self-center max-w-[1000px] w-full">
      <FinanceOverview
        month={selected.month - 1}
        year={selected.year}
        cards={overviewCards}
        loading={dashboardLoading}
        transactionCount={transactionsManager.transactions.length}
        generating={generatingOverview || dashboardRegenerating}
        regenerating={dashboardRegenerating}
        generateError={generateError}
        onGenerate={handleGenerateOverview}
        onRegenerate={() => handleGenerateOverview(true)}
      />
      </div>

      <div id="subscriptions-card" className="self-center max-w-[1000px] w-full" style={{ "--card-delay": "200ms" } as React.CSSProperties}>
        <SubscriptionCard
          subscriptions={subscriptions}
          totalAnnual={totalSubscriptions}
          onTrack={() => setShowAddSubscriptionModal(true)}
          onEstimate={() => setShowCostPreviewModal(true)}
          onManage={setManageSubscription}
        />
      </div>

      <AddSubscriptionModal
        visible={showAddSubscriptionModal}
        onClose={() => setShowAddSubscriptionModal(false)}
        onSaved={() => {
          setShowAddSubscriptionModal(false);
          reloadDashboard();
        }}
      />

      <ManageSubscriptionModal
        subscription={manageSubscription}
        onClose={() => setManageSubscription(null)}
        onSaved={() => {
          setManageSubscription(null);
          reloadDashboard();
        }}
      />

      <SubscriptionCostPreviewModal
        visible={showCostPreviewModal}
        onClose={() => setShowCostPreviewModal(false)}
      />

      <ImportTipsModal
        visible={showImportTipsModal}
        onClose={() => setShowImportTipsModal(false)}
        onChooseFile={() => bulkImport.fileInputRef.current?.click()}
      />

      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3" style={{ width: "100%", maxWidth: "1000px", margin: "0 auto" }}>
        <div id="income-card" style={{ "--card-delay": "240ms" } as React.CSSProperties}><IncomeCard monthlyIncome={income.monthlyIncome} hasIncome={income.hasIncome} totalSpend={trends.totalSpend} month={selected.month - 1} year={selected.year} onSaved={reloadDashboard} /></div>
        <div id="budget-card" style={{ "--card-delay": "320ms" } as React.CSSProperties}><BudgetCard monthlyBudget={spendAnalysis.monthlyBudget} totalSpent={spendAnalysis.totalSpent} month={selected.month - 1} year={selected.year} onSaved={reloadDashboard} /></div>
        <div style={{ "--card-delay": "400ms" } as React.CSSProperties}><SpendingCard categories={trends.categories} totalSpend={trends.totalSpend} /></div>
      </div>

      <div className="self-center max-w-[1000px] w-full" style={{ "--card-delay": "480ms" } as React.CSSProperties}>
        <ExpenseNodes categories={trends.categories} totalSpend={trends.totalSpend} />
      </div>

      <div id="transactions-card" className="self-center max-w-[1000px] w-full">
        <TransactionTable state={transactionsManager} onDelete={reloadDashboard} subscriptions={subscriptions} highlightTransactionId={highlightTransactionId} onRowClick={(tx) => transactionSubmit.openDetailModal(tx)} />
      </div>

      <SuccessModal
        visible={
          transactionSubmit.showSuccessModal &&
          !transactionSubmit.showQuickReviewModal
        }
        createdTransaction={transactionSubmit.createdTransaction}
        onDone={() => {
          transactionSubmit.dismissSuccessModal();
          saveScrollToTransactions();
          window.location.reload();
        }}
      />

      <SuccessModal
        visible={bulkImport.showImportSuccessModal}
        title="Import Complete"
        message="Your transactions have been imported successfully."
        details={bulkImport.importSuccess ? [
          { label: "Transactions imported", value: String(bulkImport.importSuccess.count) },
          { label: "For", value: `${MONTHS[bulkImport.importSuccess.month - 1]} ${bulkImport.importSuccess.year}` },
        ] : []}
        onDone={() => {
          bulkImport.dismissImportSuccessModal();
          saveScrollToTransactions();
          window.location.reload();
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
        error={transactionSubmit.error}
        onClose={() => transactionSubmit.setShowQuickReviewModal()}
      />

      

      

      {showManualModal && (
        <Modal visible={showManualModal} onClose={() => setShowManualModal(false)} titleId="manual-entry-title" className="modal relative">
          <button
            onClick={() => setShowManualModal(false)}
            className="button absolute top-3 right-3 z-10 flex !h-7 !w-7 !items-center !justify-center !rounded-full !p-0"
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
            transactionDate={transactionSubmit.transactionDate}
            loading={transactionSubmit.loading}
            error={transactionSubmit.error}
            onMerchantChange={transactionSubmit.setMerchant}
            onAmountChange={transactionSubmit.setAmount}
            onPaymentModeChange={transactionSubmit.setPaymentMode}
            onTransactionTypeChange={transactionSubmit.setTransactionType}
            onDescriptionChange={transactionSubmit.setDescription}
            onTransactionDateChange={transactionSubmit.setTransactionDate}
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
