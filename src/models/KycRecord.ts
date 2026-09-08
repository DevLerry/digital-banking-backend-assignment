import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const KYC_TYPES = ['BVN', 'NIN'] as const;
export type KycType = (typeof KYC_TYPES)[number];

const kycRecordSchema = new Schema(
  {
    // unique => one customer can hold at most one KYC record.
    customerId: { type: Types.ObjectId, ref: 'Customer', required: true, unique: true },
    type: { type: String, enum: KYC_TYPES, required: true },
    // unique => two different customers cannot claim the same BVN/NIN.
    kycId: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dob: { type: String, required: true }, // ISO date string 'YYYY-MM-DD'
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type KycRecord = InferSchemaType<typeof kycRecordSchema>;
export type KycRecordDoc = HydratedDocument<KycRecord>;
export const KycRecordModel = model('KycRecord', kycRecordSchema);
