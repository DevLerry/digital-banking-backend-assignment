import { Types } from 'mongoose';
import { TransactionModel } from '../../models/Transaction.js';
import { koboToNaira } from '../../utils/money.js';
import type { HistoryQuery } from './history.schemas.js';

/**
 * REQUIREMENT 4: transaction history with strict data isolation.
 *
 * The isolation is structural, not a permission check bolted on afterwards.
 * `customerId` is baked into the filter as the FIRST key, and it comes from the
 * verified JWT. There is no code path through this function that can return a
 * row belonging to anyone else — not through a query parameter, not through a
 * malformed request, not by accident.
 */
export async function getTransactionHistory(customerId: string, query: HistoryQuery) {
  const filter: Record<string, unknown> = { customerId };

  // Optional narrowing. These can only ever make the result set SMALLER —
  // none of them can widen it beyond this customer's own rows.
  if (query.direction) filter.direction = query.direction;
  if (query.status) filter.status = query.status;
  if (query.scope) filter.scope = query.scope;

  const skip = (query.page - 1) * query.limit;

  // Run the count and the page in parallel — they are independent queries.
  const [total, rows] = await Promise.all([
    TransactionModel.countDocuments(filter),
    TransactionModel.find(filter)
      .sort({ createdAt: -1 }) // newest first, served by our compound index
      .skip(skip)
      .limit(query.limit)
      .lean(),
  ]);

  return {
    transactions: rows.map((t) => ({
      reference: t.reference,
      direction: t.direction,
      scope: t.scope,
      status: t.status,
      amount: koboToNaira(t.amountKobo),
      currency: 'NGN',
      accountNumber: t.accountNumber,
      counterpartyAccount: t.counterpartyAccount,
      counterpartyName: t.counterpartyName,
      narration: t.narration,
      createdAt: t.createdAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
      hasNextPage: skip + rows.length < total,
    },
  };
}

/** A small summary for the customer's dashboard. Also scoped by customerId. */
export async function getTransactionSummary(customerId: string) {
  const [totals] = await TransactionModel.aggregate([
    // Aggregation pipelines bypass Mongoose casting, so the string id must be
    // converted to an ObjectId by hand or the $match silently matches nothing.
    { $match: { customerId: new Types.ObjectId(customerId) } },
    {
      $group: {
        _id: '$direction',
        count: { $sum: 1 },
        totalKobo: { $sum: '$amountKobo' },
      },
    },
    { $group: { _id: null, byDirection: { $push: { direction: '$_id', count: '$count', totalKobo: '$totalKobo' } } } },
  ]);

  const rows = (totals?.byDirection ?? []) as Array<{ direction: string; count: number; totalKobo: number }>;
  const find = (d: string) => rows.find((r) => r.direction === d);

  return {
    totalDebits: find('DEBIT')?.count ?? 0,
    totalCredits: find('CREDIT')?.count ?? 0,
    totalSentNaira: koboToNaira(find('DEBIT')?.totalKobo ?? 0),
    totalReceivedNaira: koboToNaira(find('CREDIT')?.totalKobo ?? 0),
  };
}
