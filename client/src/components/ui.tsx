import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/**
 * Small shared building blocks.
 *
 * Why bother instead of writing Tailwind classes inline everywhere: consistency
 * and change cost. When the bank's button style changes, it changes HERE once —
 * not in fourteen files. Same reasoning as keeping routes thin on the backend:
 * one concern, one home.
 */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 ${className}`}>
      {children}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const styles = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 focus-visible:outline-brand-600',
    secondary: 'bg-white text-ink ring-1 ring-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant];

  return (
    <button
      // `disabled` while loading stops double-submits — the exact race that
      // would create two transfers from one impatient double-click.
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Field({ label, error, hint, id, ...rest }: FieldProps) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1.5">
      {/* htmlFor ties the label to the input: clicking the label focuses the
          field, and screen readers announce them together. */}
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
        }`}
        {...rest}
      />
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const styles = {
    error: 'bg-red-50 text-red-800 ring-red-200',
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    info: 'bg-brand-50 text-brand-700 ring-brand-100',
  }[tone];
  return <div className={`rounded-xl px-4 py-3 text-sm ring-1 ${styles}`}>{children}</div>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

/** Format kobo-free naira amounts consistently across every screen. */
export function naira(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
