import { useCallback, useEffect, useRef, useState } from "react";
import { getUserId } from "../hooks/useAuth";
import { useTransactions } from "../hooks/useTransactions";
import { useTransactionSubmit } from "../hooks/useTransactionSubmit";
import { useAvailableDates } from "../hooks/useAvailableDates";
import { useSpendAnalysis } from "../hooks/useSpendAnalysis";
import { useIncome } from "../hooks/useIncome";
import { useTrends } from "../hooks/useTrends";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { TransactionForm } from "../components/cards/TransactionForm";
import { BulkImport } from "../components/cards/BulkImport";
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
import { HowItWorks, type HowItWorksItem } from "../components/ui/HowItWorks";
import { OnboardingChecklist } from "../components/cards/OnboardingChecklist";
import { api, streamEvents } from "../utils/api";
import { DEFAULT_USER_ID } from "../constants";
import { Icon } from "../components/ui/Icon";
import { FinanceOverview } from "../components/cards/FinanceOverview";
import type { PageResponse } from "../types";
import type { TrackedSubscription } from "../types/reports";
import type { InsightCard } from "../types/reports";

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

const ACTIVE_IMPORT_KEY = "solara.active-import.v1";
const ROW_ESTIMATE_MS = 45 * 1000;
const MIN_IMPORT_TTL_MS = 15 * 60 * 1000;
const MAX_IMPORT_TTL_MS = 2 * 60 * 60 * 1000;

function importTtlMs(expectedCount: number): number {
  return Math.min(MAX_IMPORT_TTL_MS, Math.max(MIN_IMPORT_TTL_MS, expectedCount * ROW_ESTIMATE_MS));
}

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
    if (Date.now() - parsed.startedAt > importTtlMs(parsed.expectedCount)) {
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
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const NOW = new Date();
const STORAGE_KEY = "solara.overview.selected";

function loadSelected(): { year: number; month: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.year && parsed.month) return parsed;
    }
  } catch { /* ignore */ }
  return { year: NOW.getFullYear(), month: NOW.getMonth() + 1 };
}

interface BannerData {
  type: "import" | "single-tx";
  month: number;
  year: number;
  count?: number;
  transactionId?: string;
  merchant?: string;
  amount?: number;
  createdAt?: string;
}

function loadBannerData(): BannerData | null {
  try {
    const raw = localStorage.getItem("solara.overview.banner");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.year && parsed.month && parsed.type) return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function saveBannerData(data: BannerData) {
  try {
    localStorage.setItem("solara.overview.banner", JSON.stringify(data));
  } catch { /* ignore */ }
}

function clearBannerData() {
  try {
    localStorage.removeItem("solara.overview.banner");
  } catch { /* ignore */ }
}

function saveHighlightTransactionId(id: string) {
  try {
    localStorage.setItem("solara.highlight.transaction", id);
  } catch { /* ignore */ }
}

export function DashboardOverview() {
  const [budgetKey, setBudgetKey] = useState(0);
  const transactionSubmit = useTransactionSubmit();
  const transactionsManager = useTransactions();
  const [selected] = useState(loadSelected);
  const [bannerData, setBannerData] = useState(loadBannerData);
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

  const periods = useAvailableDates(budgetKey);

  const spendAnalysis = useSpendAnalysis(budgetKey, selected.month - 1, selected.year);
  const income = useIncome(budgetKey);
  const trends = useTrends(budgetKey, selected.month - 1, selected.year);
  const subscriptionsManager = useSubscriptions(budgetKey);
  const [showManualModal, setShowManualModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAddSubscriptionModal, setShowAddSubscriptionModal] = useState(false);
  const [showCostPreviewModal, setShowCostPreviewModal] = useState(false);
  const [manageSubscription, setManageSubscription] = useState<TrackedSubscription | null>(null);
  const [importStartedAt, setImportStartedAt] = useState<number | undefined>();
  const [generatingOverview, setGeneratingOverview] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [streamingCards, setStreamingCards] = useState<InsightCard[]>([]);
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
    const fromMonth = String(selected.month).padStart(2, "0");
    const fromYear = selected.year;
    const lastDay = new Date(fromYear, selected.month, 0).getDate();
    transactionsManager.setDateFrom(`${fromYear}-${fromMonth}-01`);
    transactionsManager.setDateTo(`${fromYear}-${fromMonth}-${String(lastDay).padStart(2, "0")}`);
    transactionsManager.setDateFilterKey((k) => k + 1);
  }, [selected]);

  function persist(next: { year: number; month: number }) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    window.location.reload();
  }

  const currentIndex = periods.findIndex(
    (p) => p.year === selected.year && p.month === selected.month,
  );

  function shift(delta: number) {
    const next = periods[currentIndex + delta];
    if (next) persist(next);
  }

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
      if (Date.now() - startedAt > importTtlMs(expectedCount)) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        clearActiveImport();
        setImporting(false);
        setImportStatus("Import is taking longer than expected. Please try again.");
        setTimeout(() => setImportStatus(""), 4000);
        return;
      }
      try {
        let job: { status: string; minDate?: string; maxDate?: string } | null = null;
        const jobRes = await api(`/api/v1/transactions/bulk/${jobId}?userId=${getUserId() ?? DEFAULT_USER_ID}`);
        if (jobRes.ok) {
          job = await jobRes.json();
          if (job!.status === "FAILED") {
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
        setImportStatus(`Processing\u2026 ${categorized}/${expectedCount} rows processed`);
        if (total - baselineCount >= expectedCount) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          clearActiveImport();
          setImporting(false);
          setImportStatus("");
          // Use date range from the import job response, fallback to available-dates
          if (job?.minDate && job?.maxDate) {
            const min = new Date(job.minDate);
            const max = new Date(job.maxDate);
            const sameMonth = min.getFullYear() === max.getFullYear() && min.getMonth() === max.getMonth();
            if (sameMonth) {
              saveBannerData({ type: "import", month: min.getMonth() + 1, year: min.getFullYear(), count: expectedCount });
            } else {
              saveBannerData({ type: "import", month: max.getMonth() + 1, year: max.getFullYear(), count: expectedCount });
            }
          } else {
            try {
              const userId = getUserId() ?? DEFAULT_USER_ID;
              const datesRes = await api(`/api/v1/insights/available-dates?userId=${userId}`);
              if (datesRes.ok) {
                const dates: Array<{ year: number; month: number }> = await datesRes.json();
                const latest = dates[0];
                if (latest) saveBannerData({ type: "import", month: latest.month, year: latest.year, count: expectedCount });
              }
            } catch { /* ignore */ }
          }
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
      const jobRes = await api(`/api/v1/transactions/bulk/${jobId}?userId=${getUserId() ?? DEFAULT_USER_ID}`);
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
        // Use date range from the import job response, fallback to available-dates
        if (job?.minDate && job?.maxDate) {
          const min = new Date(job.minDate);
          const max = new Date(job.maxDate);
          const sameMonth = min.getFullYear() === max.getFullYear() && min.getMonth() === max.getMonth();
          if (sameMonth) {
            saveBannerData({ type: "import", month: min.getMonth() + 1, year: min.getFullYear(), count: authoritativeExpected });
          } else {
            saveBannerData({ type: "import", month: max.getMonth() + 1, year: max.getFullYear(), count: authoritativeExpected });
          }
        } else {
          try {
            const userId = getUserId() ?? DEFAULT_USER_ID;
            const datesRes = await api(`/api/v1/insights/available-dates?userId=${userId}`);
            if (datesRes.ok) {
              const dates: Array<{ year: number; month: number }> = await datesRes.json();
              const latest = dates[0];
              if (latest) saveBannerData({ type: "import", month: latest.month, year: latest.year, count: authoritativeExpected });
            }
          } catch { /* ignore */ }
        }
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
          const pollRes = await api(`/api/v1/transactions/bulk/${data.jobId}?userId=${getUserId() ?? DEFAULT_USER_ID}`);
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
    window.location.reload();
  }, []);

  const handleGenerateOverview = useCallback((refresh = false) => {
    setGeneratingOverview(true);
    setGenerateError("");
    setStreamingCards([]);
    const userId = getUserId() ?? DEFAULT_USER_ID;
    const now = new Date();
    const at = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const force = refresh ? "&refresh=true" : "";
    const url = `/api/v1/insights/overview/stream?userId=${userId}&period=MONTHLY&at=${at}${force}`;
    streamEvents(url, {
      onEvent: (event, data) => {
        if (event === "card") {
          try {
            const card = JSON.parse(data) as InsightCard;
            setStreamingCards((prev) => [...prev, card]);
          } catch { /* ignore malformed events */ }
        }
      },
      onDone: () => {
        setBudgetKey((k) => k + 1);
        setStreamingCards([]);
        setGeneratingOverview(false);
      },
      onError: (status) => {
        if (status === 429) {
          setGenerateError("Regeneration limit reached — try again tomorrow.");
          setStreamingCards([]);
          setGeneratingOverview(false);
          return;
        }
        // Fallback to the non-streaming JSON endpoint (option 3) — only
        // surface an error if that fails too.
        api(`/api/v1/insights/overview?userId=${userId}&period=MONTHLY&at=${at}${force}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: InsightCard[] | null) => {
            if (data && data.length > 0) {
              setBudgetKey((k) => k + 1);
            }
          })
          .catch(() => {
            setGenerateError("Generation failed. Please try again.");
          })
          .finally(() => {
            setStreamingCards([]);
            setGeneratingOverview(false);
          });
      },
    });
  }, []);

  const { pullRef } = usePullToRefresh(handleRefresh, transactionsManager.setPullRefreshing);

  return (
    <div ref={pullRef} style={{ width: "100%" }} className="flex flex-col gap-8">

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
                persist({ year: bannerData.year, month: bannerData.month });
                clearBannerData();
                setBannerData(null);
                setTimeout(() => {
                  document.getElementById("transactions-card")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
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
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="button flex items-center gap-1.5 !px-3 !py-1.5 !text-[0.75rem] text-[var(--color-text-secondary)]!"
            >
              {importing ? <><span className="spinner !w-2.5 !h-2.5" /> {importStatus || "Importing\u2026"}</> : <><Icon name="import" size={12} /> Import</>}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleFileChange}
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
        refreshKey={budgetKey}
        transactionCount={transactionsManager.transactions.length}
        generating={generatingOverview}
        generateError={generateError}
        streamingCards={streamingCards}
        onGenerate={handleGenerateOverview}
        onRegenerate={() => handleGenerateOverview(true)}
      />
      </div>

      <div id="subscriptions-card" className="self-center max-w-[1000px] w-full" style={{ "--card-delay": "200ms" } as React.CSSProperties}>
        <SubscriptionCard
          subscriptions={subscriptionsManager.subscriptions}
          totalAnnual={subscriptionsManager.totalSubscriptions}
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
          setBudgetKey((previous) => previous + 1);
        }}
      />

      <ManageSubscriptionModal
        subscription={manageSubscription}
        onClose={() => setManageSubscription(null)}
        onSaved={() => {
          setManageSubscription(null);
          setBudgetKey((previous) => previous + 1);
        }}
      />

      <SubscriptionCostPreviewModal
        visible={showCostPreviewModal}
        onClose={() => setShowCostPreviewModal(false)}
      />

      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3" style={{ width: "100%", maxWidth: "1000px", margin: "0 auto" }}>
        <div id="income-card" style={{ "--card-delay": "240ms" } as React.CSSProperties}><IncomeCard refreshKey={budgetKey} totalSpend={trends.totalSpend} month={selected.month - 1} year={selected.year} /></div>
        <div id="budget-card" style={{ "--card-delay": "320ms" } as React.CSSProperties}><BudgetCard refreshKey={budgetKey} onBudgetUpdated={() => setBudgetKey((previous) => previous + 1)} month={selected.month - 1} year={selected.year} /></div>
        <div style={{ "--card-delay": "400ms" } as React.CSSProperties}><SpendingCard categories={trends.categories} totalSpend={trends.totalSpend} /></div>
      </div>

      <div className="self-center max-w-[1000px] w-full" style={{ "--card-delay": "480ms" } as React.CSSProperties}>
        <ExpenseNodes categories={trends.categories} totalSpend={trends.totalSpend} />
      </div>

      <div id="transactions-card" className="self-center max-w-[1000px] w-full">
        <TransactionTable state={transactionsManager} onDelete={() => setBudgetKey((previous) => previous + 1)} subscriptions={subscriptionsManager.subscriptions} highlightTransactionId={highlightTransactionId} onRowClick={(tx) => transactionSubmit.openDetailModal(tx)} />
      </div>

      <SuccessModal
        visible={
          transactionSubmit.showSuccessModal &&
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

      <BulkImport visible={showReviewModal} onClose={() => { setShowReviewModal(false); window.location.reload(); }} importStartedAt={importStartedAt} onDelete={() => {
        setBudgetKey((previous) => previous + 1);
        transactionsManager.fetchTransactions(transactionsManager.currentPage);
      }} />

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
