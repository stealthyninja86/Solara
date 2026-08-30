export type PaymentMode =
  | "CASH"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "UPI"
  | "NEFT"
  | "RTGS"
  | "IMPS"
  | "CHEQUE"
  | "ONLINE"
  | "OTHER";

export type TransactionType = "DEBIT" | "CREDIT";

export type TransactionCategory =
  | "FOOD_DINING" | "TRANSPORT" | "FUEL" | "SHOPPING" | "CLOTHING" | "ELECTRONICS"
  | "ENTERTAINMENT" | "BILLS_UTILITIES" | "HEALTHCARE" | "GROCERIES" | "PET" | "RENT"
  | "LOAN_EMI" | "SALARY" | "INVESTMENT" | "EDUCATION" | "TRAVEL" | "OTHER"
  | "UNCATEGORIZED";

export interface CreateTransactionRequest {
  userId: string;
  merchant: string;
  amount: number;
  paymentMode: PaymentMode;
  type: TransactionType;
  description?: string;
  transactionDate?: string;
}

export interface TransactionResponse {
  id: string;
  userId: string;
  amount: number;
  merchant: string;
  paymentMode: string;
  currency: string;
}

export interface CategorizedTransactionResponse {
  transactionId: string;
  userId: string;
  merchant: string;
  originalDescription: string | null;
  description: string | null;
  amount: number;
  currency: string;
  type: TransactionType | null;
  category: TransactionCategory | null;
  categorizationMethod: string | null;
  confidence: number | null;
  paymentMode: string | null;
  needsReview: boolean;
  isSubscription: boolean;
  bulkImport: boolean;
  createdAt: string;
  updatedAt: string;
  llmMessage: string | null;
}

export interface PageResponse {
  content: CategorizedTransactionResponse[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export type LlmProvider = string;

export interface ProviderInfo {
  value: string;
  label: string;
  description: string;
  tutorial: string[];
  requiresApiKey: boolean;
  keyPlaceholder: string | null;
  dashboardUrl: string | null;
}

export interface LlmProvidersResponse {
  providers: ProviderInfo[];
  defaultProvider: string;
}

export interface ModelInfo {
  name: string;
  description?: string | null;
  contextWindow?: number | null;
}

export interface LlmModelsResponse {
  provider: string;
  models: ModelInfo[];
}
