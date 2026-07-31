import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BANK_FORMATS, DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "../hooks/useAuth";

interface CsvRow {
  merchant: string;
  amount: string;
  paymentMode: string;
  description: string;
}

interface JobStatus {
  jobId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errorReport: string | null;
}

interface BulkImportProps {
  onImportComplete?: () => void;
}

export function BulkImport({ onImportComplete }: BulkImportProps) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bankType, setBankType] = useState("");
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items?.length > 0) setDragOver(true);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function parseCsv(text: string): CsvRow[] {
    const rows: string[][] = [];
    let current: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === "," || ch === "\t") {
          current.push(field.trim());
          field = "";
        } else if (ch === "\n") {
          current.push(field.trim());
          if (current.some((c) => c.length > 0)) rows.push(current);
          current = [];
          field = "";
        } else if (ch === "\r") {
          // skip
        } else {
          field += ch;
        }
      }
    }
    if (field.trim() || current.length > 0) {
      current.push(field.trim());
      if (current.some((c) => c.length > 0)) rows.push(current);
    }

    if (rows.length < 2) return [];

    const header = rows[0]!.map((h) => h.toLowerCase().replace(/[\s_-]+/g, ""));
    const hasMerchant = header.includes("merchant");
    const hasDebit = header.includes("debit") || header.includes("dr");
    const hasCredit = header.includes("credit") || header.includes("cr");
    const isBankFormat = hasDebit || hasCredit;

    function colIndex(names: string[]): number {
      for (const name of names) {
        const index = header.indexOf(name);
        if (index >= 0) return index;
      }
      return -1;
    }

    let merchantIndex: number, amountIndex: number, paymentModeIndex: number, descriptionIndex: number;

    if (isBankFormat) {
      merchantIndex = -1;
      descriptionIndex = colIndex(["details", "narration", "transactionremarks", "particulars", "description", "transactiondetail"]);
      amountIndex = colIndex(["debit", "dr", "withdrawal"]);
      if (amountIndex < 0) amountIndex = colIndex(["credit", "cr", "deposit"]);
      paymentModeIndex = colIndex(["type", "paymentmode", "paymentmode", "payment"]);
    } else if (hasMerchant) {
      merchantIndex = colIndex(["merchant"]);
      amountIndex = colIndex(["amount", "amt"]);
      paymentModeIndex = colIndex(["paymentmode", "paymentmode", "payment", "type"]);
      descriptionIndex = colIndex(["description", "narration", "details"]);
    } else {
      merchantIndex = 0;
      amountIndex = 1;
      paymentModeIndex = 2;
      descriptionIndex = 3;
    }

    const result: CsvRow[] = [];
    const dataStart = hasMerchant ? 1 : isBankFormat ? 1 : 0;
    for (let i = dataStart; i < rows.length; i++) {
      const cols = rows[i]!;
      let merchant = merchantIndex >= 0 ? cols[merchantIndex] ?? "" : "";
      let amount = "";
      let paymentMode = paymentModeIndex >= 0 ? cols[paymentModeIndex] ?? "" : "OTHER";
      let description = descriptionIndex >= 0 ? cols[descriptionIndex] ?? "" : "";

      if (isBankFormat) {
        description = cols[descriptionIndex] ?? "";
        if (amountIndex >= 0) {
          const raw = cols[amountIndex] ?? "";
          const num = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
          if (!isNaN(num) && num > 0) amount = num.toString();
        }
        if (!amount) {
          const alternateIndex = amountIndex === colIndex(["debit", "dr", "withdrawal"])
            ? colIndex(["credit", "cr", "deposit"])
            : colIndex(["debit", "dr", "withdrawal"]);
          if (alternateIndex >= 0) {
            const raw = cols[alternateIndex] ?? "";
            const num = parseFloat(raw.replace(/[^0-9.\-]/g, ""));
            if (!isNaN(num) && num > 0) amount = num.toString();
          }
        }
        const detail = description.toUpperCase();
        const isUpi = /\bUPI\b/.test(description) || detail.includes("@YBL") || detail.includes("@PAYTM");
        if (isUpi) paymentMode = "UPI";
        else if (detail.startsWith("NEFT")) paymentMode = "NEFT";
        else if (detail.startsWith("POS")) paymentMode = "DEBIT_CARD";
        else if (detail.startsWith("WDL TFR")) paymentMode = "OTHER";
        else if (detail.startsWith("DEP TFR")) paymentMode = "OTHER";
        let cleanedDescription = description;
        cleanedDescription = cleanedDescription.replace(/^WDL TFR\s*/i, "");
        const upiParts = cleanedDescription.match(/UPI\/DR\/\d+\/([A-Za-z][A-Za-z0-9 .&]+)/);
        if (upiParts) merchant = upiParts[1]!.trim();
        else {
          const neftMatch = cleanedDescription.match(/NEFT\s*(?:CR|DR)?[:\-]?\s*\d+\s+(.+?)(?:\s+\d+|$)/i);
          if (neftMatch) merchant = neftMatch[1]!.trim();
          else {
            const paidMatch = cleanedDescription.match(/PAY\s*TO\s+(.+?)(?:\s+AT\s+\d+|$)/i);
            if (paidMatch) merchant = paidMatch[1]!.trim();
            else {
              const cleaned = cleanedDescription.replace(/^DEBIT\s+\d+\s+(YONO\s+)?DR\s+\d+\s+/i, "").trim();
              if (cleaned && cleaned !== cleanedDescription) merchant = cleaned;
              else merchant = cleanedDescription.split(/[\s/]/).slice(0, 3).join(" ");
            }
          }
        }
      } else {
        merchant = merchantIndex >= 0 ? cols[merchantIndex] ?? "" : cols[0] ?? "";
        amount = amountIndex >= 0 ? cols[amountIndex] ?? "0" : cols[1] ?? "0";
        paymentMode = paymentModeIndex >= 0 ? cols[paymentModeIndex] ?? "OTHER" : cols[2] ?? "OTHER";
        description = descriptionIndex >= 0 ? cols[descriptionIndex] ?? "" : cols[3] ?? "";
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) continue;

      result.push({ merchant, amount, paymentMode, description });
    }
    return result;
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setJobStatus(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") setRows(parseCsv(text));
    };
    reader.readAsText(file);
  }

  async function handleSubmit() {
    if (rows.length === 0) return;
    setSubmitting(true);
    setJobStatus(null);

    function escapeCsv(val: string): string {
      const v = val ?? "";
      if (v.includes('"') || v.includes(",") || v.includes("\n") || v.includes("\r")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    }

    try {
      const formData = new FormData();
      const header = "merchant,amount,paymentMode,description";
      const body = [header, ...rows.map((r) =>
        [escapeCsv(r.merchant), escapeCsv(r.amount), escapeCsv(r.paymentMode), escapeCsv(r.description)].join(",")
      )].join("\n");
      const blob = new Blob([body], { type: "text/csv" });
      formData.append("userId", getUserId() ?? DEFAULT_USER_ID);
      formData.append("file", blob, "transactions.csv");
      if (bankType) formData.append("bankType", bankType);

      const response = await api("/api/v1/transactions/bulk/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      const data = await response.json();
      pollingRef.current = setInterval(async () => {
        try {
          const pollRes = await api(`/api/v1/transactions/bulk/${data.jobId}`);
          if (pollRes.ok) {
            const status: JobStatus = await pollRes.json();
            setJobStatus(status);
            if (status.status === "COMPLETED") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              onImportComplete?.();
            } else if (status.status === "FAILED") {
              if (pollingRef.current) clearInterval(pollingRef.current);
            }
          }
        } catch {
          // retry on next interval
        }
      }, 1500);
    } catch (err) {
      setJobStatus({
        jobId: "",
        status: "FAILED",
        totalRows: rows.length,
        importedRows: 0,
        failedRows: rows.length,
        errorReport: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function isFinished() {
    return jobStatus?.status === "COMPLETED" || jobStatus?.status === "FAILED";
  }

  return (
    <div>
      <div
        className={`bulk-dropzone ${dragOver ? "bulk-dropzone--active" : ""}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="bulk-dropzone-icon">{'\u2913'}</span>
        <span className="bulk-dropzone-text">
          {rows.length > 0
            ? `${rows.length} transaction${rows.length > 1 ? "s" : ""} loaded`
            : dragOver
              ? "Drop your CSV here"
              : "Drop a .csv file here or click to browse"}
        </span>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex gap-2 mt-2">
            <select
              className="bg-black border border-neutral-700 rounded px-2 py-1 text-white text-[0.65rem] outline-none w-full"
              value={bankType}
              onChange={(e) => setBankType(e.target.value)}
            >
              <option value="">Auto-detect bank format</option>
              {BANK_FORMATS.map((fmt) => (
                <option key={fmt} value={fmt}>{fmt}</option>
              ))}
            </select>
          </div>

          <div className="bulk-preview">
            <div className="bulk-preview-header">
              <span className="text-[0.65rem] text-neutral-500">
                {jobStatus
                  ? `Imported ${jobStatus.importedRows} / ${jobStatus.totalRows}`
                  : `Preview (${rows.length} rows)`}
              </span>
              {!isFinished() && (
                <button className="bulk-clear" onClick={() => { setRows([]); setJobStatus(null); }}>
                  {'\u2715'} Clear
                </button>
              )}
            </div>

            {jobStatus && (
              <div className="px-2 py-1.5 text-[0.6rem]">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-medium ${jobStatus.status === "COMPLETED" ? "text-green-400" : jobStatus.status === "FAILED" ? "text-red-400" : "text-yellow-400"}`}>
                    {jobStatus.status === "PENDING" && "Queued\u2026"}
                    {jobStatus.status === "PROCESSING" && "Processing\u2026"}
                    {jobStatus.status === "COMPLETED" && "Completed"}
                    {jobStatus.status === "FAILED" && "Failed"}
                  </span>
                  {(jobStatus.status === "PROCESSING" || jobStatus.status === "PENDING") && (
                    <span className="spinner !w-3 !h-3" />
                  )}
                </div>
                <div className="text-neutral-400">
                  {jobStatus.importedRows} imported
                  {jobStatus.failedRows > 0 && `, ${jobStatus.failedRows} failed`}
                  {jobStatus.totalRows > 0 && ` / ${jobStatus.totalRows} total`}
                </div>
                {jobStatus.failedRows > 0 && jobStatus.errorReport && jobStatus.errorReport !== "[]" && (
                  <div className="text-red-400 mt-1 text-[0.55rem] max-h-20 overflow-y-auto">
                    {(() => {
                      try { return JSON.parse(jobStatus.errorReport).map((e: any, i: number) => <div key={i}>Row {e.row}: {Object.values(e.errors || {}).join(", ")}</div>); }
                      catch { return jobStatus.errorReport; }
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="bulk-table-wrap">
              <table className="bulk-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Merchant</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{row.merchant}</td>
                      <td>{'\u20B9'}{parseFloat(row.amount || "0").toFixed(2)}</td>
                      <td>{row.paymentMode}</td>
                      <td className="bulk-desc">{row.description || "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="text-[0.6rem] text-neutral-500 text-center pt-1">
                  Showing 20 of {rows.length} rows
                </p>
              )}
            </div>

            {!isFinished() && (
              <button
                className="btn-submit mt-2"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Uploading\u2026" : `Import ${rows.length} Transaction${rows.length > 1 ? "s" : ""}`}
              </button>
            )}

            {isFinished() && (
              <button
                className="btn-submit mt-2 bg-green-700 hover:bg-green-600"
                onClick={() => { setRows([]); setJobStatus(null); }}
              >
                Clear & Import Another
              </button>
            )}
          </div>
        </>
      )}
      {createPortal(
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileInputChange}
        />,
        document.body
      )}
    </div>
  );
}
