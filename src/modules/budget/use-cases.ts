import type { BudgetRepository, BudgetReservation } from './repository.js';
import {
  isBudgetExposureV1,
  isBudgetOpeningBalanceReconciliationV1,
  isBudgetReconciliationV1,
  isBudgetReservationDecisionRequestV1,
  isBudgetReservationRequestV1,
  isBudgetSignalResumeRequestV1,
  isBudgetSignalV1,
  type BudgetExposureV1,
  type BudgetLedgerSnapshotV1,
  type BudgetOpeningBalanceReconciliationV1,
  type BudgetOpeningBalanceWriteResultV1,
  type BudgetReadSnapshotV1,
  type BudgetReconciliationV1,
  type BudgetReconciliationWriteResultV1,
  type BudgetReservationDecisionRequestV1,
  type BudgetReservationDecisionResultV1,
  type BudgetReservationRequestV1,
  type BudgetReservationResultV1,
  type BudgetSignalResumeRequestV1,
  type BudgetSignalResumeResultV1,
  type BudgetSignalV1,
} from '../../contracts/budget/v1';
import { projectBudgetSnapshot } from './snapshot';

export type BudgetAdminVerifier = (actorId: string) => boolean | Promise<boolean>;

export const SYNTHETIC_TRACE_RESERVATION = {
  amountMinor: 1,
  currency: 'BRL',
  category: 'synthetic_trace',
  status: 'reserved',
} as const;

export class Budget {
  constructor(
    private readonly repository: BudgetRepository,
    private readonly verifyAdmin?: BudgetAdminVerifier,
  ) {}

  reserveSyntheticTrace(actionId: string): Promise<BudgetReservation> {
    return this.repository.reserveSyntheticTrace(actionId);
  }

  lookupSyntheticTrace(actionId: string): Promise<BudgetReservation | null> {
    return this.repository.findSyntheticTrace(actionId);
  }

  reserveAction(request: BudgetReservationRequestV1): Promise<BudgetReservationResultV1> {
    if (!isBudgetReservationRequestV1(request)) throw new Error('invalid_budget_reservation_request');
    return this.repository.reserveAction(request);
  }

  recordSignal(signal: BudgetSignalV1): Promise<BudgetSignalV1> {
    if (!isBudgetSignalV1(signal) || signal.status !== 'open' || signal.attempts !== 0) {
      throw new Error('invalid_budget_signal');
    }
    return this.repository.recordBudgetSignal(signal);
  }

  resumeSignal(request: BudgetSignalResumeRequestV1): Promise<BudgetSignalResumeResultV1> {
    if (!isBudgetSignalResumeRequestV1(request)) throw new Error('invalid_budget_signal_resume_request');
    return this.repository.resumeBudgetSignal(request);
  }

  recordExposure(exposure: BudgetExposureV1): Promise<'recorded' | 'already_recorded'> {
    if (!isBudgetExposureV1(exposure)) throw new Error('invalid_budget_exposure');
    return this.repository.recordExposure(exposure);
  }

  recordReconciliation(reconciliation: BudgetReconciliationV1): Promise<BudgetReconciliationWriteResultV1> {
    if (!isBudgetReconciliationV1(reconciliation)) throw new Error('invalid_budget_reconciliation');
    return this.repository.recordReconciliation(reconciliation);
  }

  async decideReservation(
    request: BudgetReservationDecisionRequestV1,
  ): Promise<BudgetReservationDecisionResultV1> {
    if (!isBudgetReservationDecisionRequestV1(request)) {
      throw new Error('invalid_budget_reservation_decision_request');
    }

    if (!this.verifyAdmin) return blockedDecision(request, 'unauthorized');
    try {
      if (await this.verifyAdmin(request.actorId) !== true) return blockedDecision(request, 'unauthorized');
    } catch {
      return blockedDecision(request, 'unauthorized');
    }
    return this.repository.decideReservation(request);
  }

  async reconcileOpeningBalance(
    reconciliation: BudgetOpeningBalanceReconciliationV1,
  ): Promise<BudgetOpeningBalanceWriteResultV1> {
    if (!isBudgetOpeningBalanceReconciliationV1(reconciliation)) {
      throw new Error('invalid_budget_opening_balance_reconciliation');
    }
    if (!this.verifyAdmin) {
      return blockedOpeningBalance(reconciliation.reconciliationId);
    }
    try {
      if (await this.verifyAdmin(reconciliation.actorId) !== true) {
        return blockedOpeningBalance(reconciliation.reconciliationId);
      }
    } catch {
      return blockedOpeningBalance(reconciliation.reconciliationId);
    }
    return this.repository.reconcileOpeningBalance(reconciliation);
  }

  async readBudgetSnapshot(): Promise<BudgetReadSnapshotV1> {
    const ledgerSnapshot: BudgetLedgerSnapshotV1 = await this.repository.readBudgetLedgerSnapshot();
    const signals = await this.repository.listBudgetSignals();
    return projectBudgetSnapshot(ledgerSnapshot, signals);
  }
}

function blockedDecision(
  request: BudgetReservationDecisionRequestV1,
  reason: 'unauthorized',
): BudgetReservationDecisionResultV1 {
  return {
    version: 'v1',
    decisionId: request.decisionId,
    actionId: request.actionId,
    status: 'blocked',
    reason,
  };
}

function blockedOpeningBalance(reconciliationId: string): BudgetOpeningBalanceWriteResultV1 {
  return {
    version: 'v1',
    reconciliationId,
    status: 'blocked',
    reason: 'unauthorized',
  };
}
