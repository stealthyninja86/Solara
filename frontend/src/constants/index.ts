import type { PaymentMode, TransactionCategory, TransactionType } from "../types";

export const TRANSACTION_TYPES: TransactionType[] = ["DEBIT", "CREDIT"];

export const BANK_FORMATS = ["HDFC", "ICICI", "AXIS", "SBI", "KOTAK"];

export const PAYMENT_MODES: PaymentMode[] = [
  "CASH", "CREDIT_CARD", "DEBIT_CARD", "UPI",
  "NEFT", "RTGS", "IMPS", "CHEQUE", "ONLINE", "OTHER",
];

export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

export const SUGGESTED_CATEGORIES: TransactionCategory[] = [
  "FOOD_DINING", "TRANSPORT", "FUEL", "SHOPPING", "CLOTHING", "ELECTRONICS",
  "ENTERTAINMENT", "BILLS_UTILITIES", "HEALTHCARE", "GROCERIES", "PET", "RENT",
  "LOAN_EMI", "SALARY", "INVESTMENT", "EDUCATION", "TRAVEL",
];

export const CATEGORY_EMOJIS: Record<string, string> = {
  "FOOD_DINING": "\uD83C\uDF54",
  "TRANSPORT": "\uD83D\uDE97",
  "FUEL": "\u26FD\uFE0F",
  "SHOPPING": "\uD83D\uDECD\uFE0F",
  "CLOTHING": "\uD83D\uDC55",
  "ELECTRONICS": "\uD83D\uDCBB",
  "ENTERTAINMENT": "\uD83C\uDFAC",
  "BILLS_UTILITIES": "\uD83D\uDCA1",
  "HEALTHCARE": "\uD83D\uDC8A",
  "GROCERIES": "\uD83D\uDED2",
  "PET": "\uD83D\uDC3E",
  "RENT": "\uD83C\uDFE0",
  "LOAN_EMI": "\uD83C\uDFE6",
  "SALARY": "\uD83D\uDCB0",
  "INVESTMENT": "\uD83D\uDCC8",
  "EDUCATION": "\uD83D\uDCDA",
  "TRAVEL": "\u2708\uFE0F",
  "OTHER": "\uD83D\uDCCB",
  "UNCATEGORIZED": "\u26A0\uFE0F",
};

export const CATEGORY_LABELS: Record<string, string> = {
  "FOOD_DINING": "Food & Dining",
  "TRANSPORT": "Transport",
  "FUEL": "Fuel",
  "SHOPPING": "Shopping",
  "CLOTHING": "Clothing",
  "ELECTRONICS": "Electronics",
  "ENTERTAINMENT": "Entertainment",
  "BILLS_UTILITIES": "Bills & Utilities",
  "HEALTHCARE": "Healthcare",
  "GROCERIES": "Groceries",
  "PET": "Pets",
  "RENT": "Rent",
  "LOAN_EMI": "Loan EMI",
  "SALARY": "Salary",
  "INVESTMENT": "Investments",
  "EDUCATION": "Education",
  "TRAVEL": "Travel",
  "OTHER": "Other",
  "UNCATEGORIZED": "Uncategorized",
  "BUDGET": "Budget",
};

export const CATEGORY_COLORS = [
  "var(--color-cat-1)", "var(--color-cat-2)", "var(--color-cat-3)", "var(--color-cat-4)",
  "var(--color-cat-5)", "var(--color-cat-6)", "var(--color-cat-7)", "var(--color-cat-8)",
];
