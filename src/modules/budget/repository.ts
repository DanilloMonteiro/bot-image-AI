export type BudgetReservation = {
  actionId: string;
  amountMinor: 1;
  currency: 'BRL';
  category: 'synthetic_trace';
  status: 'reserved';
  createdAt: string;
};

export interface BudgetRepository {
  reserveSyntheticTrace(actionId: string): Promise<BudgetReservation>;
  findSyntheticTrace(actionId: string): Promise<BudgetReservation | null>;
}
