/**
 * Money is stored internally in KOBO (integers), never naira floats.
 *
 * Why: 0.1 + 0.2 === 0.30000000000000004 in IEEE-754 floating point. In a bank
 * that rounding drift is a reconciliation failure. Integers cannot drift, so we
 * store the smallest indivisible unit and convert only at the API boundary.
 */
export const KOBO_PER_NAIRA = 100;

export function nairaToKobo(naira: number): number {
  return Math.round(naira * KOBO_PER_NAIRA);
}

export function koboToNaira(kobo: number): number {
  return kobo / KOBO_PER_NAIRA;
}

export function formatNaira(kobo: number): string {
  return `₦${koboToNaira(kobo).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
