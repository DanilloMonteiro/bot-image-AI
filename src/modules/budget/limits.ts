import type { BudgetCappedCategoryV1 } from '../../contracts/budget/v1.js';

export const BUDGET_TOTAL_CAP_MINOR_V1 = 50_000;

export const BUDGET_CATEGORY_CAPS_MINOR_V1 = {
  advertising: 22_000,
  ai: 11_000,
  railway: 6_500,
  domain_accessories: 2_500,
  meta_pix_fx_retries: 8_000,
} as const satisfies Record<BudgetCappedCategoryV1, number>;

export const BUDGET_CAPPED_CATEGORIES_V1 = Object.keys(
  BUDGET_CATEGORY_CAPS_MINOR_V1,
) as BudgetCappedCategoryV1[];

export function reservationTotalMinor(amountMinor: number, attemptLimit: number): number | null {
  if (!Number.isSafeInteger(amountMinor)
    || amountMinor < 0
    || !Number.isSafeInteger(attemptLimit)
    || attemptLimit < 1) return null;

  const total = amountMinor * attemptLimit;
  return Number.isSafeInteger(total) ? total : null;
}
