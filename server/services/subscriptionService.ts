import {
  User,
  SubscriptionPlanConfig,
  SubscriptionPlanId,
  NormalizedSubscriptionStatus,
  SubscriptionLifecycleState,
  SubscriptionRecord,
  SubscriptionHistoryEvent,
  SubscriptionCheckoutResponse,
  SubscriptionFeatureComparisonItem,
  NormalizedPaymentEventType,
  PaymentEvent
} from '../../src/types';
import { db } from '../db/schema';
import { entitlementService } from './entitlementService';
import {
  PaymentProvider,
  WebPaymentGatewayProvider,
  MockSubscriptionProvider,
  WebhookVerificationResult
} from './subscriptionProvider';

/**
 * Universal Subscription Service (Phase 26)
 *
 * Single source of truth for payment lifecycle, checkout sessions,
 * webhooks idempotency, and server-verified subscription records.
 *
 * CRITICAL RULE:
 * - Frontend NEVER decides subscription status.
 * - Redirect or success URL NEVER directly grants Pro.
 * - ONLY verified server-side subscription state grants Pro entitlement.
 */
export class SubscriptionService {
  private provider: PaymentProvider;
  private gracePeriodDays: number = 3;

  constructor(provider?: PaymentProvider) {
    this.provider = provider || new WebPaymentGatewayProvider();
  }

  public getProvider(): PaymentProvider {
    return this.provider;
  }

  public setProvider(provider: PaymentProvider): void {
    this.provider = provider;
  }

  /**
   * Returns normalized subscription state:
   * FREE | TRIAL | ACTIVE | PAST_DUE | CANCELED | EXPIRED | PAUSED | REFUNDED | PAYMENT_FAILED
   */
  public getSubscriptionStatus(user: User | null): SubscriptionLifecycleState {
    if (!user) return 'FREE';
    if (user.role === 'admin') return 'ACTIVE';

    // 1. Check verified DB subscription record
    const sub = db.getUserSubscription(user.id);
    if (sub) {
      const now = Date.now();
      if (sub.status === 'ACTIVE') return 'ACTIVE';
      if (sub.status === 'CANCELED') {
        return sub.currentPeriodEnd > now ? 'CANCELED' : 'EXPIRED';
      }
      if (sub.status === 'PAST_DUE') {
        const graceEnd = sub.currentPeriodEnd + this.gracePeriodDays * 86400000;
        return now < graceEnd ? 'PAST_DUE' : 'PAYMENT_FAILED';
      }
      return sub.status;
    }

    // 2. Active Trial
    if (entitlementService.isTrialActive(user)) {
      return 'TRIAL';
    }

    // 3. Paid PRO without external provider record (e.g. manual admin override)
    if (user.tier === 'PRO' && user.subscriptionStatus === 'ACTIVE') {
      return 'ACTIVE';
    }

    if (user.subscriptionStatus === 'EXPIRED' || user.trialStatus === 'EXPIRED') {
      return 'EXPIRED';
    }

    return 'FREE';
  }

  /**
   * Returns active subscription record for user
   */
  public getUserSubscription(userId: string): SubscriptionRecord | null {
    return db.getUserSubscription(userId);
  }

  /**
   * Returns current active plan name: 'FREE' | 'PRO'
   */
  public getCurrentPlan(user: User | null): 'FREE' | 'PRO' {
    return entitlementService.getCurrentPlan(user);
  }

  /**
   * Returns feature limits and entitlements dictionary
   */
  public getEntitlements(user: User | null) {
    return entitlementService.getFeatureLimits(user);
  }

  /**
   * Returns list of available subscription plans from authoritative configuration
   */
  public async getAvailablePlans(): Promise<SubscriptionPlanConfig[]> {
    return db.subscriptionConfig.plans.filter(p => p.isActive);
  }

  /**
   * Returns available upgrade options tailored to user's current status
   */
  public async getUpgradeOptions(user: User | null): Promise<{
    currentPlan: 'FREE' | 'PRO';
    status: SubscriptionLifecycleState;
    trialRemainingText?: string;
    isTrial: boolean;
    availablePlans: SubscriptionPlanConfig[];
    recommendedPlanId: SubscriptionPlanId;
    activeSubscription?: SubscriptionRecord | null;
  }> {
    const currentPlan = this.getCurrentPlan(user);
    const status = this.getSubscriptionStatus(user);
    const isTrial = entitlementService.isTrialActive(user);
    const trialRemainingText = isTrial
      ? entitlementService.getTrialDetails(user).remainingDays + ' days remaining'
      : undefined;
    const plans = await this.getAvailablePlans();
    const activeSubscription = user ? this.getUserSubscription(user.id) : null;

    return {
      currentPlan,
      status,
      trialRemainingText,
      isTrial,
      availablePlans: plans.filter(p => p.planId !== 'FREE'),
      recommendedPlanId: 'PRO_YEARLY',
      activeSubscription
    };
  }

  /**
   * Returns complete subscription event history for the given user
   */
  public getSubscriptionHistory(user: User | null): SubscriptionHistoryEvent[] {
    if (!user) return [];
    return db.getSubscriptionEvents(user.id);
  }

  /**
   * Initiates checkout session.
   *
   * CRITICAL SECURITY:
   * - Plan ID and prices are authoritatively determined from server config.
   * - Client cannot supply price or bypass payment.
   * - Returns provider checkout URL.
   */
  public async startCheckout(
    user: User | null,
    planId: SubscriptionPlanId,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<{
    success: boolean;
    sessionId?: string;
    checkoutUrl?: string;
    provider: string;
    message: string;
    paymentProviderStatus: 'READY' | 'NOT_CONFIGURED';
  }> {
    if (!user) {
      throw new Error('Authentication required to initiate subscription checkout.');
    }

    const plans = await this.getAvailablePlans();
    const targetPlan = plans.find(p => p.planId === planId);
    if (!targetPlan || targetPlan.planId === 'FREE') {
      throw new Error(`Requested plan ${planId} is not a valid purchasable tier.`);
    }

    entitlementService.recordAnalyticsEvent('CHECKOUT_OPENED', {
      userId: user.id,
      userTier: user.tier || 'FREE',
      metadata: { planId, price: targetPlan.price, currency: targetPlan.currency }
    });

    if (!this.provider.isConfigured()) {
      return {
        success: false,
        provider: this.provider.id,
        paymentProviderStatus: 'NOT_CONFIGURED',
        message:
          'Payment gateway integration is in NOT_CONFIGURED state on the server. Please configure PAYMENT_GATEWAY_API_KEY / STRIPE_SECRET_KEY in production environment.'
      };
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const finalSuccessUrl = successUrl || `${appUrl}/account?checkout=success`;
    const finalCancelUrl = cancelUrl || `${appUrl}/pricing?checkout=canceled`;

    try {
      const session = await this.provider.createCheckoutSession({
        userId: user.id,
        planId: targetPlan.planId,
        successUrl: finalSuccessUrl,
        cancelUrl: finalCancelUrl,
        customerEmail: user.email
      });

      return {
        success: true,
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        provider: session.provider,
        paymentProviderStatus: 'READY',
        message: 'Checkout session created successfully.'
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.provider.id,
        paymentProviderStatus: this.provider.getStatus(),
        message: err.message
      };
    }
  }

  /**
   * Idempotent Webhook Handler (Phase 26)
   *
   * Verifies cryptographic signature, prevents replay attacks,
   * updates SubscriptionRecord in database, and updates entitlement.
   */
  public async handleWebhook(
    payload: any,
    signature?: string,
    rawBody?: string
  ): Promise<{
    handled: boolean;
    duplicate?: boolean;
    eventType?: NormalizedPaymentEventType;
    subscriptionId?: string;
    userId?: string;
    message?: string;
    error?: string;
  }> {
    // 1. Verify webhook signature & payload structure
    const verification = await this.provider.verifyWebhook(payload, signature, rawBody);
    if (!verification.isValid || !verification.event) {
      throw new Error(verification.error || 'Webhook verification failed.');
    }

    const event = verification.event;

    // 2. Idempotency Check: prevent duplicate processing
    const existing = db.getPaymentEvent(event.provider, event.eventId);
    if (existing && existing.status === 'PROCESSED') {
      return {
        handled: true,
        duplicate: true,
        eventType: event.eventType,
        message: 'Webhook event was already processed previously (Idempotent response).'
      };
    }

    // 3. Record pending event
    const eventRecord: PaymentEvent = {
      provider: event.provider,
      eventId: event.eventId,
      eventType: event.eventType,
      receivedAt: Date.now(),
      processedAt: null,
      status: 'PENDING',
      attempts: (existing?.attempts || 0) + 1,
      userId: event.userId,
      subscriptionId: event.subscriptionId,
      payloadSummary: JSON.stringify({
        status: event.status,
        planId: event.planId,
        amount: event.amount
      })
    };
    db.savePaymentEvent(eventRecord);

    // 4. Resolve Target User
    let targetUser: User | null = null;
    if (event.userId) {
      targetUser = db.users.get(event.userId) || null;
    }
    if (!targetUser && event.customerId) {
      // Find by customerId
      for (const u of db.users.values()) {
        if (u.providerCustomerId === event.customerId) {
          targetUser = u;
          break;
        }
      }
    }

    if (!targetUser) {
      eventRecord.status = 'FAILED';
      eventRecord.error = 'Unable to resolve target user for incoming payment event.';
      db.savePaymentEvent(eventRecord);
      return {
        handled: false,
        error: eventRecord.error
      };
    }

    const now = Date.now();
    const subscriptionId = event.subscriptionId || `sub_${targetUser.id}_${event.provider}`;

    // 5. Update or Create Subscription Record
    const existingSub = db.getSubscription(subscriptionId) || db.getUserSubscription(targetUser.id);
    const subRecord: SubscriptionRecord = {
      id: subscriptionId,
      userId: targetUser.id,
      provider: event.provider,
      providerCustomerId: event.customerId || targetUser.providerCustomerId || `cus_${targetUser.id}`,
      providerSubscriptionId: event.subscriptionId || subscriptionId,
      productId: event.planId || existingSub?.productId || 'PRO_MONTHLY',
      planId: event.planId || existingSub?.planId || 'PRO_MONTHLY',
      status: event.status || 'ACTIVE',
      currency: event.currency || 'USD',
      amount: event.amount || (event.planId === 'PRO_YEARLY' ? 290 : 29),
      billingInterval: event.planId === 'PRO_YEARLY' ? 'year' : 'month',
      currentPeriodStart: event.currentPeriodStart || now,
      currentPeriodEnd: event.currentPeriodEnd || now + 30 * 86400000,
      cancelAtPeriodEnd: Boolean(event.cancelAtPeriodEnd),
      canceledAt: event.status === 'CANCELED' ? now : null,
      createdAt: existingSub?.createdAt || now,
      updatedAt: now
    };

    // Save authoritative subscription record to database
    db.saveSubscription(subRecord);

    // Record subscription history event
    let histType: any = 'SUBSCRIPTION_STARTED';
    if (event.eventType === 'SUBSCRIPTION_RENEWED' || event.eventType === 'PAYMENT_SUCCEEDED') {
      histType = 'SUBSCRIPTION_RENEWED';
    } else if (event.eventType === 'SUBSCRIPTION_CANCELED') {
      histType = 'SUBSCRIPTION_CANCELLED';
    } else if (event.eventType === 'REFUND' || event.status === 'EXPIRED') {
      histType = 'SUBSCRIPTION_EXPIRED';
    }

    db.addSubscriptionEvent({
      userId: targetUser.id,
      eventType: histType,
      plan: subRecord.planId,
      source: 'PAYMENT',
      provider: event.provider,
      providerEventId: event.eventId,
      metadata: { amount: subRecord.amount, currency: subRecord.currency, status: subRecord.status }
    });

    // 6. Mark Event as PROCESSED
    eventRecord.status = 'PROCESSED';
    eventRecord.processedAt = Date.now();
    db.savePaymentEvent(eventRecord);

    db.addAdminAuditLog(
      'webhook_receiver',
      'PROCESS_PAYMENT_WEBHOOK',
      subscriptionId,
      {
        provider: event.provider,
        eventType: event.eventType,
        userId: targetUser.id,
        subscriptionStatus: subRecord.status,
        currentPeriodEnd: subRecord.currentPeriodEnd
      }
    );

    return {
      handled: true,
      duplicate: false,
      eventType: event.eventType,
      subscriptionId,
      userId: targetUser.id,
      message: `Payment event ${event.eventType} processed. Subscription status is now ${subRecord.status}.`
    };
  }

  /**
   * Cancels subscription renewal
   */
  public async cancelSubscription(
    user: User | null,
    atPeriodEnd: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    if (!user) {
      return { success: false, message: 'Authentication required.' };
    }

    const sub = db.getUserSubscription(user.id);
    if (!sub) {
      // Manual/Trial cancel
      user.subscriptionStatus = 'CANCELED';
      db.users.set(user.id, user);
      return {
        success: true,
        message: 'No recurring payment gateway subscription exists. Account status updated.'
      };
    }

    const result = await this.provider.cancelSubscription(sub.id, atPeriodEnd);
    return {
      success: result.success,
      message: result.message
    };
  }

  /**
   * Resumes canceled subscription renewal
   */
  public async resumeSubscription(user: User | null): Promise<{ success: boolean; message: string }> {
    if (!user) {
      return { success: false, message: 'Authentication required.' };
    }

    const sub = db.getUserSubscription(user.id);
    if (!sub) {
      return { success: false, message: 'No active subscription found to resume.' };
    }

    const result = await this.provider.resumeSubscription(sub.id);
    return result;
  }

  /**
   * Customer Billing Portal
   */
  public async getCustomerPortal(user: User | null, returnUrl?: string): Promise<{ portalUrl: string }> {
    if (!user) {
      throw new Error('Authentication required.');
    }
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const finalReturnUrl = returnUrl || `${appUrl}/account`;
    const customerId = user.providerCustomerId || `cus_${user.id}`;
    return this.provider.getCustomerPortal(customerId, finalReturnUrl);
  }

  /**
   * Reusable Feature Comparison Matrix
   */
  public getFeatureComparison(): SubscriptionFeatureComparisonItem[] {
    return [
      {
        feature: 'Basic Market Prices, 24h & Volume',
        category: 'signals',
        freeValue: 'Full Access',
        proValue: 'Full Access',
        freeSupported: true,
        proSupported: true,
        tooltip: 'Real-time spot and perpetual ticker prices across all integrated exchanges.'
      },
      {
        feature: 'BTC & ETH Signal Intelligence',
        category: 'signals',
        freeValue: 'Full Access',
        proValue: 'Full Access',
        freeSupported: true,
        proSupported: true,
        tooltip: 'Institutional directional signal scoring on Bitcoin and Ethereum.'
      },
      {
        feature: '100+ Altcoin Signal Intelligence',
        category: 'signals',
        freeValue: 'Locked',
        proValue: 'Unrestricted',
        freeSupported: false,
        proSupported: true,
        tooltip: 'Full Bull Potential scores, downside risk, and trade evidence on all supported altcoins.'
      },
      {
        feature: 'Multi-Timeframe Confluence (5m - 1D)',
        category: 'signals',
        freeValue: 'Limited',
        proValue: 'Full Matrix',
        freeSupported: 'LIMITED',
        proSupported: true,
        tooltip: 'Tactical trend alignment and conflict scoring across multiple time horizons.'
      },
      {
        feature: 'Market Structure & Breakout Radar',
        category: 'scanner',
        freeValue: 'Basic Levels',
        proValue: 'Sub-second Breakouts',
        freeSupported: 'LIMITED',
        proSupported: true,
        tooltip: 'Automatic swing high/low mapping, CHoCH, and pre-breakout volume accumulation.'
      },
      {
        feature: 'Whale Flow & Radar',
        category: 'intelligence',
        freeValue: 'Locked (BTC/ETH only)',
        proValue: 'All 100+ Assets',
        freeSupported: 'LIMITED',
        proSupported: true,
        tooltip: 'Exchange inflow/outflow alerts and large wallet concentration moves.'
      },
      {
        feature: 'CVD Order Flow & Aggressive Imbalance',
        category: 'intelligence',
        freeValue: 'Locked',
        proValue: 'Full Depth & CVD',
        freeSupported: false,
        proSupported: true,
        tooltip: 'Cumulative Volume Delta divergence and aggressive buyer/seller order flow.'
      },
      {
        feature: 'Liquidation Heatmaps & Squeeze Risk',
        category: 'risk',
        freeValue: 'Locked',
        proValue: 'Live Clusters',
        freeSupported: false,
        proSupported: true,
        tooltip: 'High-leverage liquidation cluster mapping and squeeze probability.'
      },
      {
        feature: 'PRO Alpha Community Forum',
        category: 'tools',
        freeValue: 'Locked (after trial)',
        proValue: 'Full Alpha Channels',
        freeSupported: false,
        proSupported: true,
        tooltip: 'Verified quant trader community with daily 00:00 UTC resets.'
      },
      {
        feature: 'AI Quant Trader',
        category: 'tools',
        freeValue: '10 queries/day + 15s Ad',
        proValue: '100 queries/day (ZERO Ads)',
        freeSupported: 'LIMITED',
        proSupported: true,
        tooltip: 'AI-assisted chart queries and regime analysis without rewarded ad delays.'
      },
      {
        feature: 'Custom Analytical Alerts',
        category: 'tools',
        freeValue: '3 Active Alerts',
        proValue: '25 Active Alerts',
        freeSupported: 'LIMITED',
        proSupported: true,
        tooltip: 'Real-time browser notifications on technical breakouts and score thresholds.'
      }
    ];
  }
}

export const subscriptionService = new SubscriptionService();
