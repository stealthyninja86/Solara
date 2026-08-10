import { useCallback, useEffect, useState } from "react";
import type { CategorizedTransactionResponse, PageResponse } from "../types";
import { DEFAULT_USER_ID } from "../constants";
import { api } from "../utils/api";
import { getUserId } from "./useAuth";

export function useTransactions() {
  const [transactions, setTransactions] = useState<CategorizedTransactionResponse[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
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
  const [bulkImportFilter, setBulkImportFilter] = useState<boolean | null>(null);
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
      if (bulkImportFilter !== null) params.set("bulkImport", String(bulkImportFilter));
      const response = await api(
        `/api/v1/category/transaction?${params}`
      );
      if (response.ok) {
        const data: PageResponse = await response.json();
        setTransactions(data.content);
        setTotalPages(data.totalPages);
        setTotalElements(data.totalElements);
        setCurrentPage(data.number);
      }
    } catch {
      // silent
    } finally {
      setListLoading(false);
      setPullRefreshing(false);
    }
  }, [sortBy, sortDir, categoryFilter, paymentFilter, updatedAtFrom, dateFilterKey, pageSize, bulkImportFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (dateFrom) fetchTransactions(0);
  }, [fetchTransactions]);

  async function handleDelete(id: string): Promise<boolean> {
    try {
      const [transactionResult, insightResult] = await Promise.allSettled([
        api(`/api/v1/transactions/${id}?userId=${getUserId() ?? DEFAULT_USER_ID}`, { method: "DELETE" }),
        api(`/api/v1/category/transaction/${id}`, { method: "DELETE" }),
      ]);
      const transactionResponse =
        transactionResult.status === "fulfilled" ? transactionResult.value : null;
      void insightResult;
      const transactionSuccess = transactionResponse?.ok || transactionResponse?.status === 404;
      if (transactionSuccess) {
        await fetchTransactions(currentPage);
        return true;
      }
      return false;
    } catch {
      return false;
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
    transactions, currentPage, totalPages, totalElements, listLoading, pullRefreshing, setPullRefreshing,
    sortBy, sortDir,
    categoryFilter, setCategoryFilter,
    paymentFilter, setPaymentFilter,
    dateFrom, setDateFrom, dateTo, setDateTo, dateUI, setDateUI,
    updatedAtFrom, setUpdatedAtFrom, updatedUI, setUpdatedUI,
    dateFilterKey, setDateFilterKey,
    bulkImportFilter, setBulkImportFilter,
    pageSize, setPageSize,
    fetchTransactions, handleDelete,
    toggleSort, sortIndicator,
  };
}
