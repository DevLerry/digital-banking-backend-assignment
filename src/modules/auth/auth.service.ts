import bcrypt from 'bcryptjs';
import { CustomerModel } from '../../models/Customer.js';
import { AppError } from '../../utils/AppError.js';
import { signAccessToken } from '../../utils/jwt.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

/**
 * How expensive it is to compute one hash: 2^12 = 4096 rounds.
 *
 * This is deliberately SLOW (~250ms). Speed is the enemy here — a fast hash
 * lets an attacker who steals your database try billions of guesses per second.
 * At cost 12, the same hardware manages a few thousand. Raise it as computers
 * get faster; 12 is the sensible floor today.
 */
const BCRYPT_COST = 12;

export async function registerCustomer(input: RegisterInput) {
  const email = input.email.toLowerCase().trim();

  const existing = await CustomerModel.findOne({ email }).lean();
  if (existing) {
    throw AppError.conflict('An account with that email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  const customer = await CustomerModel.create({
    email,
    passwordHash,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone.trim(),
  });

  return {
    customer: customer.toJSON(),
    token: signAccessToken({ sub: customer.id as string, email: customer.email }),
  };
}

export async function loginCustomer(input: LoginInput) {
  const email = input.email.toLowerCase().trim();
  const customer = await CustomerModel.findOne({ email });

  /**
   * NOTE: identical error whether the email is unknown OR the password is wrong.
   *
   * If we said "no such user" vs "wrong password", an attacker could harvest
   * which emails are registered with your bank — a real privacy leak, and the
   * first step of a targeted credential-stuffing attack. Same message, always.
   */
  const invalid = AppError.unauthorized('Invalid email or password');
  if (!customer) throw invalid;

  const matches = await bcrypt.compare(input.password, customer.passwordHash);
  if (!matches) throw invalid;

  return {
    customer: customer.toJSON(),
    token: signAccessToken({ sub: customer.id as string, email: customer.email }),
  };
}

export async function getCustomerById(id: string) {
  const customer = await CustomerModel.findById(id);
  if (!customer) throw AppError.notFound('Customer not found');
  return customer.toJSON();
}
