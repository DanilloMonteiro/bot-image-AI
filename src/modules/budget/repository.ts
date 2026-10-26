import type {
  BudgetExposureV1,
  BudgetLedgerSnapshotV1,
  BudgetOpeningBalanceReconciliationV1,
  BudgetOpeningBalanceWriteResultV1,
  BudgetReconciliationV1,
  BudgetReconciliationWriteResultV1,
  BudgetReservationDecisionRequestV1,
  BudgetReservationDecisionWriteResultV1,
  BudgetReservationRequestV1,
  BudgetReservationResultV1,
} from '../../contracts/budget/v1.js';

export type BudgetReservation = {
  actionId: string;
  amountMinor: 1;
  currency: 'BRL';
  category: 'synthetic_trace';
  status: 'reserved';
  createdAt: string;
};

export type BudgetExposureWriteResult = 'recorded' | 'already_recorded';

export interface BudgetRepository {
  reserveSyntheticTrace(actionId: string): Promise<BudgetReservation>;
  findSyntheticTrace(actionId: string): Promise<BudgetReservation | null>;
  reserveAction(request: BudgetReservationRequestV1): Promise<BudgetReservationResultV1>;
  recordExposure(exposure: BudgetExposureV1): Promise<BudgetExposureWriteResult>;
  recordReconciliation(reconciliation: BudgetReconciliationV1): Promise<BudgetReconciliationWriteResultV1>;
  decideReservation(request: BudgetReservationDecisionRequestV1): Promise<BudgetReservationDecisionWriteResultV1>;
  reconcileOpeningBalance(
    reconciliation: BudgetOpeningBalanceReconciliationV1,
  ): Promise<BudgetOpeningBalanceWriteResultV1>;
  readBudgetLedgerSnapshot(): Promise<BudgetLedgerSnapshotV1>;
}
