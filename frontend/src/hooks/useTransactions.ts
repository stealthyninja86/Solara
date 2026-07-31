import { useCallback, useEffect, useState } from "react";
import type { CategorizedTransactionResponse, PageResponse, TransactionCategory } from "../types";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

export function useTransactions() {
  const [transactions, setTransactions] = useState<CategorizedTransactionResponse[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateUI, setDateUI] = useState<"idle" | "from" | "to">("idle");
  const [updatedAtFrom, setUpdatedAtFrom] = useState("");
  const [updatedUI, setUpdatedUI] = useState<"idle" | "from">("idle");
  const [dateFilterKey, setDateFilterKey] = useState(0);
  const [detailTransaction, setDetailTransaction] = useState<CategorizedTransactionResponse | null>(null);
  const [editMerchant, setEditMerchant] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<TransactionCategory | "">("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [pageSize, setPageSizeState] = useState(10);

  function setPageSize(size: number) {
    setPageSizeState(size);
    setCurrentPage(0);
  }

  const fetchTransactions = useCallback(async (pageNumber: number) => {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("userId", getUserId() ?? DEFAULT_USER_ID);
      params.set("page", String(pageNumber));
      params.set("size", String(pageSize));
      params.set("sort", `${sortBy},${sortDir}`);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (categoryFilter === "__uncategorized__") params.set("category", "null");
      else if (categoryFilter) params.set("category", categoryFilter);
      if (paymentFilter) params.set("paymentMode", paymentFilter);
      if (updatedAtFrom) params.set("updatedAtFrom", updatedAtFrom);
      const response = await api(
        `/api/v1/category/transaction?${params}`
      );
      if (response.ok) {
        const data: PageResponse = await response.json();
        setTransactions(data.content);
        setTotalPages(data.totalPages);
        setCurrentPage(data.number);
      }
    } catch {
      // silent
    } finally {
      setListLoading(false);
      setPullRefreshing(false);
    }
  }, [sortBy, sortDir, categoryFilter, paymentFilter, updatedAtFrom, dateFilterKey, pageSize]);

  useEffect(() => {
    fetchTransactions(0);
  }, [fetchTransactions]);

  async function handleDelete(id: string) {
    try {
      const response = await api(`/api/v1/category/transaction/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setTransactions((prev) => prev.filter((transaction) => transaction.transactionId !== id));
        if (detailTransaction?.transactionId === id) {
          setDetailTransaction(null);
        }
      }
    } catch {
      // silent
    }
  }

  function openDetailModal(transaction: CategorizedTransactionResponse) {
    setDetailTransaction(transaction);
    setEditMerchant(transaction.merchant ?? "");
    setEditDescription(transaction.originalDescription ?? "");
    setEditCategory(transaction.category ?? "");
  }

  async function handleDetailSave() {
    if (!detailTransaction) return;
    setDetailLoading(true);
    try {
      const response = await api(
        `/api/v1/category/transaction/${detailTransaction.transactionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchant: editMerchant.trim(),
            originalDescription: editDescription.trim(),
            category: editCategory.trim(),
          }),
        }
      );
      if (response.ok) {
        const updated: CategorizedTransactionResponse = await response.json();
        setDetailTransaction(updated);
        fetchTransactions(currentPage);
      }
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  function sortIndicator(field: string): string {
    if (sortBy !== field) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  }

  return {
    transactions, currentPage, totalPages, listLoading, pullRefreshing, setPullRefreshing,
    sortBy, sortDir,
    categoryFilter, setCategoryFilter,
    paymentFilter, setPaymentFilter,
    dateFrom, setDateFrom, dateTo, setDateTo, dateUI, setDateUI,
    updatedAtFrom, setUpdatedAtFrom, updatedUI, setUpdatedUI,
    dateFilterKey, setDateFilterKey,
    detailTransaction, setDetailTransaction,
    editMerchant, setEditMerchant,
    editDescription, setEditDescription,
    editCategory, setEditCategory,
    detailLoading,
    pageSize, setPageSize,
    fetchTransactions, handleDelete, openDetailModal, handleDetailSave,
    toggleSort, sortIndicator,
  };
}
