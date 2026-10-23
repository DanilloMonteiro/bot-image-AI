import { PostgresBudgetRepository } from '@/adapters/postgres/budget-repository';
import { handleBudgetTraceRequest } from '@/adapters/http/budget-trace-handler';
import { Budget } from '@/modules/budget/use-cases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const budget = new Budget(new PostgresBudgetRepository());
  return handleBudgetTraceRequest(request, (actionId) => budget.reserveSyntheticTrace(actionId));
}
