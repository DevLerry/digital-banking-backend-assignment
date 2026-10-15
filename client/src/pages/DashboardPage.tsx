import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Account, TransactionSummary } from '../api/types';
import { Alert, Button, Card, Spinner, naira } from '../components/ui';

export function DashboardPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the customer has no account AND no verified KYC. */
  const [needsKyc, setNeedsKyc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAccount();
      setAccount(res.account);
      const s = await api.summary();
      setSummary(s.summary);
    } catch (err) {
      // 404 here is normal — it just means "no account yet", not a failure.
      if (err instanceof ApiError && err.status === 404) setAccount(null);
      else setError(err instanceof ApiError ? err.message : 'Could not load your account');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    setNeedsKyc(false);
    try {
      await api.createAccount();
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        // 403 from the backend means the KYC gate rejected us.
        if (err.status === 403) setNeedsKyc(true);
        setError(err.message);
      } else setError('Could not create your account');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <Spinner label="Loading your account" />;

  if (!account) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Card>
          <h1 className="text-xl font-bold">Open your account</h1>
          <p className="mt-2 text-sm text-slate-600">
            You do not have an account yet. Once opened it will be pre-funded with{' '}
            <strong>₦15,000</strong> so you can start making transfers.
          </p>

          {error && <div className="mt-4"><Alert>{error}</Alert></div>}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {needsKyc ? (
              <Link to="/kyc" className="w-full">
                <Button className="w-full">Verify your identity first</Button>
              </Link>
            ) : (
              <Button onClick={handleCreate} loading={creating} className="w-full">
                {creating ? 'Opening your account' : 'Open my account'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      {/* Balance card */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white shadow-sm">
        <p className="text-sm text-brand-100">Available balance</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">{naira(account.balance)}</p>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-brand-100">Account number</p>
            <p className="font-mono text-lg tracking-wider">{account.accountNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-brand-100">Account name</p>
            <p className="font-semibold">{account.accountName}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/transfer"><Button>Send money</Button></Link>
        <Link to="/transactions"><Button variant="secondary">View transactions</Button></Link>
        <Button variant="secondary" onClick={() => void load()}>Refresh balance</Button>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="text-sm text-slate-500">Total sent</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{naira(summary.totalSentNaira)}</p>
            <p className="mt-1 text-xs text-slate-500">{summary.totalDebits} transaction(s)</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Total received</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{naira(summary.totalReceivedNaira)}</p>
            <p className="mt-1 text-xs text-slate-500">{summary.totalCredits} transaction(s)</p>
          </Card>
        </div>
      )}
    </div>
  );
}
