import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../utils/api";
import { DEFAULT_USER_ID } from "../constants";
import type { PageResponse } from "../types";
import {
  clearActiveImport,
  importTtlMs,
  loadActiveImport,
  saveActiveImport,
  saveBannerData,
} from "../utils/storage";
import { getUserId } from "./useAuth";

interface ImportSuccess {
  count: number;
  month: number;
  year: number;
}

/**
 * Bulk CSV/JSON import orchestration: upload, job polling, read-model
 * progress polling, crash-resume via localStorage checkpoint, and the
 * post-import banner/success-modal handoff.
 */
export function useBulkImport() {
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [showImportSuccessModal, setShowImportSuccessModal] = useState(false);
  const [importSuccess, setImportSuccess] = useState<ImportSuccess | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    const activeImport = loadActiveImport();
    if (activeImport) void resumeActiveImport(activeImport);
    // run once on mount; getUserId() is a module-level read, safe before auth settles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function finishImport(
    job: { status: string; minDate?: string; maxDate?: string } | null,
    expectedCount: number,
  ) {
    let bannerMonth: number | undefined;
    let bannerYear: number | undefined;
    if (job?.minDate && job?.maxDate) {
      const min = new Date(job.minDate);
      const max = new Date(job.maxDate);
      const sameMonth = min.getFullYear() === max.getFullYear() && min.getMonth() === max.getMonth();
      if (sameMonth) {
        bannerMonth = min.getMonth() + 1;
        bannerYear = min.getFullYear();
      } else {
        bannerMonth = max.getMonth() + 1;
        bannerYear = max.getFullYear();
      }
      saveBannerData({ type: "import", month: bannerMonth, year: bannerYear, count: expectedCount });
    } else {
      try {
        const userId = getUserId() ?? DEFAULT_USER_ID;
        const datesRes = await api(`/api/v1/insights/available-dates?userId=${userId}`);
        if (datesRes.ok) {
          const dates: Array<{ year: number; month: number }> = await datesRes.json();
          const latest = dates[0];
          if (latest) {
            bannerMonth = latest.month;
            bannerYear = latest.year;
            saveBannerData({ type: "import", month: latest.month, year: latest.year, count: expectedCount });
          }
        }
      } catch { /* ignore */ }
    }
    const now = new Date();
    setImportSuccess({
      count: expectedCount,
      month: bannerMonth ?? now.getMonth() + 1,
      year: bannerYear ?? now.getFullYear(),
    });
    setShowImportSuccessModal(true);
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
          void finishImport(job, expectedCount);
        }
      } catch {
        // retry on next tick
      }
    }, 2000);
  }

  async function resumeActiveImport(activeImport: { jobId: string; baselineCount: number; startedAt: number }) {
    const { jobId, baselineCount, startedAt } = activeImport;
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
        void finishImport(job, authoritativeExpected);
      } else {
        startReadModelPolling(authoritativeExpected, baselineCount, jobId, startedAt);
      }
    } catch {
      setImporting(false);
      setImportStatus("");
    }
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, []);

  return {
    importing,
    importStatus,
    showImportSuccessModal,
    dismissImportSuccessModal: () => setShowImportSuccessModal(false),
    importSuccess,
    fileInputRef,
    handleFileChange,
  };
}