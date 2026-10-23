import type { Budget } from '../modules/budget/use-cases.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BudgetTraceJob = {
  actionId: string;
  jobId: string;
  attemptNumber: number;
};

type BudgetOperations = Pick<Budget, 'lookupSyntheticTrace'>;

export async function handleBudgetTraceJob(
  job: BudgetTraceJob,
  dependencies: { budget: BudgetOperations },
): Promise<void> {
  if (!UUID_PATTERN.test(job.actionId)
    || job.jobId !== job.actionId
    || !Number.isSafeInteger(job.attemptNumber)
    || job.attemptNumber < 0) {
    throw new Error('invalid_budget_trace_job');
  }

  const reservation = await dependencies.budget.lookupSyntheticTrace(job.actionId);
  if (!reservation || reservation.actionId !== job.actionId) {
    throw new Error('budget_trace_reservation_missing');
  }
}
