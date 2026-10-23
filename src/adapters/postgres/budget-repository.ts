import { getBoss, getPool, startBoss, transactionDb } from './runtime';
import type { BudgetRepository, BudgetReservation } from '../../modules/budget/repository.js';
import { SYNTHETIC_TRACE_RESERVATION } from '../../modules/budget/use-cases';

export const BUDGET_TRACE_QUEUE = 'budget-trace';

let ready: Promise<void> | undefined;

export function ensureBudgetReady(): Promise<void> {
  ready ??= (async () => {
    await startBoss();
    await getPool().query(`CREATE TABLE IF NOT EXISTS budget_reservations (
      action_id uuid PRIMARY KEY,
      amount_minor integer NOT NULL CHECK (amount_minor = 1),
      currency text NOT NULL CHECK (currency = 'BRL'),
      category text NOT NULL CHECK (category = 'synthetic_trace'),
      status text NOT NULL DEFAULT 'reserved' CHECK (status = 'reserved'),
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await getBoss().createQueue(BUDGET_TRACE_QUEUE, {
      retryLimit: 2,
      retryDelay: 1,
      expireInSeconds: 30,
      deleteAfterSeconds: 0,
    });
  })().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

export async function checkBudgetRuntimeReadiness(): Promise<boolean> {
  try {
    const readinessQuery = { text: 'SELECT 1 FROM budget_reservations LIMIT 0', query_timeout: 1_500 };
    await getPool().query(readinessQuery);
    return (await getBoss().getQueues([BUDGET_TRACE_QUEUE])).length === 1;
  } catch {
    return false;
  }
}

function toReservation(row: Record<string, unknown>): BudgetReservation {
  const amountMinor = Number(row.amount_minor);
  if (amountMinor !== SYNTHETIC_TRACE_RESERVATION.amountMinor
    || row.currency !== SYNTHETIC_TRACE_RESERVATION.currency
    || row.category !== SYNTHETIC_TRACE_RESERVATION.category
    || row.status !== SYNTHETIC_TRACE_RESERVATION.status) {
    throw new Error('synthetic_reservation_mismatch');
  }
  return {
    actionId: String(row.action_id),
    amountMinor: 1,
    currency: 'BRL',
    category: 'synthetic_trace',
    status: 'reserved',
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export class PostgresBudgetRepository implements BudgetRepository {
  async reserveSyntheticTrace(actionId: string): Promise<BudgetReservation> {
    await ensureBudgetReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO budget_reservations (action_id, amount_minor, currency, category, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (action_id) DO NOTHING
         RETURNING *`,
        [
          actionId,
          SYNTHETIC_TRACE_RESERVATION.amountMinor,
          SYNTHETIC_TRACE_RESERVATION.currency,
          SYNTHETIC_TRACE_RESERVATION.category,
          SYNTHETIC_TRACE_RESERVATION.status,
        ],
      );
      const created = inserted.rows.length === 1;
      const selected = created
        ? inserted
        : await client.query('SELECT * FROM budget_reservations WHERE action_id = $1 FOR UPDATE', [actionId]);
      if (!selected.rows[0]) throw new Error('synthetic_reservation_missing');
      const reservation = toReservation(selected.rows[0]);

      if (created) {
        const jobId = await getBoss().send(BUDGET_TRACE_QUEUE, {
          actionId,
          kind: 'synthetic-budget-trace',
        }, {
          id: actionId,
          retryLimit: 2,
          retryDelay: 1,
          expireInSeconds: 30,
          deleteAfterSeconds: 0,
          db: transactionDb(client),
        });
        if (!jobId) throw new Error('queue_refused_budget_trace_job');
      }

      await client.query('COMMIT');
      return reservation;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findSyntheticTrace(actionId: string): Promise<BudgetReservation | null> {
    await ensureBudgetReady();
    const result = await getPool().query(
      'SELECT * FROM budget_reservations WHERE action_id = $1',
      [actionId],
    );
    return result.rows[0] ? toReservation(result.rows[0]) : null;
  }
}
