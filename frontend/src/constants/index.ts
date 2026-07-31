import type { PaymentMode, TransactionCategory, TransactionType } from "../types";

export const TRANSACTION_TYPES: TransactionType[] = ["DEBIT", "CREDIT"];

export const BANK_FORMATS = ["HDFC", "ICICI", "AXIS", "SBI", "KOTAK"];

export const PAYMENT_MODES: PaymentMode[] = [
  "CASH", "CREDIT_CARD", "DEBIT_CARD", "UPI",
  "NEFT", "RTGS", "IMPS", "CHEQUE", "ONLINE", "OTHER",
];

export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

export const SUGGESTED_CATEGORIES: TransactionCategory[] = [
  "FOOD_DINING", "TRANSPORT", "SHOPPING", "ENTERTAINMENT",
  "BILLS_UTILITIES", "HEALTHCARE", "GROCERIES", "RENT",
  "SALARY", "INVESTMENT", "EDUCATION", "TRAVEL",
];

export const CATEGORY_EMOJIS: Record<string, string> = {
  "FOOD_DINING": "\uD83C\uDF54",
  "TRANSPORT": "\uD83D\uDE97",
  "SHOPPING": "\uD83D\uDECD\uFE0F",
  "ENTERTAINMENT": "\uD83C\uDFAC",
  "BILLS_UTILITIES": "\uD83D\uDCA1",
  "HEALTHCARE": "\uD83D\uDC8A",
  "GROCERIES": "\uD83D\uDED2",
  "RENT": "\uD83C\uDFE0",
  "SALARY": "\uD83D\uDCB0",
  "INVESTMENT": "\uD83D\uDCC8",
  "EDUCATION": "\uD83D\uDCDA",
  "TRAVEL": "\u2708\uFE0F",
  "OTHER": "\uD83D\uDCCB",
};

export const CATEGORY_COLORS = [
  "#f97316", "#22c55e", "#3b82f6", "#a855f7",
  "#ef4444", "#eab308", "#06b6d4", "#ec4899",
];
