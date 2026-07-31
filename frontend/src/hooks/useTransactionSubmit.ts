import { useRef, useState } from "react";
import type {
  CategorizedTransactionResponse,
  CreateTransactionRequest,
  PaymentMode,
  TransactionResponse,
  TransactionType,
} from "../types";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

export function useTransactionSubmit() {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [transactionType, setTransactionType] = useState<TransactionType>("DEBIT");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showQuickReviewModal, setShowQuickReviewModal] = useState(false);
  const [createdTransaction, setCreatedTransaction] = useState<TransactionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<CategorizedTransactionResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  const createdTransactionRef = useRef(createdTransaction);
  createdTransactionRef.current = createdTransaction;

  async function pollTransaction(id: string) {
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const resp = await api(
          `/api/v1/category/transaction/${id}`
        );
        if (resp.ok) {
          const data: CategorizedTransactionResponse = await resp.json();
          setReviewData(data);
          return;
        }
      } catch {
        // retry
      }
    }
  }

  function dismissSuccessModal(
    refresh: (page: number) => Promise<void>
  ) {
    setShowSuccessModal(false);
    refresh(0);
    const storedTransaction = createdTransactionRef.current;
    if (storedTransaction?.id) {
      setPendingTransactionId(storedTransaction.id);
      setSelectedCategory("");
      setReviewData(null);
      setShowQuickReviewModal(true);
      pollTransaction(storedTransaction.id);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setShowSuccessModal(false);
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
      setCreatedTransaction(result);
      setShowSuccessModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setShowSuccessModal(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleCategorySubmit(
    refresh: (page: number) => Promise<void>
  ) {
    if (!pendingTransactionId || !selectedCategory.trim()) return;
    setModalLoading(true);
    try {
      const response = await api(
        `/api/v1/category/transaction/${pendingTransactionId}/category`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: selectedCategory.trim() }),
        }
      );
      if (response.ok) {
        setShowCategoryModal(false);
        setPendingTransactionId(null);
        refresh(0);
      } else {
        setError(`Recategorize returned ${response.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recategorize failed");
    } finally {
      setModalLoading(false);
    }
  }

  return {
    merchant, setMerchant,
    amount, setAmount,
    paymentMode, setPaymentMode,
    transactionType, setTransactionType,
    description, setDescription,
    loading, error,
    showSuccessModal, setShowSuccessModal,
    showQuickReviewModal, setShowQuickReviewModal,
    createdTransaction,
    showCategoryModal, setShowCategoryModal,
    pendingTransactionId,
    reviewData,
    selectedCategory, setSelectedCategory,
    modalLoading,
    handleSubmit,
    dismissSuccessModal,
    handleCategorySubmit,
  };
}
