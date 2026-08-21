import { useEffect, useState } from "react";
import type {
  CategorizedTransactionResponse,
  CreateTransactionRequest,
  PaymentMode,
  TransactionCategory,
  TransactionResponse,
  TransactionType,
} from "../types";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

const PENDING_REVIEW_KEY = "solara.pending-review.v1";

interface PendingReview {
  transactionId: string;
}

function savePendingReview(transactionId: string) {
  try {
    localStorage.setItem(PENDING_REVIEW_KEY, JSON.stringify({ transactionId }));
  } catch { /* ignore */ }
}

function loadPendingReview(): PendingReview | null {
  try {
    const raw = localStorage.getItem(PENDING_REVIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingReview;
    if (!parsed.transactionId) {
      localStorage.removeItem(PENDING_REVIEW_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(PENDING_REVIEW_KEY);
    return null;
  }
}

function clearPendingReview() {
  try {
    localStorage.removeItem(PENDING_REVIEW_KEY);
  } catch { /* ignore */ }
}

export function useTransactionSubmit() {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [transactionType, setTransactionType] = useState<TransactionType>("DEBIT");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showQuickReviewModal, setShowQuickReviewModal] = useState(false);
  const [createdTransaction, setCreatedTransaction] = useState<TransactionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<CategorizedTransactionResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | "">("");
  const [reviewDescription, setReviewDescription] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPaymentMode, setEditPaymentMode] = useState<PaymentMode>("UPI");
  const [pollFailed, setPollFailed] = useState(false);

  function initEditableFields(tx: TransactionResponse | null) {
    if (!tx) return;
    setEditMerchant(tx.merchant);
    setEditAmount(tx.amount.toFixed(2));
    setEditPaymentMode(tx.paymentMode as PaymentMode);
  }

  async function pollTransaction(id: string) {
    setPollFailed(false);
    const delays = [1000, 2000, 3000, 5000, 8000, 13000, 21000, 30000, 30000, 30000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
      try {
        const resp = await api(
          `/api/v1/category/transaction/${id}`
        );
        if (resp.ok) {
          const data: CategorizedTransactionResponse = await resp.json();
          setReviewData(data);
          setPollFailed(false);
          return;
        }
      } catch {
        // retry on next delay
      }
    }
    setPollFailed(true);
  }

  function retryPollTransaction() {
    const txId = pendingTransactionId;
    if (txId) {
      setReviewData(null);
      setPollFailed(false);
      pollTransaction(txId);
    }
  }

  function openQuickReview(transactionId: string, transaction?: TransactionResponse) {
    if (transaction) {
      setCreatedTransaction(transaction);
      initEditableFields(transaction);
    }
    setPendingTransactionId(transactionId);
    setSelectedCategory("");
    setReviewDescription("");
    setReviewData(null);
    setShowQuickReviewModal(true);
    savePendingReview(transactionId);
    pollTransaction(transactionId);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCreatedTransaction(null);
    setPendingTransactionId(null);
    setReviewData(null);

    const parsedAmount = parseFloat(amount);
    if (!merchant.trim()) {
      setError("Merchant is required");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive number");
      return;
    }

    const requestBody: CreateTransactionRequest = {
      userId: getUserId() ?? DEFAULT_USER_ID,
      merchant: merchant.trim(),
      amount: parsedAmount,
      paymentMode,
      type: transactionType,
      description: description.trim() || undefined,
      transactionDate: transactionDate || undefined,
    };

    setLoading(true);
    try {
      const response = await api("/api/v1/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error(`Transaction service returned ${response.status}`);
      }
      const result: TransactionResponse = await response.json();
      openQuickReview(result.id, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLooksGood(refresh: (page: number) => Promise<void>) {
    if (!pendingTransactionId) return;
    setModalLoading(true);
    try {
      const promises: Promise<Response>[] = [];
      const parsedAmount = parseFloat(editAmount);
      const txBody: Record<string, unknown> = {};
      if (editMerchant.trim()) txBody.merchant = editMerchant.trim();
      if (!isNaN(parsedAmount) && parsedAmount > 0) txBody.amount = parsedAmount;
      if (editPaymentMode) txBody.paymentMode = editPaymentMode;
      if (Object.keys(txBody).length > 0) {
        promises.push(api(`/api/v1/transactions/${pendingTransactionId}?userId=${getUserId() ?? DEFAULT_USER_ID}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(txBody),
        }));
      }
      if (selectedCategory || reviewDescription.trim() || reviewData?.category) {
        const catBody: Record<string, string | boolean> = {};
        const categoryToSave = selectedCategory || reviewData?.category || "";
        if (categoryToSave) catBody.category = categoryToSave;
        if (reviewDescription.trim()) catBody.description = reviewDescription.trim();
        catBody.needsReview = false;
        promises.push(api(`/api/v1/category/transaction/${pendingTransactionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(catBody),
        }));
      }
      if (promises.length > 0) {
        const results = await Promise.all(promises);
        const failed = results.find((r) => !r.ok);
        if (failed) {
          setError(`Save returned ${failed.status}`);
          return;
        }
      }
      clearPendingReview();
      setShowQuickReviewModal(false);
      setPendingTransactionId(null);
      const createdAt = reviewData?.createdAt ?? new Date().toISOString();
      const txDate = new Date(createdAt);
      localStorage.setItem("solara.overview.banner", JSON.stringify({
        type: "single-tx",
        month: txDate.getMonth() + 1,
        year: txDate.getFullYear(),
        transactionId: pendingTransactionId,
        merchant: editMerchant.trim(),
        amount: parseFloat(editAmount) || 0,
        createdAt,
      }));
      setShowSuccessModal(true);
      refresh(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleReview(refresh: (page: number) => Promise<void>) {
    if (!pendingTransactionId) return;
    setModalLoading(true);
    try {
      const promises: Promise<Response>[] = [];
      const parsedAmount = parseFloat(editAmount);
      const txBody: Record<string, unknown> = {};
      if (editMerchant.trim()) txBody.merchant = editMerchant.trim();
      if (!isNaN(parsedAmount) && parsedAmount > 0) txBody.amount = parsedAmount;
      if (editPaymentMode) txBody.paymentMode = editPaymentMode;
      if (Object.keys(txBody).length > 0) {
        promises.push(api(`/api/v1/transactions/${pendingTransactionId}?userId=${getUserId() ?? DEFAULT_USER_ID}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(txBody),
        }));
      }
      const catBody: Record<string, unknown> = { needsReview: true };
      if (selectedCategory) catBody.category = selectedCategory.trim();
      if (reviewDescription.trim()) catBody.description = reviewDescription.trim();
      promises.push(api(`/api/v1/category/transaction/${pendingTransactionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catBody),
      }));
      const results = await Promise.all(promises);
      const failed = results.find((r) => !r.ok);
      if (failed) {
        setError(`Save returned ${failed.status}`);
        return;
      }
      clearPendingReview();
      setShowQuickReviewModal(false);
      setPendingTransactionId(null);
      const createdAt = reviewData?.createdAt ?? new Date().toISOString();
      const txDate = new Date(createdAt);
      localStorage.setItem("solara.overview.banner", JSON.stringify({
        type: "single-tx",
        month: txDate.getMonth() + 1,
        year: txDate.getFullYear(),
        transactionId: pendingTransactionId,
        merchant: editMerchant.trim(),
        amount: parseFloat(editAmount) || 0,
        createdAt,
      }));
      setShowSuccessModal(true);
      refresh(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setModalLoading(false);
    }
  }

  function dismissSuccessModal(refresh?: (page: number) => Promise<void>) {
    setShowSuccessModal(false);
    refresh?.(0);
  }

  function dismissQuickReview() {
    clearPendingReview();
    setShowQuickReviewModal(false);
    setDetailMode("review");
  }

  const [detailMode, setDetailMode] = useState<"review" | "detail">("review");
  const [detailLoading, setDetailLoading] = useState(false);

  function openDetailModal(transaction: CategorizedTransactionResponse) {
    setDetailMode("detail");
    setReviewData(transaction);
    setPendingTransactionId(transaction.transactionId);
    setSelectedCategory(transaction.category ?? "");
    setReviewDescription(transaction.description ?? "");
    setEditMerchant(transaction.merchant ?? "");
    setEditAmount(String(transaction.amount ?? ""));
    setEditPaymentMode((transaction.paymentMode as PaymentMode) ?? "UPI");
    setShowQuickReviewModal(true);
  }

  async function handleDetailSave() {
    if (!pendingTransactionId) return;
    setDetailLoading(true);
    try {
      const response = await api(
        `/api/v1/category/transaction/${pendingTransactionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchant: editMerchant.trim(),
            description: reviewDescription.trim(),
            ...(selectedCategory.trim() ? { category: selectedCategory.trim() } : {}),
          }),
        }
      );
      if (response.ok) {
        const updated: CategorizedTransactionResponse = await response.json();
        setReviewData(updated);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    const pending = loadPendingReview();
    if (pending) {
      setPendingTransactionId(pending.transactionId);
      setSelectedCategory("");
      setReviewData(null);
      setShowQuickReviewModal(true);
      savePendingReview(pending.transactionId);

      api(`/api/v1/category/transaction/${pending.transactionId}`).then((resp) => {
        if (resp.ok) resp.json().then((data: CategorizedTransactionResponse) => {
          setReviewData(data);
          const tx: TransactionResponse = {
            id: data.transactionId,
            userId: data.userId,
            amount: data.amount,
            merchant: data.merchant,
            paymentMode: data.paymentMode ?? "",
            currency: data.currency,
          };
          setCreatedTransaction(tx);
          initEditableFields(tx);
        });
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    merchant, setMerchant,
    amount, setAmount,
    paymentMode, setPaymentMode,
    transactionType, setTransactionType,
    description, setDescription,
    transactionDate, setTransactionDate,
    loading, error,
    showSuccessModal, setShowSuccessModal,
    showQuickReviewModal, setShowQuickReviewModal: dismissQuickReview,
    createdTransaction,
    pendingTransactionId,
    reviewData,
    pollFailed, retryPollTransaction,
    selectedCategory, setSelectedCategory,
    reviewDescription, setReviewDescription,
    modalLoading,
    editMerchant, setEditMerchant,
    editAmount, setEditAmount,
    editPaymentMode, setEditPaymentMode,
    handleSubmit,
    handleLooksGood,
    handleReview,
    dismissSuccessModal,
    detailMode,
    detailLoading,
    openDetailModal,
    handleDetailSave,
  };
}
