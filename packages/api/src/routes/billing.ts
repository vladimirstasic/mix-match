import { Router, type Request, type Response } from 'express';
import { eq, and, ne, sql } from 'drizzle-orm';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { PLANS, PLAN_LIMITS, FOUNDING_MEMBER_SEATS, type Plan } from '@mix-match/shared';
import { requireUser, getUserId } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { findUser } from '../db/helpers.js';
import { config } from '../config.js';
import { polar, productIdForPlan, planForProductId } from '../services/polar.js';

export const billingRouter = Router();

async function countFoundingMembers(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.isFoundingMember, true), ne(users.plan, PLANS.FREE)));
  return Number(row?.count ?? 0);
}

billingRouter.get('/billing/founding-status', async (_req, res) => {
  const count = await countFoundingMembers();
  res.json({
    totalSeats: FOUNDING_MEMBER_SEATS,
    seatsRemaining: Math.max(0, FOUNDING_MEMBER_SEATS - count),
    isSoldOut: count >= FOUNDING_MEMBER_SEATS,
  });
});

billingRouter.post('/billing/checkout', requireUser, async (req, res) => {
  const userId = getUserId(req);
  const plan = req.body?.plan;

  if (plan !== PLANS.PRO && plan !== PLANS.STUDIO) {
    res.status(400).json({ error: 'Invalid plan' });
    return;
  }

  const productId = productIdForPlan(plan);
  if (!productId) {
    res.status(500).json({ error: 'Polar product not configured for plan' });
    return;
  }

  await db.insert(users).values({ clerkId: userId }).onConflictDoNothing();
  const user = await findUser(userId);

  const isAlreadyFounding = user?.isFoundingMember === true;
  if (!isAlreadyFounding) {
    const count = await countFoundingMembers();
    if (count >= FOUNDING_MEMBER_SEATS) {
      res.status(403).json({
        error: 'Founding member seats are sold out. Contact hello@mixmatch.com for waitlist.',
        code: 'FOUNDING_SOLD_OUT',
      });
      return;
    }
  }

  const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl: `${config.frontendUrl}/account?checkout=success`,
    externalCustomerId: userId,
    metadata: { userId },
  });

  res.json({ url: checkout.url });
});

billingRouter.post('/billing/portal', requireUser, async (req, res) => {
  const userId = getUserId(req);
  const user = await findUser(userId);

  if (!user?.billingCustomerId) {
    res.status(400).json({ error: 'No billing account found. Subscribe to a plan first.' });
    return;
  }

  const session = await polar.customerSessions.create({
    customerId: user.billingCustomerId,
  });

  res.json({ url: session.customerPortalUrl });
});

interface PolarSubscriptionData {
  id: string;
  status: string;
  customerId: string;
  metadata?: Record<string, unknown> | null;
  productId?: string;
  product?: { id: string };
}

async function applySubscriptionToUser(subscription: PolarSubscriptionData) {
  const userId = (subscription.metadata?.userId as string | undefined) ?? undefined;
  if (!userId) {
    console.warn('[polar:webhook] subscription without userId metadata', subscription.id);
    return;
  }

  const productId = subscription.productId ?? subscription.product?.id;
  const planFromProduct = (productId && planForProductId(productId)) || PLANS.FREE;
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const resolvedPlan: Plan = isActive ? planFromProduct : PLANS.FREE;
  const limits = PLAN_LIMITS[resolvedPlan];

  const updateData: Record<string, unknown> = {
    plan: resolvedPlan,
    billingCustomerId: subscription.customerId,
    creditsRemaining: limits.scans,
    creditsResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };

  if (isActive) {
    updateData.isFoundingMember = true;
  }

  await db.update(users).set(updateData).where(eq(users.clerkId, userId));
  console.log(`[polar:webhook] user ${userId} → plan ${resolvedPlan} (sub ${subscription.id})`);
}

export async function billingWebhookHandler(req: Request, res: Response) {
  let event;
  try {
    event = validateEvent(req.body, req.headers as Record<string, string>, config.polar.webhookSecret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      console.error('[polar:webhook] signature verification failed:', err.message);
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
    throw err;
  }

  try {
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.active':
      case 'subscription.updated':
      case 'subscription.uncanceled':
        await applySubscriptionToUser(event.data as unknown as PolarSubscriptionData);
        break;
      case 'subscription.canceled':
      case 'subscription.revoked':
        await applySubscriptionToUser({
          ...(event.data as unknown as PolarSubscriptionData),
          status: 'canceled',
        });
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[polar:webhook] handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
