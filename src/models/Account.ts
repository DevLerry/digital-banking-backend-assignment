import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { KYC_TYPES } from './KycRecord.js';

const accountSchema = new Schema(
  {
    /**
     * REQUIREMENT 2: "Each customer must have a maximum of one (1) account."
     *
     * Enforced by a UNIQUE INDEX, not an `if (await Account.findOne(...))`
     * check. An `if` has a race: two concurrent requests both read "none
     * exists", both pass, both insert. The database index cannot be raced —
     * the second insert is rejected with duplicate-key error 11000.
     */
    customerId: { type: Types.ObjectId, ref: 'Customer', required: true, unique: true },
    accountNumber: { type: String, required: true, unique: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    kycType: { type: String, enum: KYC_TYPES, required: true },
    kycId: { type: String, required: true },
    // NOTE: deliberately NO `balance` field. NIBSS is the source of truth for
    // money; caching it here would create two numbers that can disagree.
  },
  { timestamps: true },
);

export type Account = InferSchemaType<typeof accountSchema>;
export type AccountDoc = HydratedDocument<Account>;
export const AccountModel = model('Account', accountSchema);
