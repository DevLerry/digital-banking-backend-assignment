/**
 * NORMALISED shapes — what OUR application sees.
 *
 * These deliberately do NOT mirror NibssByPhoenix's raw responses. Their API is
 * internally inconsistent (BVN endpoints wrap results in `data`, NIN endpoints
 * wrap them in `response`, account creation wraps in `account`). The client
 * flattens all of that so the rest of our codebase sees one consistent world.
 */

export interface KycIdentity {
  firstName: string;
  lastName: string;
  /** ISO date string, e.g. '1995-06-15' */
  dob: string;
  phone?: string;
}

export interface BankAccount {
  accountNumber: string;
  accountName: string;
  bankCode?: string;
  /** In NAIRA — this is how NIBSS reports it. We convert to kobo internally. */
  balance?: number;
}

export interface TransferResult {
  reference: string;
  senderAccount: string;
  receiverAccount: string;
  /** In NAIRA. */
  amount: number;
  status: string;
  createdAt?: string;
}

// ---- Raw upstream shapes (used only inside client.ts) ----

export interface RawWrapped<T> {
  success?: boolean;
  message?: string;
  data?: T;
  response?: T;
  account?: T;
}
