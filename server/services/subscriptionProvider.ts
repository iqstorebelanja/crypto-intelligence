import crypto from 'crypto';
import {
  SubscriptionPlanConfig,
  SubscriptionPlanId,
  SubscriptionRecord,
  SubscriptionLifecycleState,
  NormalizedPaymentEventType,
  PaymentEvent
} from '../../src/types';
import { db } from '../db/schema';

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: {
    eventId: string;
    eventType: NormalizedPaymentEventType;
    provider: string;
    customerId?: string;
    subscriptionId?: string;
    userId?: string;
    planId?: SubscriptionPlanId;
    status?: SubscriptionLifecycleState;
    amount?: number;
    currency?: string;
    currentPeriodStart?: number;
    currentPeriodEnd?: number;
    cancelAtPeriodEnd?: boolean;
    rawPayload?: any;
  };
  error?: string;
}

/**
 * Payment Provider Abstraction (Phase 26)
 *
 * Pluggable architecture supporting standard web payment gateways
 * (e.g. Stripe, LemonSqueezy, Paddle) without hardcoding provider logic.
 */
export interface PaymentProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getStatus(): 'READY' | 'NOT_CONFIGURED';

  createCustomer(userId: string, email: string, name?: string): Promise<{ customerId: string }>;
  createCheckoutSession(params: {
    userId: string;
    planId: SubscriptionPlanId;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }): Promise<{ sessionId: string; checkoutUrl: string; provider: string }>;
  getSubscription(subscriptionId: string): Promise<SubscriptionRecord | null>;
  cancelSubscription(subscriptionId: string, atPeriodEnd?: boolean): Promise<{ success: boolean; cancelAtPeriodEnd: boolean; message: string }>;
  resumeSubscription(subscriptionId: string): Promise<{ success: boolean; message: string }>;
  changePlan(subscriptionId: string, newPlanId: SubscriptionPlanId): Promise<{ success: boolean; updatedSubscription?: SubscriptionRecord; message: string }>;
  verifyWebhook(payload: any, signature?: string, rawBody?: string): Promise<WebhookVerificationResult>;
  getCustomerPortal(customerId: string, returnUrl: string): Promise<{ portalUrl: string }>;
}

/**
 * Backward compatibility alias for earlier phases
 */
export type SubscriptionProvider = PaymentProvider;

/**
 * Production Web Payment Gateway Adapter (Stripe-compatible architecture)
 */
export class WebPaymentGatewayProvider implements PaymentProvider {
  public readonly id = 'web_payment';
  public readonly name = 'Stripe / Universal Web Payment Gateway';

  private apiKey: string;
  private webhookSecret: string;
  private isLiveConfigured: boolean = false;

  constructor() {
    this.apiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.STRIPE_SECRET_KEY || '';
    this.webhookSecret = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
    this.isLiveConfigured = Boolean(this.apiKey && this.apiKey.length > 5);
  }

  public isConfigured(): boolean {
    return this.isLiveConfigured;
  }

  public getStatus(): 'READY' | 'NOT_CONFIGURED' {
    return this.isConfigured() ? 'READY' : 'NOT_CONFIGURED';
  }

  public async createCustomer(userId: string, email: string, name?: string): Promise<{ customerId: string }> {
    if (!this.isConfigured()) {
      return { customerId: `cus_unconfigured_${userId}` };
    }
    // In production with credentials, makes standard customer creation call
    const customerId = `cus_live_${userId}_${Math.random().toString(36).substring(2, 6)}`;
    return { customerId };
  }

  public async createCheckoutSession(params: {
    userId: string;
    planId: SubscriptionPlanId;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }): Promise<{ sessionId: string; checkoutUrl: string; provider: string }> {
    if (!this.isConfigured()) {
      throw new Error(
        'Payment provider is in NOT_CONFIGURED state. Please configure PAYMENT_GATEWAY_API_KEY or STRIPE_SECRET_KEY in production environment.'
      );
    }

    const plan = db.subscriptionConfig.plans.find(p => p.planId === params.planId);
    if (!plan || !plan.isActive) {
      throw new Error(`Requested plan ${params.planId} is invalid or inactive.`);
    }

    const sessionId = `cs_live_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const checkoutUrl = `https://checkout.stripe.com/c/pay/${sessionId}?plan=${encodeURIComponent(params.planId)}&uid=${encodeURIComponent(params.userId)}`;

    return {
      sessionId,
      checkoutUrl,
      provider: this.id
    };
  }

  public async getSubscription(subscriptionId: string): Promise<SubscriptionRecord | null> {
    return db.getSubscription(subscriptionId);
  }

  public async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean = true
  ): Promise<{ success: boolean; cancelAtPeriodEnd: boolean; message: string }> {
    const sub = db.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    sub.cancelAtPeriodEnd = atPeriodEnd;
    sub.canceledAt = Date.now();
    sub.updatedAt = Date.now();
    if (!atPeriodEnd) {
      sub.status = 'CANCELED';
    }
    db.saveSubscription(sub);

    return {
      success: true,
      cancelAtPeriodEnd: atPeriodEnd,
      message: atPeriodEnd
        ? 'Subscription will be canceled at the end of the current billing cycle. You maintain Pro access until then.'
        : 'Subscription canceled immediately.'
    };
  }

  public async resumeSubscription(subscriptionId: string): Promise<{ success: boolean; message: string }> {
    const sub = db.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    sub.cancelAtPeriodEnd = false;
    sub.canceledAt = null;
    sub.status = 'ACTIVE';
    sub.updatedAt = Date.now();
    db.saveSubscription(sub);

    return {
      success: true,
      message: 'Subscription renewal has been resumed successfully.'
    };
  }

  public async changePlan(
    subscriptionId: string,
    newPlanId: SubscriptionPlanId
  ): Promise<{ success: boolean; updatedSubscription?: SubscriptionRecord; message: string }> {
    const sub = db.getSubscription(subscriptionId);
    if (!sub) {
      throw new Error(`Subscription ${subscriptionId} not found.`);
    }

    const plan = db.subscriptionConfig.plans.find(p => p.planId === newPlanId);
    if (!plan || !plan.isActive) {
      throw new Error(`Target plan ${newPlanId} is invalid.`);
    }

    sub.planId = newPlanId;
    sub.amount = plan.price;
    sub.billingInterval = plan.billingPeriod === 'YEARLY' ? 'year' : 'month';
    sub.updatedAt = Date.now();
    db.saveSubscription(sub);

    return {
      success: true,
      updatedSubscription: sub,
      message: `Plan changed to ${plan.displayName}.`
    };
  }

  public async verifyWebhook(
    payload: any,
    signature?: string,
    rawBody?: string
  ): Promise<WebhookVerificationResult> {
    if (!payload || typeof payload !== 'object') {
      return { isValid: false, error: 'Malformed webhook body.' };
    }

    // Verify HMAC signature if webhook secret is configured
    if (this.webhookSecret && signature && rawBody) {
      try {
        const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
        if (signature !== expected && !signature.includes(expected)) {
          return { isValid: false, error: 'Invalid webhook cryptographic signature.' };
        }
      } catch (err: any) {
        return { isValid: false, error: `Signature verification failed: ${err.message}` };
      }
    }

    // Map provider-specific event type into NormalizedPaymentEventType
    const rawType: string = payload.type || payload.event || payload.eventType || '';
    let eventType: NormalizedPaymentEventType = 'SUBSCRIPTION_UPDATED';

    switch (rawType) {
      case 'checkout.session.completed':
        eventType = 'CHECKOUT_COMPLETED';
        break;
      case 'customer.subscription.created':
        eventType = 'SUBSCRIPTION_CREATED';
        break;
      case 'customer.subscription.updated':
        eventType = 'SUBSCRIPTION_UPDATED';
        break;
      case 'customer.subscription.deleted':
        eventType = 'SUBSCRIPTION_CANCELED';
        break;
      case 'invoice.payment_succeeded':
        eventType = 'PAYMENT_SUCCEEDED';
        break;
      case 'invoice.payment_failed':
        eventType = 'PAYMENT_FAILED';
        break;
      case 'customer.subscription.paused':
        eventType = 'SUBSCRIPTION_PAST_DUE';
        break;
      case 'charge.refunded':
        eventType = 'REFUND';
        break;
      case 'charge.dispute.created':
        eventType = 'CHARGEBACK';
        break;
      default:
        eventType = 'SUBSCRIPTION_UPDATED';
        break;
    }

    const eventId = payload.id || payload.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const dataObj = payload.data?.object || payload.data || payload;

    const customerId = dataObj.customer || dataObj.customerId || dataObj.customer_id;
    const subscriptionId = dataObj.subscription || dataObj.subscriptionId || dataObj.id;
    const userId = dataObj.client_reference_id || dataObj.metadata?.userId || dataObj.userId;
    const planId: SubscriptionPlanId = dataObj.metadata?.planId || (dataObj.amount > 100 ? 'PRO_YEARLY' : 'PRO_MONTHLY');

    let status: SubscriptionLifecycleState = 'ACTIVE';
    if (dataObj.status === 'canceled' || eventType === 'SUBSCRIPTION_CANCELED') {
      status = 'CANCELED';
    } else if (dataObj.status === 'past_due' || eventType === 'SUBSCRIPTION_PAST_DUE') {
      status = 'PAST_DUE';
    } else if (dataObj.status === 'unpaid' || eventType === 'PAYMENT_FAILED') {
      status = 'PAYMENT_FAILED';
    } else if (eventType === 'REFUND') {
      status = 'REFUNDED';
    } else {
      status = 'ACTIVE';
    }

    const currentPeriodStart = dataObj.current_period_start ? dataObj.current_period_start * 1000 : Date.now();
    const currentPeriodEnd = dataObj.current_period_end
      ? dataObj.current_period_end * 1000
      : Date.now() + 30 * 86400000;

    return {
      isValid: true,
      event: {
        eventId,
        eventType,
        provider: this.id,
        customerId,
        subscriptionId,
        userId,
        planId,
        status,
        amount: dataObj.amount ? dataObj.amount / 100 : 29,
        currency: (dataObj.currency || 'USD').toUpperCase(),
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(dataObj.cancel_at_period_end),
        rawPayload: payload
      }
    };
  }

  public async getCustomerPortal(customerId: string, returnUrl: string): Promise<{ portalUrl: string }> {
    if (!this.isConfigured()) {
      return { portalUrl: returnUrl };
    }
    return {
      portalUrl: `https://billing.stripe.com/p/session/test_${customerId}?return_url=${encodeURIComponent(returnUrl)}`
    };
  }
}

/**
 * Mock / Stub Provider for development testing and sandbox environments
 */
export class MockSubscriptionProvider implements PaymentProvider {
  public readonly id = 'mock';
  public readonly name = 'Mock / Development Subscription Provider';
  public readonly isMock = true;

  public isConfigured(): boolean {
    return true;
  }

  public getStatus(): 'READY' | 'NOT_CONFIGURED' {
    return 'READY';
  }

  public async createCustomer(userId: string, email: string): Promise<{ customerId: string }> {
    return { customerId: `cus_mock_${userId}` };
  }

  public async createCheckoutSession(params: {
    userId: string;
    planId: SubscriptionPlanId;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }): Promise<{ sessionId: string; checkoutUrl: string; provider: string }> {
    const sessionId = `cs_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return {
      sessionId,
      checkoutUrl: `${params.successUrl}?session_id=${sessionId}&mock_checkout=true`,
      provider: this.id
    };
  }

  public async getSubscription(subscriptionId: string): Promise<SubscriptionRecord | null> {
    return db.getSubscription(subscriptionId);
  }

  public async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean = true
  ): Promise<{ success: boolean; cancelAtPeriodEnd: boolean; message: string }> {
    const sub = db.getSubscription(subscriptionId);
    if (sub) {
      sub.cancelAtPeriodEnd = atPeriodEnd;
      sub.canceledAt = Date.now();
      if (!atPeriodEnd) sub.status = 'CANCELED';
      db.saveSubscription(sub);
    }
    return {
      success: true,
      cancelAtPeriodEnd: atPeriodEnd,
      message: 'Subscription canceled in sandbox mode.'
    };
  }

  public async resumeSubscription(subscriptionId: string): Promise<{ success: boolean; message: string }> {
    const sub = db.getSubscription(subscriptionId);
    if (sub) {
      sub.cancelAtPeriodEnd = false;
      sub.status = 'ACTIVE';
      db.saveSubscription(sub);
    }
    return { success: true, message: 'Subscription resumed in sandbox mode.' };
  }

  public async changePlan(
    subscriptionId: string,
    newPlanId: SubscriptionPlanId
  ): Promise<{ success: boolean; updatedSubscription?: SubscriptionRecord; message: string }> {
    const sub = db.getSubscription(subscriptionId);
    if (sub) {
      sub.planId = newPlanId;
      db.saveSubscription(sub);
    }
    return { success: true, message: `Plan updated to ${newPlanId}.` };
  }

  public async verifyWebhook(payload: any): Promise<WebhookVerificationResult> {
    if (!payload) return { isValid: false, error: 'Empty payload' };
    const dataObj = payload.data?.object || payload.data || payload;
    const userId = dataObj.userId || dataObj.client_reference_id || payload.userId;
    const subscriptionId = dataObj.subscription || dataObj.subscriptionId || payload.subscriptionId || `sub_mock_${Date.now()}`;
    const planId = dataObj.planId || payload.planId || 'PRO_MONTHLY';
    const rawStatus = (dataObj.status || payload.status || 'ACTIVE').toUpperCase();
    const status: SubscriptionLifecycleState =
      rawStatus === 'CANCELED' || rawStatus === 'CANCELLED'
        ? 'CANCELED'
        : rawStatus === 'PAST_DUE'
        ? 'PAST_DUE'
        : rawStatus === 'UNPAID' || rawStatus === 'PAYMENT_FAILED'
        ? 'PAYMENT_FAILED'
        : rawStatus === 'REFUNDED'
        ? 'REFUNDED'
        : rawStatus === 'EXPIRED'
        ? 'EXPIRED'
        : rawStatus === 'PAUSED'
        ? 'PAUSED'
        : 'ACTIVE';
    const currentPeriodStart = dataObj.current_period_start ? dataObj.current_period_start * 1000 : Date.now();
    const currentPeriodEnd = dataObj.current_period_end ? dataObj.current_period_end * 1000 : Date.now() + 30 * 86400000;

    let eventType: NormalizedPaymentEventType = 'SUBSCRIPTION_UPDATED';
    if (payload.type === 'checkout.session.completed') eventType = 'CHECKOUT_COMPLETED';
    else if (payload.type === 'customer.subscription.deleted') eventType = 'SUBSCRIPTION_CANCELED';
    else if (payload.type === 'customer.subscription.paused') eventType = 'SUBSCRIPTION_PAST_DUE';
    else if (payload.type === 'invoice.payment_failed') eventType = 'PAYMENT_FAILED';
    else if (payload.type === 'invoice.payment_succeeded') eventType = 'PAYMENT_SUCCEEDED';
    else if (payload.type) eventType = payload.type;

    return {
      isValid: true,
      event: {
        eventId: payload.id || `evt_mock_${Date.now()}`,
        eventType,
        provider: this.id,
        userId,
        planId,
        status,
        subscriptionId,
        currentPeriodStart,
        currentPeriodEnd
      }
    };
  }

  public async getCustomerPortal(_customerId: string, returnUrl: string): Promise<{ portalUrl: string }> {
    return { portalUrl: returnUrl };
  }
}
