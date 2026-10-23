type GateEnvironment = Record<string, string | undefined>;

const REQUIRED_APPROVALS = [
  'PRODUCTION_PRIVACY_APPROVED',
  'PRODUCTION_COST_RECONCILED',
  'PRODUCTION_BACKUP_RESTORE_VERIFIED',
  'PRODUCTION_COST_ALERTS_60_80_95_VERIFIED',
  'PRODUCTION_COMPUTE_HARD_LIMIT_VERIFIED',
  'PRODUCTION_COST_PAUSE_AUTHORITY_VERIFIED',
] as const;

const SMOKE_TASK_PATH = /^\/api\/internal\/smoke\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/retry)?$/i;

export function isProductionCustomerMediaTrafficApproved(
  environment: GateEnvironment = process.env,
): boolean {
  return environment.PLATFORM_ENVIRONMENT === 'production'
    && REQUIRED_APPROVALS.every((name) => environment[name] === 'true');
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
    || SMOKE_TASK_PATH.test(pathname)
  ) {
    return true;
  }
  return /^\/api\/(?:customer|customers|media)(?:\/|$)/i.test(pathname)
    && !shouldBlockCustomerMediaPath(pathname, environment);
}
