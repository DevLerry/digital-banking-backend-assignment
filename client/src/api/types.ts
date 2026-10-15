/**
 * The shapes our backend returns.
 *
 * These mirror the API contract, not the database. If the backend changes a
 * field name, this file changes and TypeScript immediately shows every screen
 * that needs updating — instead of a blank space appearing in the UI at runtime.
 */

export interface Customer {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: string;
}

export interface AuthResponse {
  success: true;
  message: string;
  customer: Customer;
  token: string;
}

export interface KycStatus {
  verified: boolean;
  type: 'BVN' | 'NIN' | null;
  kycId?: string;
  verifiedAt?: string;
  message?: string;
}

export interface Account {
  accountNumber: string;
  accountName: string;
  kycType: 'BVN' | 'NIN';
  balance: number | null;
  currency: string;
  createdAt: string;
}

export interface NameEnquiry {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  scope: 'INTRA' | 'INTER';
}

export interface TransferResult {
  reference: string;
  status: string;
  amount: number;
  scope: 'INTRA' | 'INTER';
  from: string;
  to: string;
  recipientName: string;
  bankName: string;
}

export interface Transaction {
  reference: string;
  direction: 'DEBIT' | 'CREDIT';
  scope: 'INTRA' | 'INTER';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  amount: number;
  currency: string;
  accountNumber: string;
  counterpartyAccount: string;
  counterpartyName: string | null;
  narration: string | null;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface TransactionSummary {
  totalDebits: number;
  totalCredits: number;
  totalSentNaira: number;
  totalReceivedNaira: number;
}

/** The error envelope every backend failure uses. */
export interface ApiErrorBody {
  success: false;
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
}
