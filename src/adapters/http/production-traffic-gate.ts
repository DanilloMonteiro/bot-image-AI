type GateEnvironment = Record<string, string | undefined>;

const REQUIRED_APPROVALS = [
  'PRODUCTION_PRIVACY_APPROVED',
  'PRODUCTION_COST_RECONCILED',
  'PRODUCTION_BACKUP_RESTORE_VERIFIED',
  'PRODUCTION_COST_ALERTS_60_80_95_VERIFIED',
  'PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED',
  'PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED',
] as const;

const PRODUCTION_PIX_APPROVALS = [
  'ORDERS_PIX_PRODUCTION_ENABLED',
  'PRODUCTION_OFFER_APPROVED',
  'PRODUCTION_BUDGET_RECONCILED',
  'PRODUCTION_FULFILLMENT_READY',
  'PRODUCTION_PIX_ACCOUNT_VERIFIED',
  'PRODUCTION_PIX_WEBHOOK_VERIFIED',
  'PRODUCTION_PIX_MANUAL_TEST_VERIFIED',
  'PRODUCTION_PIX_RECONCILIATION_READY',
  'PRODUCTION_PAYMENT_RETENTION_APPROVED',
] as const;

const SMOKE_TASK_PATH = /^\/api\/internal\/smoke\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/retry)?$/i;
const ORDER_TASK_PATH = /^\/api\/internal\/orders(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/(?:pix|simulate-pix|reconcile))?)?$/i;
const ORPHAN_ORDER_TASK_PATH = /^\/api\/internal\/orders\/(?:unmatched-events|reconcile-unmatched)$/i;

export function isProductionCustomerMediaTrafficApproved(
  environment: GateEnvironment = process.env,
): boolean {
  return environment.PLATFORM_ENVIRONMENT === 'production'
    && REQUIRED_APPROVALS.every((name) => environment[name] === 'true');
}

export function isProductionPixTrafficApproved(
  environment: GateEnvironment = process.env,
): boolean {
  return environment.PLATFORM_ENVIRONMENT === 'production'
    && REQUIRED_APPROVALS.every((name) => environment[name] === 'true')
    && PRODUCTION_PIX_APPROVALS.every((name) => environment[name] === 'true');
}

export function shouldBlockCustomerMediaPath(
  pathname: string,
  environment: GateEnvironment = process.env,
): boolean {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (!/^\/api\/(?:customer|customers|media)(?:\/|$)/i.test(normalizedPath)) return false;
  return !isProductionCustomerMediaTrafficApproved(environment);
}

export function isPublicStoryPath(
  pathname: string,
  environment: GateEnvironment = process.env,
): boolean {
  if (
    pathname === '/api/health'
    || pathname === '/api/internal/smoke'
    || pathname === '/api/internal/budget/trace'
    || pathname === '/api/webhooks/abacatepay'
    || ORDER_TASK_PATH.test(pathname)
    || ORPHAN_ORDER_TASK_PATH.test(pathname)
    || SMOKE_TASK_PATH.test(pathname)
  ) {
    return true;
  }
  return /^\/api\/(?:customer|customers|media)(?:\/|$)/i.test(pathname)
    && !shouldBlockCustomerMediaPath(pathname, environment);
}
