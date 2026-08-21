import type { PaymentMode, TransactionCategory, TransactionType } from "../types";

export const TRANSACTION_TYPES: TransactionType[] = ["DEBIT", "CREDIT"];



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

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "FOOD_DINING": "Eating out at restaurants and cafes — e.g., dinner at a cafe",
  "GROCERIES": "Groceries for cooking at home — e.g., weekly vegetables",
  "TRANSPORT": "Daily commute and local travel — e.g., metro ride to work",
  "FUEL": "Fuel for your vehicle — e.g., petrol refill",
  "SHOPPING": "Everyday shopping — e.g., household items from a store",
  "CLOTHING": "Clothes and apparel — e.g., a shirt from a clothing store",
  "ELECTRONICS": "Gadgets and electronics — e.g., phone accessories",
  "ENTERTAINMENT": "Movies, shows and leisure — e.g., a movie night",
  "BILLS_UTILITIES": "Household bills and utilities — e.g., electricity bill",
  "HEALTHCARE": "Medical and health expenses — e.g., pharmacy purchase",
  "PET": "Pet care expenses — e.g., pet food",
  "RENT": "Housing rent — e.g., monthly house rent",
  "LOAN_EMI": "Loan and EMI payments — e.g., monthly loan payment",
  "INVESTMENT": "Money set aside to grow — e.g., monthly SIP",
  "SALARY": "Income from salary — e.g., monthly salary credit",
  "EDUCATION": "Learning and education fees — e.g., course fee",
  "TRAVEL": "Trips and travel — e.g., train ticket",
  "OTHER": "Other spending not listed above",
  "UNCATEGORIZED": "Not yet categorized",
  "BUDGET": "Budget placeholder",
};

export const CATEGORY_COLORS = [
  "var(--color-cat-1)", "var(--color-cat-2)", "var(--color-cat-3)", "var(--color-cat-4)",
  "var(--color-cat-5)", "var(--color-cat-6)", "var(--color-cat-7)", "var(--color-cat-8)",
];
