import { AccountModel } from '../../models/Account.js';
import { nibss } from '../../nibss/client.js';
import { AppError } from '../../utils/AppError.js';
import { assertVerifiedKyc } from '../kyc/kyc.service.js';

/**
 * REQUIREMENT 2: create the customer's bank account.
 *
 * Three rules are enforced here:
 *   1. KYC must be verified first          (Requirement 1's gate)
 *   2. Maximum ONE account per customer    (Requirement 2)
 *   3. Account is pre-funded with N15,000  (confirmed, done upstream by NIBSS)
 */

export async function createAccountForCustomer(customerId: string) {
  // RULE 1 — the gate. Throws 403 if this customer has not verified BVN/NIN.
  const kyc = await assertVerifiedKyc(customerId);

  /**
   * RULE 2, first line of defence: a friendly, specific error.
   *
   * This check alone is NOT sufficient — two simultaneous requests could both
   * pass it before either writes. The unique index on Account.customerId is
   * what actually guarantees the rule (see the catch block below). This check
   * exists purely to give a better message in the normal case.
   */
  const existing = await AccountModel.findOne({ customerId }).lean();
  if (existing) {
    throw AppError.conflict(
      `You already have an account (${existing.accountNumber}). Each customer may hold only one account.`,
    );
  }

  // Ask the rails to open the account. NIBSS funds it with N15,000 on creation.
  const upstream = await nibss.createAccount({
    kycType: kyc.type,
    kycID: kyc.kycId,
    dob: kyc.dob,
  });

  if (!upstream.accountNumber) {
    throw new AppError('Bank rails did not return an account number', 502, 'UPSTREAM_ERROR');
  }

  try {
    const account = await AccountModel.create({
      customerId,
      accountNumber: upstream.accountNumber,
      accountName: upstream.accountName ?? `${kyc.firstName} ${kyc.lastName}`,
      kycType: kyc.type,
      kycId: kyc.kycId,
    });

    return {
      account: account.toJSON(),
      balance: upstream.balance ?? null,
    };
  } catch (err) {
    /**
     * RULE 2, the real guarantee. Error 11000 is MongoDB rejecting a write that
     * would break a unique index — here, a second account for this customer.
     * This is the branch that catches the race the `findOne` above cannot.
     */
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw AppError.conflict('You already have an account. Only one account per customer.');
    }
    throw err;
  }
}

/**
 * The customer's own account, with a LIVE balance.
 *
 * We never store the balance ourselves — NIBSS is the source of truth for
 * money. Two copies of a balance is two numbers that can disagree, and a
 * disagreeing balance in a bank is a very bad day.
 */
export async function getMyAccount(customerId: string) {
  const account = await AccountModel.findOne({ customerId });
  if (!account) {
    throw AppError.notFound('You do not have an account yet. Create one first.');
  }

  const live = await nibss.balance(account.accountNumber);

  return {
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    kycType: account.kycType,
    balance: live.balance ?? null,
    currency: 'NGN',
    createdAt: account.get('createdAt'),
  };
}
