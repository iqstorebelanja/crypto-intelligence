import {
  SubscriptionPlanConfig,
  SubscriptionPlanId,
  NormalizedSubscriptionStatus,
  SubscriptionCheckoutResponse,
  SubscriptionFeatureComparisonItem,
  User
} from '../types';
import { clientEntitlementService } from './entitlementService';

/**
 * Client-Side Subscription & Pricing Service (Phase 16)
 *
 * Provides formatters, feature comparison definitions, and safe checkout stubs.
 */
export function formatCurrency(
  price: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: price % 1 === 0 ? 0 : 2
    }).format(price);
  } catch {
    return `$${price}`;
  }
}

export class ClientSubscriptionService {
  /**
   * Formats a plan price with its billing period suffix
   */
  public getPriceDisplay(plan: SubscriptionPlanConfig): { formattedPrice: string; periodLabel: string } {
    const formatted = formatCurrency(plan.price, plan.currency, plan.locale || 'en-US');
    let periodLabel = '';
    if (plan.billingPeriod === 'MONTHLY') {
      periodLabel = '/month';
    } else if (plan.billingPeriod === 'YEARLY') {
      periodLabel = '/year';
    } else if (plan.billingPeriod === 'FREE') {
      periodLabel = 'Forever Free';
    }
    return { formattedPrice: formatted, periodLabel };
  }

  /**
   * Returns normalized user subscription status
   */
  public getNormalizedStatus(user: User | null): NormalizedSubscriptionStatus {
    if (!user) return 'FREE';
    if (user.role === 'admin') return 'PRO_ACTIVE';
    if (clientEntitlementService.isTrialActive(user)) return 'TRIAL';
    if (clientEntitlementService.isPro(user)) return 'PRO_ACTIVE';
    if (user.trialStatus === 'EXPIRED') return 'PRO_EXPIRED';
    return 'FREE';
  }

  public getSubscriptionStatus(user: User | null): NormalizedSubscriptionStatus {
    return this.getNormalizedStatus(user);
  }

  public getCurrentPlan(user: User | null): 'FREE' | 'PRO' {
    return clientEntitlementService.getCurrentPlan(user);
  }

  public getEntitlements(user: User | null) {
    const isPro = clientEntitlementService.isPro(user);
    const isTrial = clientEntitlementService.isTrialActive(user);
    return {
      isPro,
      isTrial,
      plan: isPro ? 'PRO' : 'FREE',
      canAccessAllSignals: isPro,
      canAccessCommunity: isPro,
      canAccessWhaleRadar: isPro,
      canAccessOrderFlow: isPro,
      maxWatchlistAssets: isPro ? 100 : 5,
      maxAlerts: isPro ? 25 : 3,
      aiTraderRequiresAd: !isPro
    };
  }

  public async getAvailablePlans(): Promise<SubscriptionPlanConfig[]> {
    try {
      const res = await fetch('/api/subscription/plans');
      if (res.ok) {
        const data = await res.json();
        if (data.plans) return data.plans;
      }
    } catch {
      // fallback
    }
    return [];
  }

  public async getUpgradeOptions(user: User | null) {
    try {
      const res = await fetch('/api/subscription/status');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    const currentPlan = this.getCurrentPlan(user);
    const status = this.getSubscriptionStatus(user);
    return {
      currentPlan,
      status,
      isTrial: status === 'TRIAL'
    };
  }

  public async getSubscriptionHistory(user: User | null) {
    if (!user) return [];
    try {
      const res = await fetch('/api/subscription/status');
      if (res.ok) {
        const data = await res.json();
        return data.history || [];
      }
    } catch {
      // fallback
    }
    return [];
  }

  /**
   * Feature comparison matrix for Pricing page and Upgrade modals
   */
  public getFeatureComparison(): SubscriptionFeatureComparisonItem[] {
    return [
      {
        feature: 'Basic Market Prices & 24h Volume',
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

  /**
   * Safe Checkout Initiation
   */
  public async initiateCheckout(
    planId: SubscriptionPlanId,
    token: string | null
  ): Promise<SubscriptionCheckoutResponse> {
    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ planId })
      });
      if (!res.ok) {
        throw new Error(`Checkout endpoint returned HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        planId,
        planName: planId === 'PRO_YEARLY' ? 'PRO Annual' : 'PRO Monthly',
        price: planId === 'PRO_YEARLY' ? 290 : 29,
        currency: 'USD',
        message: err.message || 'Payment integration is being prepared. Your account has not been charged.',
        isDemoMode: true,
        paymentProviderStatus: 'NOT_CONFIGURED',
        accountCharged: false,
        checkoutTimestamp: Date.now()
      };
    }
  }
  public async startCheckout(
    planId: SubscriptionPlanId,
    token?: string | null
  ): Promise<SubscriptionCheckoutResponse> {
    return this.initiateCheckout(planId, token || null);
  }

  public async restoreSubscription(
    token?: string | null
  ): Promise<{ success: boolean; message: string; restoredCount: number }> {
    try {
      const res = await fetch('/api/subscription/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }
    return {
      success: true,
      message: 'No external billing receipts found. Real payment provider is not yet attached.',
      restoredCount: 0
    };
  }

  public async cancelSubscription(
    token?: string | null
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) return await res.json();
    } catch {
      // fallback
    }
    return {
      success: true,
      message: 'No recurring payment provider subscription exists to cancel.'
    };
  }
}

export const clientSubscriptionService = new ClientSubscriptionService();
export const SubscriptionService = ClientSubscriptionService;
