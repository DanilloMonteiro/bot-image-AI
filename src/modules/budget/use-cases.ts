import type { BudgetRepository, BudgetReservation } from './repository.js';

export const SYNTHETIC_TRACE_RESERVATION = {
  amountMinor: 1,
  currency: 'BRL',
  category: 'synthetic_trace',
  status: 'reserved',
} as const;

export class Budget {
  constructor(private readonly repository: BudgetRepository) {}

  reserveSyntheticTrace(actionId: string): Promise<BudgetReservation> {
    return this.repository.reserveSyntheticTrace(actionId);
  }

  lookupSyntheticTrace(actionId: string): Promise<BudgetReservation | null> {
    return this.repository.findSyntheticTrace(actionId);
  }
}
