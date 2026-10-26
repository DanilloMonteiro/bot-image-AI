import { getBoss, getPool, startBoss, transactionDb } from './runtime';
import type { PoolClient } from 'pg';
import type {
  BudgetExposureWriteResult,
  BudgetRepository,
  BudgetReservation,
} from '../../modules/budget/repository.js';
import { SYNTHETIC_TRACE_RESERVATION } from '../../modules/budget/use-cases';
import {
  BUDGET_CAPPED_CATEGORIES_V1,
  isBudgetExposureV1,
  isBudgetOpeningBalanceReconciliationV1,
  isBudgetReconciliationV1,
  isBudgetReservationDecisionResultV1,
  isBudgetReservationDecisionRequestV1,
  isBudgetReservationRequestV1,
  type BudgetAmountV1,
  type BudgetBalanceV1,
  type BudgetCappedCategoryV1,
  type BudgetCategoryBalanceV1,
  type BudgetDecisionBlockReasonV1,
  type BudgetExposureV1,
  type BudgetExposureStateV1,
  type BudgetLedgerSnapshotV1,
  type BudgetOpeningBalanceReconciliationV1,
  type BudgetOpeningBalanceWriteResultV1,
  type BudgetReconciliationV1,
  type BudgetReconciliationWriteResultV1,
  type BudgetReservationDecisionRequestV1,
  type BudgetReservationDecisionResultV1,
  type BudgetReservationDecisionWriteResultV1,
  type BudgetReservationRequestV1,
  type BudgetReservationResultV1,
} from '../../contracts/budget/v1';
import {
  BUDGET_CATEGORY_CAPS_MINOR_V1,
  BUDGET_TOTAL_CAP_MINOR_V1,
  reservationTotalMinor,
} from '../../modules/budget/limits';

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
    await getPool().query(`CREATE TABLE IF NOT EXISTS budget_ledger_guard (
      singleton_id smallint PRIMARY KEY CHECK (singleton_id = 1)
    )`);
    await getPool().query(
      'INSERT INTO budget_ledger_guard (singleton_id) VALUES (1) ON CONFLICT (singleton_id) DO NOTHING',
    );
    await getPool().query(`CREATE TABLE IF NOT EXISTS budget_ledger_opening_balances (
      category text PRIMARY KEY CHECK (category IN (
        'advertising', 'ai', 'railway', 'domain_accessories', 'meta_pix_fx_retries'
      )),
      status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'known')),
      incurred_minor bigint CHECK (incurred_minor >= 0),
      committed_minor bigint CHECK (committed_minor >= 0),
      reserved_minor bigint CHECK (reserved_minor >= 0),
      unbilled_minor bigint CHECK (unbilled_minor >= 0),
      CHECK (
        (status = 'unknown' AND incurred_minor IS NULL AND committed_minor IS NULL
          AND reserved_minor IS NULL AND unbilled_minor IS NULL)
        OR (status = 'known' AND incurred_minor IS NOT NULL AND committed_minor IS NOT NULL
          AND reserved_minor IS NOT NULL AND unbilled_minor IS NOT NULL)
      )
    )`);
    await getPool().query(`ALTER TABLE budget_ledger_opening_balances
      ADD COLUMN IF NOT EXISTS reconciliation_id text,
      ADD COLUMN IF NOT EXISTS evidence jsonb,
      ADD COLUMN IF NOT EXISTS reconciled_at timestamptz`);
    for (const category of BUDGET_CAPPED_CATEGORIES_V1) {
      await getPool().query(
        'INSERT INTO budget_ledger_opening_balances (category) VALUES ($1) ON CONFLICT (category) DO NOTHING',
        [category],
      );
    }
    await getPool().query(`CREATE TABLE IF NOT EXISTS budget_ledger_entries (
      entry_id text PRIMARY KEY,
      action_id text NOT NULL,
      entry_kind text NOT NULL CHECK (entry_kind IN ('reservation', 'exposure')),
      category text NOT NULL CHECK (category IN (
        'advertising', 'ai', 'railway', 'domain_accessories', 'meta_pix_fx_retries'
      )),
      state text NOT NULL CHECK (state IN ('incurred', 'committed', 'reserved', 'unbilled')),
      amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
      unit_amount_minor bigint CHECK (unit_amount_minor >= 0),
      attempt_limit bigint CHECK (attempt_limit > 0),
      reservation_status text CHECK (reservation_status IN ('active', 'settled', 'released')),
      settled_amount_minor bigint CHECK (settled_amount_minor >= 0),
      currency text NOT NULL CHECK (currency = 'BRL'),
      occurred_at timestamptz NOT NULL,
      CHECK (
        (entry_kind = 'reservation' AND state = 'reserved' AND unit_amount_minor IS NOT NULL
          AND attempt_limit IS NOT NULL AND amount_minor = unit_amount_minor * attempt_limit
          AND reservation_status IS NOT NULL
          AND ((reservation_status = 'settled' AND settled_amount_minor IS NOT NULL)
            OR (reservation_status IN ('active', 'released') AND settled_amount_minor IS NULL)))
        OR (entry_kind = 'exposure' AND unit_amount_minor IS NULL AND attempt_limit IS NULL
          AND reservation_status IS NULL AND settled_amount_minor IS NULL)
      )
    )`);
    await getPool().query(`CREATE TABLE IF NOT EXISTS budget_reconciliations (
      reconciliation_id text PRIMARY KEY,
      action_id text NOT NULL,
      terminality text NOT NULL CHECK (terminality IN ('pending', 'unknown', 'terminal')),
      cost_status text NOT NULL CHECK (cost_status IN ('known', 'unknown')),
      payload jsonb NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now()
    )`);
    await getPool().query(`CREATE INDEX IF NOT EXISTS budget_reconciliations_action_idx
      ON budget_reconciliations (action_id, recorded_at)`);
    await getPool().query(`CREATE TABLE IF NOT EXISTS budget_reservation_decisions (
      decision_id text PRIMARY KEY,
      action_id text NOT NULL,
      reconciliation_id text NOT NULL,
      decision text NOT NULL CHECK (decision IN ('settle', 'release')),
      actor_id text NOT NULL,
      reason text NOT NULL,
      request jsonb NOT NULL,
      result jsonb NOT NULL,
      decided_at timestamptz NOT NULL,
      successful boolean NOT NULL DEFAULT false
    )`);
    await getPool().query(`ALTER TABLE budget_reservation_decisions
      ADD COLUMN IF NOT EXISTS successful boolean NOT NULL DEFAULT false`);
    await getPool().query(`ALTER TABLE budget_reservation_decisions
      DROP CONSTRAINT IF EXISTS budget_reservation_decisions_action_id_key`);
    await getPool().query(`UPDATE budget_reservation_decisions
      SET successful = true WHERE result->>'status' IN ('settled', 'released')`);
    await getPool().query(`CREATE UNIQUE INDEX IF NOT EXISTS budget_reservation_decisions_success_action_unique
      ON budget_reservation_decisions (action_id) WHERE successful = true`);
    await getPool().query(`CREATE TABLE IF NOT EXISTS budget_opening_balance_reconciliations (
      reconciliation_id text PRIMARY KEY,
      category text NOT NULL CHECK (category IN (
        'advertising', 'ai', 'railway', 'domain_accessories', 'meta_pix_fx_retries'
      )),
      balance_status text NOT NULL CHECK (balance_status IN ('pending', 'known')),
      payload jsonb NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now()
    )`);
    await getPool().query(`CREATE UNIQUE INDEX IF NOT EXISTS budget_ledger_reservation_action_unique
      ON budget_ledger_entries (action_id) WHERE entry_kind = 'reservation'`);
    await getPool().query(`CREATE INDEX IF NOT EXISTS budget_ledger_category_state_idx
      ON budget_ledger_entries (category, state)`);
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
    const guard = await getPool().query(
      'SELECT singleton_id FROM budget_ledger_guard WHERE singleton_id = 1 LIMIT 1',
    );
    const readinessQuery = { text: 'SELECT 1 FROM budget_reservations LIMIT 0', query_timeout: 1_500 };
    await getPool().query(readinessQuery);
    return guard.rows.length === 1 && (await getBoss().getQueues([BUDGET_TRACE_QUEUE])).length === 1;
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

const UNKNOWN_BALANCE_REASON = 'budget_sources_not_reconciled';
const EXPOSURE_STATES: readonly BudgetExposureStateV1[] = [
  'incurred', 'committed', 'reserved', 'unbilled',
];

type ExposureAmounts = Record<BudgetExposureStateV1, number | null>;
type CategoryLedgerState = { known: boolean; amounts: ExposureAmounts };
type BudgetLedgerState = {
  allKnown: boolean;
  categories: Map<BudgetCappedCategoryV1, CategoryLedgerState>;
  totalAmounts: ExposureAmounts;
};

function emptyExposureAmounts(value: number | null): ExposureAmounts {
  return { incurred: value, committed: value, reserved: value, unbilled: value };
}

function safeMinor(value: unknown): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('invalid_budget_ledger_amount');
  return amount;
}

function addMinor(left: number, right: number): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum) || sum < 0) throw new Error('budget_ledger_amount_overflow');
  return sum;
}

async function lockBudgetLedger(client: PoolClient): Promise<void> {
  await client.query(
    'INSERT INTO budget_ledger_guard (singleton_id) VALUES (1) ON CONFLICT (singleton_id) DO NOTHING',
  );
  const result = await client.query(
    'SELECT singleton_id FROM budget_ledger_guard WHERE singleton_id = 1 FOR UPDATE',
  );
  if (result.rows.length !== 1) throw new Error('budget_ledger_lock_missing');
}

async function loadBudgetLedgerState(
  client: PoolClient,
): Promise<BudgetLedgerState> {
  const openingResult = await client.query(
    `SELECT category, status, incurred_minor, committed_minor, reserved_minor, unbilled_minor
     FROM budget_ledger_opening_balances`,
  );
  const entriesResult = await client.query(
    `SELECT category, state, SUM(amount_minor)::text AS amount_minor
     FROM budget_ledger_entries
     WHERE entry_kind = 'exposure' OR reservation_status = 'active'
     GROUP BY category, state`,
  );

  const openings = new Map(openingResult.rows.map((row) => [String(row.category), row]));
  const entries = new Map<string, number>();
  for (const row of entriesResult.rows) {
    const key = `${String(row.category)}:${String(row.state)}`;
    entries.set(key, safeMinor(row.amount_minor));
  }

  const categories = new Map<BudgetCappedCategoryV1, CategoryLedgerState>();
  let allKnown = true;
  for (const category of BUDGET_CAPPED_CATEGORIES_V1) {
    const opening = openings.get(category);
    const known = opening?.status === 'known'
      && opening.incurred_minor !== null
      && opening.committed_minor !== null
      && opening.reserved_minor !== null
      && opening.unbilled_minor !== null;
    if (!known || !opening) {
      allKnown = false;
      categories.set(category, { known: false, amounts: emptyExposureAmounts(null) });
      continue;
    }

    const amounts = {} as ExposureAmounts;
    for (const state of EXPOSURE_STATES) {
      const openingAmount = safeMinor(opening[`${state}_minor`]);
      const recordedAmount = entries.get(`${category}:${state}`) ?? 0;
      amounts[state] = addMinor(openingAmount, recordedAmount);
    }
    categories.set(category, { known: true, amounts });
  }

  const totalAmounts = allKnown
    ? EXPOSURE_STATES.reduce((total, state) => {
      total[state] = 0;
      for (const category of BUDGET_CAPPED_CATEGORIES_V1) {
        const amount = categories.get(category)?.amounts[state];
        if (amount === null || amount === undefined) throw new Error('budget_ledger_state_incomplete');
        total[state] = addMinor(total[state] ?? 0, amount);
      }
      return total;
    }, {} as ExposureAmounts)
    : emptyExposureAmounts(null);

  return { allKnown, categories, totalAmounts };
}

function knownAmount(amountMinor: number): BudgetAmountV1 {
  return { status: 'known', amountMinor, currency: 'BRL' };
}

function openingAmountMinor(amount: BudgetAmountV1): number {
  if (amount.status !== 'known') throw new Error('complete_budget_opening_balance_has_unknown_amount');
  return amount.amountMinor;
}

function unknownAmount(): BudgetAmountV1 {
  return { status: 'unknown', reason: UNKNOWN_BALANCE_REASON };
}

function remainingMinor(capMinor: number, amounts: ExposureAmounts): number | null {
  let exposure = 0;
  for (const state of EXPOSURE_STATES) {
    const amount = amounts[state];
    if (amount === null) return null;
    exposure = addMinor(exposure, amount);
  }
  return Math.max(0, capMinor - exposure);
}

function blockedBudgetAction(
  actionId: string,
  reason: Extract<BudgetReservationResultV1, { status: 'blocked' }>['reason'],
): BudgetReservationResultV1 {
  return { version: 'v1', actionId, status: 'blocked', reason };
}

function blockedReservationDecision(
  request: BudgetReservationDecisionRequestV1,
  reason: BudgetDecisionBlockReasonV1,
): BudgetReservationDecisionResultV1 {
  return {
    version: 'v1',
    decisionId: request.decisionId,
    actionId: request.actionId,
    status: 'blocked',
    reason,
  };
}

async function persistReservationDecision(
  client: PoolClient,
  request: BudgetReservationDecisionRequestV1,
  result: BudgetReservationDecisionResultV1,
  successful: boolean,
  decidedAt: string,
): Promise<void> {
  if (!isBudgetReservationDecisionResultV1(result)) throw new Error('invalid_budget_decision_result');
  await client.query(
    `INSERT INTO budget_reservation_decisions (
       decision_id, action_id, reconciliation_id, decision, actor_id, reason,
       request, result, decided_at, successful
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)`,
    [
      request.decisionId,
      request.actionId,
      request.reconciliationId,
      request.decision,
      request.actorId,
      request.reason,
      JSON.stringify(request),
      JSON.stringify(result),
      decidedAt,
      successful,
    ],
  );
}

function isSameExposure(row: Record<string, unknown>, exposure: BudgetExposureV1): boolean {
  const occurredAt = row.occurred_at instanceof Date
    ? row.occurred_at.toISOString()
    : new Date(String(row.occurred_at)).toISOString();
  return row.entry_kind === 'exposure'
    && row.action_id === exposure.actionId
    && row.category === exposure.category
    && row.state === exposure.state
    && Number(row.amount_minor) === exposure.amountMinor
    && row.currency === exposure.currency
    && occurredAt === exposure.occurredAt;
}

function toCategoryBalance(
  category: BudgetCappedCategoryV1,
  state: CategoryLedgerState,
): BudgetCategoryBalanceV1 {
  const cap = knownAmount(BUDGET_CATEGORY_CAPS_MINOR_V1[category]);
  if (!state.known) {
    return {
      category,
      cap,
      incurred: unknownAmount(),
      committed: unknownAmount(),
      reserved: unknownAmount(),
      unbilled: unknownAmount(),
      available: unknownAmount(),
    };
  }
  const available = remainingMinor(BUDGET_CATEGORY_CAPS_MINOR_V1[category], state.amounts);
  if (available === null) throw new Error('budget_category_availability_unknown');
  return {
    category,
    cap,
    incurred: knownAmount(state.amounts.incurred as number),
    committed: knownAmount(state.amounts.committed as number),
    reserved: knownAmount(state.amounts.reserved as number),
    unbilled: knownAmount(state.amounts.unbilled as number),
    available: knownAmount(available),
  };
}

function toBudgetLedgerSnapshot(state: BudgetLedgerState): BudgetLedgerSnapshotV1 {
  let total: BudgetBalanceV1;
  if (!state.allKnown) {
    total = {
      cap: knownAmount(BUDGET_TOTAL_CAP_MINOR_V1),
      incurred: unknownAmount(),
      committed: unknownAmount(),
      reserved: unknownAmount(),
      unbilled: unknownAmount(),
      available: unknownAmount(),
    };
  } else {
    const available = remainingMinor(BUDGET_TOTAL_CAP_MINOR_V1, state.totalAmounts);
    if (available === null) throw new Error('budget_total_availability_unknown');
    total = {
      cap: knownAmount(BUDGET_TOTAL_CAP_MINOR_V1),
      incurred: knownAmount(state.totalAmounts.incurred as number),
      committed: knownAmount(state.totalAmounts.committed as number),
      reserved: knownAmount(state.totalAmounts.reserved as number),
      unbilled: knownAmount(state.totalAmounts.unbilled as number),
      available: knownAmount(available),
    };
  }

  return {
    version: 'v1',
    generatedAt: new Date().toISOString(),
    total,
    categories: BUDGET_CAPPED_CATEGORIES_V1.map((category) => {
      const categoryState = state.categories.get(category);
      if (!categoryState) throw new Error('budget_category_state_missing');
      return toCategoryBalance(category, categoryState);
    }),
  };
}

function isSameReservation(row: Record<string, unknown>, request: BudgetReservationRequestV1): boolean {
  return request.cost.status === 'known'
    && row.category === request.category
    && Number(row.unit_amount_minor) === request.cost.amountMinor
    && Number(row.attempt_limit) === request.attemptLimit
    && row.currency === 'BRL';
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

  async reserveAction(request: BudgetReservationRequestV1): Promise<BudgetReservationResultV1> {
    await ensureBudgetReady();
    if (!isBudgetReservationRequestV1(request)) throw new Error('invalid_budget_reservation_request');

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await lockBudgetLedger(client);

      const existingResult = await client.query(
        `SELECT * FROM budget_ledger_entries
         WHERE entry_kind = 'reservation' AND action_id = $1 FOR UPDATE`,
        [request.actionId],
      );
      const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
      if (existing) {
        if (request.cost.status !== 'known' || !isSameReservation(existing, request)) {
          throw new Error('budget_action_payload_conflict');
        }
        if (existing.reservation_status !== 'active') throw new Error('budget_action_already_decided');
        await client.query('COMMIT');
        return {
          version: 'v1',
          actionId: request.actionId,
          status: 'already_reserved',
          reservationId: String(existing.entry_id),
        };
      }

      if (request.cost.status !== 'known' || request.cost.currency !== 'BRL') {
        await client.query('COMMIT');
        return blockedBudgetAction(request.actionId, 'unknown_cost');
      }
      const amountMinor = reservationTotalMinor(request.cost.amountMinor, request.attemptLimit);
      if (amountMinor === null) {
        await client.query('COMMIT');
        return blockedBudgetAction(request.actionId, 'unknown_cost');
      }

      const ledger = await loadBudgetLedgerState(client);
      if (!ledger.allKnown) {
        await client.query('COMMIT');
        return blockedBudgetAction(request.actionId, 'balance_unknown');
      }

      const categoryState = ledger.categories.get(request.category);
      if (!categoryState?.known) {
        await client.query('COMMIT');
        return blockedBudgetAction(request.actionId, 'balance_unknown');
      }
      const categoryAvailable = remainingMinor(
        BUDGET_CATEGORY_CAPS_MINOR_V1[request.category],
        categoryState.amounts,
      );
      const totalAvailable = remainingMinor(BUDGET_TOTAL_CAP_MINOR_V1, ledger.totalAmounts);
      if (categoryAvailable === null || totalAvailable === null) {
        await client.query('COMMIT');
        return blockedBudgetAction(request.actionId, 'balance_unknown');
      }
      if (amountMinor > categoryAvailable) {
        await client.query('COMMIT');
        return blockedBudgetAction(request.actionId, 'category_limit');
      }
      if (amountMinor > totalAvailable) {
        await client.query('COMMIT');
        return blockedBudgetAction(request.actionId, 'insufficient_balance');
      }

      const reservationId = `reservation:${request.actionId}`;
      const inserted = await client.query(
        `INSERT INTO budget_ledger_entries (
           entry_id, action_id, entry_kind, category, state, amount_minor,
           unit_amount_minor, attempt_limit, reservation_status, settled_amount_minor, currency, occurred_at
         ) VALUES ($1, $2, 'reservation', $3, 'reserved', $4, $5, $6, 'active', NULL, 'BRL', now())
         ON CONFLICT DO NOTHING RETURNING entry_id`,
        [
          reservationId,
          request.actionId,
          request.category,
          amountMinor,
          request.cost.amountMinor,
          request.attemptLimit,
        ],
      );
      if (inserted.rows.length !== 1) throw new Error('budget_reservation_idempotency_conflict');

      await client.query('COMMIT');
      return {
        version: 'v1',
        actionId: request.actionId,
        status: 'reserved',
        reservationId,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async recordExposure(exposure: BudgetExposureV1): Promise<BudgetExposureWriteResult> {
    await ensureBudgetReady();
    if (!isBudgetExposureV1(exposure)) throw new Error('invalid_budget_exposure');

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await lockBudgetLedger(client);
      const inserted = await client.query(
        `INSERT INTO budget_ledger_entries (
           entry_id, action_id, entry_kind, category, state, amount_minor,
           unit_amount_minor, attempt_limit, currency, occurred_at
         ) VALUES ($1, $2, 'exposure', $3, $4, $5, NULL, NULL, 'BRL', $6)
         ON CONFLICT (entry_id) DO NOTHING RETURNING entry_id`,
        [
          exposure.entryId,
          exposure.actionId,
          exposure.category,
          exposure.state,
          exposure.amountMinor,
          exposure.occurredAt,
        ],
      );
      if (inserted.rows.length === 1) {
        await client.query('COMMIT');
        return 'recorded';
      }

      const existingResult = await client.query(
        'SELECT * FROM budget_ledger_entries WHERE entry_id = $1 FOR UPDATE',
        [exposure.entryId],
      );
      const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
      if (!existing || !isSameExposure(existing, exposure)) throw new Error('budget_exposure_payload_conflict');
      await client.query('COMMIT');
      return 'already_recorded';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async recordReconciliation(
    reconciliation: BudgetReconciliationV1,
  ): Promise<BudgetReconciliationWriteResultV1> {
    await ensureBudgetReady();
    if (!isBudgetReconciliationV1(reconciliation)) throw new Error('invalid_budget_reconciliation');

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await lockBudgetLedger(client);

      const existing = await client.query(
        `SELECT payload = $2::jsonb AS same
         FROM budget_reconciliations WHERE reconciliation_id = $1 FOR UPDATE`,
        [reconciliation.reconciliationId, JSON.stringify(reconciliation)],
      );
      if (existing.rows.length > 0) {
        if (existing.rows[0].same !== true) throw new Error('budget_reconciliation_payload_conflict');
        await client.query('COMMIT');
        return { version: 'v1', reconciliationId: reconciliation.reconciliationId, status: 'already_recorded' };
      }

      const reservation = await client.query(
        `SELECT entry_id FROM budget_ledger_entries
         WHERE entry_kind = 'reservation' AND action_id = $1 FOR UPDATE`,
        [reconciliation.actionId],
      );
      if (reservation.rows.length !== 1) throw new Error('budget_reconciliation_reservation_missing');

      const inserted = await client.query(
        `INSERT INTO budget_reconciliations (
           reconciliation_id, action_id, terminality, cost_status, payload
         ) VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (reconciliation_id) DO NOTHING RETURNING reconciliation_id`,
        [
          reconciliation.reconciliationId,
          reconciliation.actionId,
          reconciliation.terminality,
          reconciliation.cost.status,
          JSON.stringify(reconciliation),
        ],
      );
      if (inserted.rows.length !== 1) throw new Error('budget_reconciliation_idempotency_conflict');

      await client.query('COMMIT');
      return { version: 'v1', reconciliationId: reconciliation.reconciliationId, status: 'recorded' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async decideReservation(
    request: BudgetReservationDecisionRequestV1,
  ): Promise<BudgetReservationDecisionWriteResultV1> {
    await ensureBudgetReady();
    if (!isBudgetReservationDecisionRequestV1(request)) {
      throw new Error('invalid_budget_reservation_decision_request');
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await lockBudgetLedger(client);

      const finishBlocked = async (
        reason: BudgetDecisionBlockReasonV1,
      ): Promise<BudgetReservationDecisionResultV1> => {
        const result = blockedReservationDecision(request, reason);
        const decisionTime = await client.query('SELECT transaction_timestamp() AS decided_at');
        const decidedAt = new Date(decisionTime.rows[0].decided_at as Date).toISOString();
        await persistReservationDecision(client, request, result, false, decidedAt);
        await client.query('COMMIT');
        return result;
      };

      const previous = await client.query(
        `SELECT request = $2::jsonb AS same, result
         FROM budget_reservation_decisions WHERE decision_id = $1 FOR UPDATE`,
        [request.decisionId, JSON.stringify(request)],
      );
      if (previous.rows.length > 0) {
        if (previous.rows[0].same !== true) throw new Error('budget_decision_payload_conflict');
        const result = previous.rows[0].result as unknown;
        if (!isBudgetReservationDecisionResultV1(result)) {
          throw new Error('persisted_budget_decision_invalid');
        }
        await client.query('COMMIT');
        return result;
      }

      const priorActionDecision = await client.query(
        `SELECT decision_id FROM budget_reservation_decisions
         WHERE action_id = $1 AND successful = true FOR UPDATE`,
        [request.actionId],
      );
      if (priorActionDecision.rows.length > 0) throw new Error('budget_action_already_decided');

      const reservationResult = await client.query(
        `SELECT * FROM budget_ledger_entries
         WHERE entry_kind = 'reservation' AND action_id = $1 FOR UPDATE`,
        [request.actionId],
      );
      const reservation = reservationResult.rows[0] as Record<string, unknown> | undefined;
      if (!reservation) return finishBlocked('reservation_missing');
      if (reservation.reservation_status !== 'active') return finishBlocked('reservation_not_active');

      const reconciliationResult = await client.query(
        'SELECT payload FROM budget_reconciliations WHERE reconciliation_id = $1 FOR SHARE',
        [request.reconciliationId],
      );
      const storedReconciliation = reconciliationResult.rows[0]?.payload as unknown;
      if (!storedReconciliation || !isBudgetReconciliationV1(storedReconciliation)) {
        return finishBlocked('reconciliation_missing');
      }
      if (storedReconciliation.actionId !== request.actionId) return finishBlocked('reconciliation_mismatch');
      if (storedReconciliation.terminality !== 'terminal') return finishBlocked('reconciliation_not_terminal');
      if (storedReconciliation.cost.status !== 'known') return finishBlocked('unknown_cost');
      if (request.decision === 'release' && storedReconciliation.cost.amountMinor !== 0) {
        return finishBlocked('release_requires_zero_cost');
      }
      if (request.decision === 'settle' && storedReconciliation.cost.amountMinor === 0) {
        return finishBlocked('settlement_requires_positive_cost');
      }

      const decisionTime = await client.query('SELECT transaction_timestamp() AS decided_at');
      const decidedAt = new Date(decisionTime.rows[0].decided_at as Date).toISOString();
      const reservationId = String(reservation.entry_id);
      const cost = storedReconciliation.cost;
      if (cost.status !== 'known') throw new Error('budget_reconciliation_cost_narrowing_failed');
      const existingExposureResult = await client.query(
        `SELECT entry_id, category, amount_minor
         FROM budget_ledger_entries
         WHERE entry_kind = 'exposure' AND action_id = $1 FOR UPDATE`,
        [request.actionId],
      );
      let existingExposureMinor = 0;
      for (const exposure of existingExposureResult.rows as Array<Record<string, unknown>>) {
        if (exposure.category !== reservation.category) {
          throw new Error('budget_action_exposure_category_conflict');
        }
        existingExposureMinor = addMinor(existingExposureMinor, safeMinor(exposure.amount_minor));
      }
      if (existingExposureMinor > cost.amountMinor) {
        return finishBlocked('exposure_exceeds_reconciled_cost');
      }

      let result: BudgetReservationDecisionResultV1;

      if (request.decision === 'settle') {
        await client.query(
          `UPDATE budget_ledger_entries SET state = $2
           WHERE entry_kind = 'exposure' AND action_id = $1`,
          [request.actionId, cost.billingState],
        );
        const remainderMinor = cost.amountMinor - existingExposureMinor;
        if (remainderMinor > 0) {
          await client.query(
            `INSERT INTO budget_ledger_entries (
               entry_id, action_id, entry_kind, category, state, amount_minor,
               unit_amount_minor, attempt_limit, reservation_status, settled_amount_minor, currency, occurred_at
             ) VALUES ($1, $2, 'exposure', $3, $4, $5, NULL, NULL, NULL, NULL, 'BRL', $6)`,
            [
              `settlement:${request.decisionId}`,
              request.actionId,
              reservation.category,
              cost.billingState,
              remainderMinor,
              storedReconciliation.occurredAt,
            ],
          );
        }
        const updated = await client.query(
          `UPDATE budget_ledger_entries
           SET reservation_status = 'settled', settled_amount_minor = $2
           WHERE entry_id = $1 AND entry_kind = 'reservation' AND reservation_status = 'active'`,
          [reservationId, cost.amountMinor],
        );
        if (updated.rowCount !== 1) throw new Error('budget_reservation_transition_conflict');
        result = {
          version: 'v1',
          decisionId: request.decisionId,
          actionId: request.actionId,
          status: 'settled',
          reservationId,
          reconciliationId: request.reconciliationId,
          amountMinor: cost.amountMinor,
          state: cost.billingState,
          actorId: request.actorId,
          reason: request.reason,
          decidedAt,
        };
      } else {
        const updated = await client.query(
          `UPDATE budget_ledger_entries
           SET reservation_status = 'released', settled_amount_minor = NULL
           WHERE entry_id = $1 AND entry_kind = 'reservation' AND reservation_status = 'active'`,
          [reservationId],
        );
        if (updated.rowCount !== 1) throw new Error('budget_reservation_transition_conflict');
        result = {
          version: 'v1',
          decisionId: request.decisionId,
          actionId: request.actionId,
          status: 'released',
          reservationId,
          reconciliationId: request.reconciliationId,
          amountMinor: 0,
          actorId: request.actorId,
          reason: request.reason,
          decidedAt,
        };
      }

      await persistReservationDecision(client, request, result, true, decidedAt);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async reconcileOpeningBalance(
    reconciliation: BudgetOpeningBalanceReconciliationV1,
  ): Promise<BudgetOpeningBalanceWriteResultV1> {
    await ensureBudgetReady();
    if (!isBudgetOpeningBalanceReconciliationV1(reconciliation)) {
      throw new Error('invalid_budget_opening_balance_reconciliation');
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await lockBudgetLedger(client);

      const existing = await client.query(
        `SELECT payload = $2::jsonb AS same, balance_status
         FROM budget_opening_balance_reconciliations WHERE reconciliation_id = $1 FOR UPDATE`,
        [reconciliation.reconciliationId, JSON.stringify(reconciliation)],
      );
      if (existing.rows.length > 0) {
        if (existing.rows[0].same !== true) throw new Error('budget_opening_reconciliation_payload_conflict');
        await client.query('COMMIT');
        return {
          version: 'v1',
          reconciliationId: reconciliation.reconciliationId,
          status: 'already_recorded',
          balanceStatus: String(existing.rows[0].balance_status) as 'pending' | 'known',
        };
      }

      const balanceStatus = reconciliation.status === 'complete' ? 'known' : 'pending';
      if (reconciliation.status === 'complete') {
        const current = await client.query(
          'SELECT status FROM budget_ledger_opening_balances WHERE category = $1 FOR UPDATE',
          [reconciliation.category],
        );
        if (current.rows.length !== 1) throw new Error('budget_opening_balance_category_missing');
        if (current.rows[0].status === 'known') throw new Error('budget_opening_balance_already_known');
      }

      const inserted = await client.query(
        `INSERT INTO budget_opening_balance_reconciliations (
           reconciliation_id, category, balance_status, payload
         ) VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (reconciliation_id) DO NOTHING RETURNING reconciliation_id`,
        [
          reconciliation.reconciliationId,
          reconciliation.category,
          balanceStatus,
          JSON.stringify(reconciliation),
        ],
      );
      if (inserted.rows.length !== 1) throw new Error('budget_opening_reconciliation_idempotency_conflict');

      if (reconciliation.status === 'complete') {
        const amounts = reconciliation.amounts;
        const updated = await client.query(
          `UPDATE budget_ledger_opening_balances
           SET status = 'known', incurred_minor = $2, committed_minor = $3,
               reserved_minor = $4, unbilled_minor = $5, reconciliation_id = $6,
               evidence = $7::jsonb, reconciled_at = now()
           WHERE category = $1 AND status = 'unknown'`,
          [
            reconciliation.category,
            openingAmountMinor(amounts.incurred),
            openingAmountMinor(amounts.committed),
            openingAmountMinor(amounts.reserved),
            openingAmountMinor(amounts.unbilled),
            reconciliation.reconciliationId,
            JSON.stringify(reconciliation.evidence),
          ],
        );
        if (updated.rowCount !== 1) throw new Error('budget_opening_balance_transition_conflict');
      }

      await client.query('COMMIT');
      return {
        version: 'v1',
        reconciliationId: reconciliation.reconciliationId,
        status: 'recorded',
        balanceStatus,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async readBudgetLedgerSnapshot(): Promise<BudgetLedgerSnapshotV1> {
    await ensureBudgetReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await lockBudgetLedger(client);
      const snapshot = toBudgetLedgerSnapshot(await loadBudgetLedgerState(client));
      await client.query('COMMIT');
      return snapshot;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
