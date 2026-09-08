import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const customerSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

/**
 * Never leak the password hash. `toJSON` runs whenever the document is
 * serialised (including implicitly by res.json), so this is a safety net that
 * works even if a route forgets to pick fields explicitly.
 */
customerSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export type Customer = InferSchemaType<typeof customerSchema>;
export type CustomerDoc = HydratedDocument<Customer>;
export const CustomerModel = model('Customer', customerSchema);
