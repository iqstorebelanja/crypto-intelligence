import { Request, Response, Router } from 'express';
import { db } from '../db/schema';
import { subscriptionService } from '../services/subscriptionService';
import { entitlementService } from '../services/entitlementService';
import { User, SubscriptionPlanId } from '../../src/types';

export const subscriptionRouter = Router();

// Helper to extract optional or required authenticated user
function getAuthUser(req: Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  const session = db.getSession(token);
  if (!session) return null;
  return db.users.get(session.userId) || null;
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrative privilege required' });
  }
  (req as any).user = user;
  next();
}

/**
 * GET /api/subscription/plans
 * Public endpoint returning available plans, default currency, and comparison data
 */
subscriptionRouter.get('/plans', async (req, res) => {
  try {
    const plans = await subscriptionService.getAvailablePlans();
    const config = db.getSubscriptionConfig();
    const user = getAuthUser(req);

    // Record pricing viewed analytics if user present
    if (user) {
      entitlementService.recordAnalyticsEvent('PRICING_VIEWED', {
        userId: user.id,
        userTier: user.tier || 'FREE'
      });
    }

    res.json({
      plans,
      defaultCurrency: config.defaultCurrency,
      defaultLocale: config.defaultLocale,
      paymentGatewayReady: config.paymentGatewayReady,
      statusNote: config.statusNote,
      comparison: subscriptionService.getFeatureComparison(),
      serverTime: Date.now()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/subscription/status
 * Returns current user's subscription status, trial detail, and history
 */
subscriptionRouter.get('/status', async (req, res) => {
  try {
    const user = getAuthUser(req);
    const options = await subscriptionService.getUpgradeOptions(user);
    const history = subscriptionService.getSubscriptionHistory(user);
    const trial = user ? entitlementService.getTrialDetails(user) : null;

    res.json({
      ...options,
      trial,
      history,
      serverTime: Date.now()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/subscription/checkout
 * Initiates verified payment gateway checkout session
 */
subscriptionRouter.post('/checkout', async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required to initiate checkout.' });
    }

    const { planId, successUrl, cancelUrl } = req.body;
    const validPlanId: SubscriptionPlanId =
      planId === 'PRO_YEARLY' || planId === 'PRO_MONTHLY'
        ? planId
        : 'PRO_MONTHLY';

    const result = await subscriptionService.startCheckout(user, validPlanId, successUrl, cancelUrl);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/subscription/portal
 * Generates customer billing portal session URL
 */
subscriptionRouter.post('/portal', async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const { returnUrl } = req.body;
    const result = await subscriptionService.getCustomerPortal(user, returnUrl);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/subscription/resume
 * Resumes subscription renewal
 */
subscriptionRouter.post('/resume', async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const result = await subscriptionService.resumeSubscription(user);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancels recurring subscription renewals
 */
subscriptionRouter.post('/cancel', async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { atPeriodEnd } = req.body;
    const result = await subscriptionService.cancelSubscription(user, atPeriodEnd !== false);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/subscription/webhook
 * Idempotent Webhook Receiver for payment provider events
 */
subscriptionRouter.post('/webhook', async (req, res) => {
  try {
    const signature =
      (req.headers['stripe-signature'] as string) ||
      (req.headers['x-provider-signature'] as string) ||
      (req.headers['x-webhook-signature'] as string);

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const result = await subscriptionService.handleWebhook(req.body, signature, rawBody);
    res.json({ received: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/admin/subscription/records
 * Admin listing of all subscriber records
 */
subscriptionRouter.get('/admin/records', requireAdmin, (_req, res) => {
  const records = Array.from(db.subscriptions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  const paymentEvents = db.getPaymentEvents(50);
  res.json({
    count: records.length,
    records,
    recentEvents: paymentEvents
  });
});

/**
 * GET /api/admin/subscription/config
 * Admin configuration retrieval
 */
subscriptionRouter.get('/admin/config', requireAdmin, (_req, res) => {
  res.json({
    config: db.getSubscriptionConfig(),
    recentEvents: db.getSubscriptionEvents().slice(0, 50)
  });
});

/**
 * POST /api/admin/subscription/config
 * Admin configuration update
 */
subscriptionRouter.post('/admin/config', requireAdmin, (req, res) => {
  const adminUser = (req as any).user as User;
  const updated = db.updateSubscriptionConfig(req.body, adminUser.name || adminUser.email);
  db.addAdminAuditLog(adminUser.email, 'SUBSCRIPTION_CONFIG_UPDATED', 'system:subscriptionConfig', {
    updatedBy: adminUser.email,
    newConfig: updated
  });
  res.json({ success: true, config: updated });
});
