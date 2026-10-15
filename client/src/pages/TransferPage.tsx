import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import type { NameEnquiry, TransferResult } from '../api/types';
import { Alert, Button, Card, Field, naira } from '../components/ui';

/**
 * The transfer flow deliberately has THREE steps:
 *
 *   1. enter a destination account  →  2. confirm the resolved NAME  →  3. send
 *
 * Step 2 is not decoration. Showing the recipient's real name before money
 * moves is the single most effective anti-fraud control in retail banking —
 * it is how a customer notices they typed one digit wrong before the money is
 * gone rather than after.
 */
type Step = 'enter' | 'confirm' | 'done';

export function TransferPage() {
  const [step, setStep] = useState<Step>('enter');

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');

  const [recipient, setRecipient] = useState<NameEnquiry | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep('enter');
    setTo(''); setAmount(''); setNarration('');
    setRecipient(null); setResult(null);
    setError(null); setFieldErrors({});
  }

  /** STEP 1 → 2: resolve the account number to a human name. */
  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setError(null); setFieldErrors({}); setBusy(true);
    try {
      const res = await api.nameEnquiry(to);
      setRecipient(res);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not find that account');
    } finally {
      setBusy(false);
    }
  }

  /** STEP 2 → 3: actually move the money. */
  async function handleSend() {
    setError(null); setBusy(true);
    try {
      const res = await api.transfer({
        to,
        amount: Number(amount),
        narration: narration || undefined,
      });
      setResult(res.transfer);
      setStep('done');
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = err.fieldErrors;
        if (Object.keys(fields).length) { setFieldErrors(fields); setStep('enter'); }
        else setError(err.message);
      } else setError('Transfer failed');
    } finally {
      setBusy(false);
    }
  }

  // ---------- STEP 3: receipt ----------
  if (step === 'done' && result) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <Card>
          <div className="text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
              ✓
            </span>
            <h2 className="text-lg font-bold">Transfer successful</h2>
            <p className="mt-1 text-3xl font-bold tracking-tight">{naira(result.amount)}</p>
            <p className="mt-1 text-sm text-slate-500">sent to {result.recipientName}</p>
          </div>

          <dl className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-sm">
            {[
              ['Reference', result.reference],
              ['To account', result.to],
              ['Bank', result.bankName],
              ['Type', result.scope === 'INTRA' ? 'Within OUR Bank' : 'Other bank'],
              ['Status', result.status],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium break-all">{v}</dd>
              </div>
            ))}
          </dl>

          <Button onClick={reset} className="mt-6 w-full">Make another transfer</Button>
        </Card>
      </div>
    );
  }

  // ---------- STEP 2: confirm the recipient ----------
  if (step === 'confirm' && recipient) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Confirm recipient</h1>

        <Card>
          {error && <div className="mb-4"><Alert>{error}</Alert></div>}

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sending to</p>
            <p className="mt-1 text-lg font-bold">{recipient.accountName}</p>
            <p className="font-mono text-sm text-slate-600">{recipient.accountNumber}</p>
            <p className="mt-1 text-xs text-slate-500">
              {recipient.bankName} · {recipient.scope === 'INTRA' ? 'Same bank' : 'Other bank'}
            </p>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-sm text-slate-500">Amount</span>
            <span className="text-2xl font-bold">{naira(Number(amount))}</span>
          </div>
          {narration && <p className="mt-1 text-right text-xs text-slate-500">{narration}</p>}

          <p className="mt-4 text-center text-xs text-slate-500">
            Check this name carefully. Transfers cannot be reversed.
          </p>

          <div className="mt-5 flex gap-3">
            <Button variant="secondary" onClick={() => setStep('enter')} className="flex-1">
              Back
            </Button>
            <Button onClick={handleSend} loading={busy} className="flex-1">
              {busy ? 'Sending' : 'Confirm & send'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ---------- STEP 1: enter the details ----------
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Send money</h1>

      <Card>
        <form onSubmit={handleLookup} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}

          <Field
            label="Recipient account number"
            name="to"
            inputMode="numeric"
            maxLength={10}
            placeholder="10 digits"
            value={to}
            onChange={(e) => setTo(e.target.value.replace(/\D/g, ''))}
            error={fieldErrors.to}
            required
          />

          <Field
            label="Amount (₦)"
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            error={fieldErrors.amount}
            required
          />

          <Field
            label="Narration (optional)"
            name="narration"
            maxLength={100}
            placeholder="What is this for?"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            error={fieldErrors.narration}
          />

          <Button
            type="submit"
            loading={busy}
            disabled={to.length !== 10 || !amount}
            className="w-full"
          >
            {busy ? 'Looking up account' : 'Continue'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
