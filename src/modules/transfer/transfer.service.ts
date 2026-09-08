import { env } from '../../config/env.js';
import { AccountModel } from '../../models/Account.js';
import { TransactionModel } from '../../models/Transaction.js';
import { nibss } from '../../nibss/client.js';
import { AppError } from '../../utils/AppError.js';
import { nairaToKobo } from '../../utils/money.js';
import type { TransferInput } from './transfer.schemas.js';

/**
 * NIBSS returns "status" as a free-form string. Our ledger only permits three
 * values. This narrows an untrusted string into our own domain type, defaulting
 * to PENDING for anything unrecognised — never silently storing junk.
 */
function toLedgerStatus(raw: string | undefined): 'PENDING' | 'SUCCESS' | 'FAILED' {
  switch ((raw ?? '').toUpperCase()) {
    case 'SUCCESS':
    case 'SUCCESSFUL':
    case 'COMPLETED':
      return 'SUCCESS';
    case 'FAILED':
    case 'FAILURE':
    case 'DECLINED':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

/** REQUIREMENT 3: name enquiry, funds transfer (intra + inter), balance. */

/**
 * Name enquiry — confirm who you are about to pay.
 *
 * This is the single most effective anti-fraud control in retail banking:
 * showing the recipient's real name before money moves. It is why we require
 * it conceptually before a transfer, and why banks display "Is this the person
 * you meant to pay?" on every transfer screen.
 */
export async function nameEnquiry(accountNumber: string) {
  const result = await nibss.nameEnquiry(accountNumber);
  if (!result.accountName) throw AppError.notFound('Account not found on the banking network');

  const bankCode = result.bankCode ?? env.NIBSS_BANK_CODE;
  return {
    accountNumber: result.accountNumber ?? accountNumber,
    accountName: result.accountName,
    bankCode,
    bankName: bankCode === env.NIBSS_BANK_CODE ? env.BANK_NAME : 'Other Bank',
    scope: bankCode === env.NIBSS_BANK_CODE ? ('INTRA' as const) : ('INTER' as const),
  };
}

export async function transferFunds(customerId: string, input: TransferInput) {
  /**
   * OWNERSHIP — the single most important line in this file.
   *
   * The sender account is looked up BY THE AUTHENTICATED CUSTOMER ID, never
   * from the request. `req.customerId` came from a signed JWT, so it cannot be
   * forged. This is what makes it impossible for Grace to spend Mike's money:
   * there is simply no input she can supply that names his account as the
   * source. Requirement 4's data isolation starts here.
   */
  const senderAccount = await AccountModel.findOne({ customerId });
  if (!senderAccount) {
    throw AppError.notFound('You do not have an account yet. Create one first.');
  }

  if (senderAccount.accountNumber === input.to) {
    throw AppError.badRequest('You cannot transfer to your own account');
  }

  // Confirm the destination exists, and learn whether this is intra or inter bank.
  const recipient = await nameEnquiry(input.to);

  /**
   * Balance check. NIBSS is the authority on funds, so this is advisory — it
   * exists to give a clear error instead of a generic upstream failure. The
   * rails remain the final arbiter and will reject an overdraw regardless.
   */
  const live = await nibss.balance(senderAccount.accountNumber);
  const available = live.balance ?? 0;
  if (available < input.amount) {
    throw AppError.badRequest(
      `Insufficient funds. Available balance is N${available.toLocaleString()}, you tried to send N${input.amount.toLocaleString()}.`,
    );
  }

  // Move the money.
  const result = await nibss.transfer({
    from: senderAccount.accountNumber,
    to: input.to,
    amount: input.amount,
  });

  const reference = result.reference ?? `LOCAL-${Date.now()}`;
  const status = toLedgerStatus(result.status);
  const amountKobo = nairaToKobo(input.amount);

  /**
   * DOUBLE-ENTRY LEDGER.
   *
   * We write our own record of every movement rather than relying on NIBSS to
   * answer "what has this customer done?". Two reasons: their /transaction
   * endpoint is per-reference only, and Requirement 4 needs history scoped to a
   * customer — which only OUR database can express.
   *
   * The sender gets a DEBIT row. If the recipient also banks with us, they get
   * a matching CREDIT row. Same reference, two perspectives.
   */
  await TransactionModel.create({
    customerId,
    reference,
    direction: 'DEBIT',
    scope: recipient.scope,
    status,
    accountNumber: senderAccount.accountNumber,
    counterpartyAccount: input.to,
    counterpartyName: recipient.accountName,
    amountKobo,
    narration: input.narration ?? null,
  });

  if (recipient.scope === 'INTRA') {
    const recipientAccount = await AccountModel.findOne({ accountNumber: input.to });
    if (recipientAccount) {
      await TransactionModel.create({
        customerId: recipientAccount.customerId,
        reference,
        direction: 'CREDIT',
        scope: 'INTRA',
        status,
        accountNumber: recipientAccount.accountNumber,
        counterpartyAccount: senderAccount.accountNumber,
        counterpartyName: senderAccount.accountName,
        amountKobo,
        narration: input.narration ?? null,
      });
    }
  }

  return {
    reference,
    status,
    amount: input.amount,
    scope: recipient.scope,
    from: senderAccount.accountNumber,
    to: input.to,
    recipientName: recipient.accountName,
    bankName: recipient.bankName,
  };
}
