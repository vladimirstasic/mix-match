import { Polar } from '@polar-sh/sdk';
import { PLANS, type Plan } from '@mix-match/shared';
import { config } from '../config.js';

export const polar = new Polar({
  accessToken: config.polar.accessToken,
  server: config.polar.environment,
});

export function productIdForPlan(plan: Plan): string | null {
  if (plan === PLANS.PRO) return config.polar.productIdPro || null;
  if (plan === PLANS.STUDIO) return config.polar.productIdStudio || null;
  return null;
}

export function planForProductId(productId: string): Plan | null {
  if (productId === config.polar.productIdPro) return PLANS.PRO;
  if (productId === config.polar.productIdStudio) return PLANS.STUDIO;
  return null;
}
