import { CustomerModel } from '../../models/Customer.js';
import { KycRecordModel, type KycType } from '../../models/KycRecord.js';
import { nibss } from '../../nibss/client.js';
import { NibssError } from '../../nibss/errors.js';
import { AppError } from '../../utils/AppError.js';
import type { SubmitBvnInput, SubmitNinInput } from './kyc.schemas.js';

/**
 * REQUIREMENT 1: onboarding must succeed and be VERIFIED before any account
 * can be created. This service owns that verification, and `assertVerifiedKyc`
 * below is the gate the account module will stand behind.
 */

/** Names must match what the customer registered with. Case/spacing tolerant. */
function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function loadCustomerOrThrow(customerId: string) {
  const customer = await CustomerModel.findById(customerId);
  if (!customer) throw AppError.notFound('Customer not found');
  return customer;
}

async function assertNoExistingKyc(customerId: string) {
  const existing = await KycRecordModel.findOne({ customerId }).lean();
  if (existing) {
    throw AppError.conflict(
      `You have already completed ${existing.type} verification. Only one KYC record is allowed per customer.`,
    );
  }
}

/**
 * Insert the record upstream, tolerating "already exists".
 *
 * A BVN may already live in the NIBSS database — a colleague created it while
 * testing, or the customer retried after a network blip. That is not an error
 * worth failing on; what matters is that the identity VALIDATES and that it
 * belongs to this customer, which we check immediately afterwards.
 */
async function insertTolerantly(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof NibssError && (err.status === 400 || err.status === 409)) {
      return; // already present upstream — fine, we validate next
    }
    throw err;
  }
}

async function completeKyc(params: {
  customerId: string;
  type: KycType;
  kycId: string;
  dob: string;
  insert: () => Promise<void>;
  validate: () => Promise<{ firstName: string; lastName: string; dob: string }>;
}) {
  const customer = await loadCustomerOrThrow(params.customerId);
  await assertNoExistingKyc(params.customerId);

  await insertTolerantly(params.insert);

  const identity = await params.validate();

  /**
   * IDENTITY BINDING — the security heart of this module.
   *
   * Without it, anyone could type a stranger's BVN and have OUR bank open an
   * account in that stranger's name. We require the upstream identity to match
   * the name this customer registered with before we mark them verified.
   */
  if (
    !namesMatch(identity.firstName, customer.firstName) ||
    !namesMatch(identity.lastName, customer.lastName)
  ) {
    throw AppError.forbidden(
      `The ${params.type} on record belongs to a different name than your profile. Verification denied.`,
    );
  }

  const record = await KycRecordModel.create({
    customerId: customer._id,
    type: params.type,
    kycId: params.kycId,
    firstName: identity.firstName,
    lastName: identity.lastName,
    dob: identity.dob || params.dob,
    verified: true,
    verifiedAt: new Date(),
  });

  return record.toJSON();
}

export function submitBvn(customerId: string, input: SubmitBvnInput) {
  return completeKyc({
    customerId,
    type: 'BVN',
    kycId: input.bvn,
    dob: input.dob,
    insert: async () => {
      const customer = await loadCustomerOrThrow(customerId);
      await nibss.insertBvn({
        bvn: input.bvn,
        firstName: customer.firstName,
        lastName: customer.lastName,
        dob: input.dob,
        phone: customer.phone,
      });
    },
    validate: () => nibss.validateBvn(input.bvn),
  });
}

export function submitNin(customerId: string, input: SubmitNinInput) {
  return completeKyc({
    customerId,
    type: 'NIN',
    kycId: input.nin,
    dob: input.dob,
    insert: async () => {
      const customer = await loadCustomerOrThrow(customerId);
      await nibss.insertNin({
        nin: input.nin,
        firstName: customer.firstName,
        lastName: customer.lastName,
        dob: input.dob,
      });
    },
    validate: () => nibss.validateNin(input.nin),
  });
}

export async function getKycStatus(customerId: string) {
  const record = await KycRecordModel.findOne({ customerId }).lean();
  if (!record) {
    return { verified: false, type: null, message: 'No KYC submitted yet' };
  }
  return {
    verified: record.verified,
    type: record.type,
    kycId: record.kycId,
    verifiedAt: record.verifiedAt,
  };
}

/**
 * THE GATE. Account creation calls this and refuses to proceed without it.
 * Exported here so the rule lives in exactly one place.
 */
export async function assertVerifiedKyc(customerId: string) {
  const record = await KycRecordModel.findOne({ customerId, verified: true });
  if (!record) {
    throw AppError.forbidden(
      'You must complete BVN or NIN verification before creating an account',
    );
  }
  return record;
}
