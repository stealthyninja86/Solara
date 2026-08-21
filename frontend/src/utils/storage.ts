const ACTIVE_IMPORT_KEY = "solara.active-import.v1";
const ACTIVE_OVERVIEW_KEY = "solara.active-overview.v1";
const OVERVIEW_TTL_MS = 90 * 1000;
const ROW_ESTIMATE_MS = 45 * 1000;
const MIN_IMPORT_TTL_MS = 15 * 60 * 1000;
const MAX_IMPORT_TTL_MS = 2 * 60 * 60 * 1000;

export const OVERVIEW_SELECTED_KEY = "solara.overview.selected";
export const OVERVIEW_BANNER_KEY = "solara.overview.banner";
export const HIGHLIGHT_TRANSACTION_KEY = "solara.highlight.transaction";
export const SCROLL_TO_TRANSACTIONS_KEY = "solara.scroll-to-transactions";

export interface ActiveImport {
  jobId: string;
  expectedCount: number;
  baselineCount: number;
  startedAt: number;
}

export function importTtlMs(expectedCount: number): number {
  return Math.min(MAX_IMPORT_TTL_MS, Math.max(MIN_IMPORT_TTL_MS, expectedCount * ROW_ESTIMATE_MS));
}

export function loadActiveImport(): ActiveImport | null {
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

export function saveActiveImport(activeImport: ActiveImport) {
  try {
    localStorage.setItem(ACTIVE_IMPORT_KEY, JSON.stringify(activeImport));
  } catch {
    // storage unavailable — degrade to current behavior
  }
}

export function clearActiveImport() {
  try {
    localStorage.removeItem(ACTIVE_IMPORT_KEY);
  } catch {
    // ignore
  }
}

export interface ActiveOverview {
  at: string;
  startedAt: number;
}

export function loadActiveOverview(): ActiveOverview | null {
  try {
    const raw = localStorage.getItem(ACTIVE_OVERVIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveOverview;
    if (!parsed.at || !Number.isFinite(parsed.startedAt)) {
      localStorage.removeItem(ACTIVE_OVERVIEW_KEY);
      return null;
    }
    if (Date.now() - parsed.startedAt > OVERVIEW_TTL_MS) {
      localStorage.removeItem(ACTIVE_OVERVIEW_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(ACTIVE_OVERVIEW_KEY);
    return null;
  }
}

export function saveActiveOverview(activeOverview: ActiveOverview) {
  try {
    localStorage.setItem(ACTIVE_OVERVIEW_KEY, JSON.stringify(activeOverview));
  } catch {
    // storage unavailable
  }
}

export function clearActiveOverview() {
  try {
    localStorage.removeItem(ACTIVE_OVERVIEW_KEY);
  } catch {
    // ignore
  }
}

export function loadSelectedMonth(): { year: number; month: number } {
  try {
    const raw = localStorage.getItem(OVERVIEW_SELECTED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.year && parsed.month) return parsed;
    }
  } catch { /* ignore */ }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function persistSelectedMonth(next: { year: number; month: number }) {
  try {
    localStorage.setItem(OVERVIEW_SELECTED_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
  window.location.reload();
}

export interface BannerData {
  type: "import" | "single-tx";
  month: number;
  year: number;
  count?: number;
  transactionId?: string;
  merchant?: string;
  amount?: number;
  createdAt?: string;
}

export function loadBannerData(): BannerData | null {
  try {
    const raw = localStorage.getItem(OVERVIEW_BANNER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.year && parsed.month && parsed.type) return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

export function saveBannerData(data: BannerData) {
  try {
    localStorage.setItem(OVERVIEW_BANNER_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function clearBannerData() {
  try {
    localStorage.removeItem(OVERVIEW_BANNER_KEY);
  } catch { /* ignore */ }
}

export function saveHighlightTransactionId(id: string) {
  try {
    localStorage.setItem(HIGHLIGHT_TRANSACTION_KEY, id);
  } catch { /* ignore */ }
}

export function saveScrollToTransactions() {
  try {
    localStorage.setItem(SCROLL_TO_TRANSACTIONS_KEY, "1");
  } catch { /* ignore */ }
}

export function consumeScrollToTransactions(): boolean {
  try {
    const pending = localStorage.getItem(SCROLL_TO_TRANSACTIONS_KEY) !== null;
    if (pending) localStorage.removeItem(SCROLL_TO_TRANSACTIONS_KEY);
    return pending;
  } catch {
    return false;
  }
}