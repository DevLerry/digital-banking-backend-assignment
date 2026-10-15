import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Pagination, Transaction } from '../api/types';
import { Alert, Button, Card, Spinner, naira } from '../components/ui';

type Filter = 'ALL' | 'DEBIT' | 'CREDIT';

export function TransactionsPage() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.transactions({
        page,
        limit: 20,
        direction: filter === 'ALL' ? undefined : filter,
      });
      setRows(res.transactions);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  // Re-runs whenever `load` changes — i.e. whenever page or filter changes.
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>

        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(['ALL', 'DEBIT', 'CREDIT'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'DEBIT' ? 'Sent' : 'Received'}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <Spinner label="Loading transactions" />
      ) : rows.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">
            No transactions yet. Once you send or receive money it will appear here.
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {rows.map((t) => {
              const isCredit = t.direction === 'CREDIT';
              return (
                <li key={`${t.reference}-${t.direction}`} className="flex items-center gap-4 p-4">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                      isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isCredit ? '↓' : '↑'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {t.counterpartyName ?? t.counterpartyAccount}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {t.narration ? `${t.narration} · ` : ''}
                      {new Date(t.createdAt).toLocaleString('en-NG', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <p className="truncate font-mono text-[11px] text-slate-400">{t.reference}</p>
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {isCredit ? '+' : '−'}{naira(t.amount)}
                    </p>
                    <span
                      className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        t.status === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-700'
                          : t.status === 'FAILED'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </span>
          <Button
            variant="secondary"
            disabled={!pagination.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
