import { Budget } from '../../modules/budget/use-cases';
import { PostgresBudgetRepository } from '../postgres/budget-repository';
import { PostgresOrdersPaymentsRepository } from '../postgres/orders-payments-repository';
import { AbacatePayPixGateway } from '../abacatepay/pix-gateway';
import { OrdersPayments } from '../../modules/orders-payments/use-cases';

export function createOrdersPaymentsService(): OrdersPayments {
  return new OrdersPayments({
    repository: new PostgresOrdersPaymentsRepository(),
    budget: new Budget(new PostgresBudgetRepository()),
    gateway: new AbacatePayPixGateway(),
    // Epic 6 has not exposed a readiness port yet; production remains fail-closed.
  });
}
