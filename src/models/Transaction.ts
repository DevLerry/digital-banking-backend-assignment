import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const DIRECTIONS = ['DEBIT', 'CREDIT'] as const;
export const SCOPES = ['INTRA', 'INTER'] as const;
export const STATUSES = ['PENDING', 'SUCCESS', 'FAILED'] as const;

const transactionSchema = new Schema(
  {
    /**
     * REQUIREMENT 4: the privacy key. Every history query filters on this, so a
     * customer physically cannot retrieve a row that isn't theirs.
     */
    customerId: { type: Types.ObjectId, ref: 'Customer', required: true, index: true },
    // NOT unique on its own: one transfer writes a DEBIT row for the sender
    // and a CREDIT row for the recipient, both sharing this reference.
    reference: { type: String, required: true, trim: true, index: true },

    direction: { type: String, enum: DIRECTIONS, required: true },
    scope: { type: String, enum: SCOPES, required: true },
    status: { type: String, enum: STATUSES, default: 'PENDING' },

    accountNumber: { type: String, required: true },        // our customer's account
    counterpartyAccount: { type: String, required: true },  // the other side
    counterpartyName: { type: String, default: null },

    amountKobo: { type: Number, required: true, min: 1 },   // integers only
    narration: { type: String, default: null },
    failureReason: { type: String, default: null },
  },
  { timestamps: true },
);

// One customer may hold only ONE leg of a given transfer. This is what makes
// re-posting the same leg twice impossible (idempotency at the DB layer).
transactionSchema.index({ reference: 1, customerId: 1, direction: 1 }, { unique: true });

// Compound index: history is always "this customer's rows, newest first".
transactionSchema.index({ customerId: 1, createdAt: -1 });

export type Transaction = InferSchemaType<typeof transactionSchema>;
export type TransactionDoc = HydratedDocument<Transaction>;
export const TransactionModel = model('Transaction', transactionSchema);
