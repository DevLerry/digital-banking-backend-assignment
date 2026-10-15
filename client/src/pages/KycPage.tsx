import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { KycStatus } from '../api/types';
import { Alert, Button, Card, Field, Spinner } from '../components/ui';

export function KycPage() {
  const navigate = useNavigate();

  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [method, setMethod] = useState<'BVN' | 'NIN'>('BVN');
  const [idNumber, setIdNumber] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .kycStatus()
      .then((r) => setStatus(r.kyc))
      .catch(() => setStatus(null))
      .finally(() => setLoadingStatus(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (method === 'BVN') await api.submitBvn({ bvn: idNumber, dob });
      else await api.submitNin({ nin: idNumber, dob });

      const refreshed = await api.kycStatus();
      setStatus(refreshed.kyc);
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = err.fieldErrors;
        if (Object.keys(fields).length) setFieldErrors(fields);
        else setError(err.message);
      } else setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingStatus) return <Spinner label="Checking your verification status" />;

  if (status?.verified) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Card>
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xl">
              ✓
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-bold">You are verified</h2>
              <p className="text-sm text-slate-600">
                Verified with your <strong>{status.type}</strong>
                {status.kycId && <> ending in {status.kycId.slice(-4)}</>}.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Verify your identity</h1>
        <p className="mt-1 text-sm text-slate-500">
          Required before we can open your account. Choose <strong>either</strong> BVN or NIN —
          you can only verify once.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {error && <Alert>{error}</Alert>}

          {/* Radio-style toggle between the two verification methods */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            {(['BVN', 'NIN'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMethod(m); setIdNumber(''); setFieldErrors({}); }}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  method === m ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <Field
            label={`${method} number`}
            name={method.toLowerCase()}
            inputMode="numeric"
            maxLength={11}
            placeholder="11 digits"
            hint="Use a test number only — never a real BVN or NIN"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ''))}
            error={fieldErrors.bvn ?? fieldErrors.nin}
            required
          />

          <Field
            label="Date of birth"
            name="dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            error={fieldErrors.dob}
            required
          />

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? `Verifying your ${method}` : `Verify ${method}`}
          </Button>
        </form>
      </Card>

      <p className="text-center text-xs text-slate-500">
        Your name must match the name on the {method} record, or verification will be declined.
      </p>
    </div>
  );
}
