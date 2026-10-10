import { User, UserTrialInfo } from '../types';

/**
  * Centralized Client-Side Entitlement Service (Phase 15)
  * All frontend feature gates must use this entitlement logic consistently.
  * Server timestamps and API responses remain authoritative.
  */
export function isFreeAllowedSymbol(symbol: string, allowedList: string[] = ['BTC', 'ETH']): boolean {
  if (!symbol) return false;
  const upper = symbol.toUpperCase();
  const clean = upper.replace(/[\/\-_]/g, '').replace(/USDT|USD|BUSD|USDC|EUR/g, '');
  for (const allowed of allowedList) {
    const cleanAllowed = allowed.toUpperCase().replace(/[\/\-_]/g, '').replace(/USDT|USD|BUSD|USDC|EUR/g, '');
    if (clean === cleanAllowed || upper.startsWith(`${allowed}/`) || upper.startsWith(`${allowed}-`) || upper.startsWith(allowed)) {
      return true;
    }
  }
  return false;
}

export class ClientEntitlementService {
  /**
   * Evaluates if user currently has active PRO entitlement
   */
  public isPro(user: User | null): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;

    // Check paid PRO
    if (user.tier === 'PRO' && user.trialStatus !== 'ACTIVE') {
      if (user.proExpiresAt && user.proExpiresAt < Date.now()) {
        return false;
      }
      return true;
    }

    // Check active 7-day trial
    if (user.trialStatus === 'ACTIVE') {
      const trialEndsAt = user.trialEndsAt ?? (user.trialStartedAt ? user.trialStartedAt + 7 * 86400000 : Date.now());
      return trialEndsAt > Date.now();
    }

    return Boolean(user.isPro);
  }

  /**
   * Checks if user is currently inside their 7-day PRO trial
   */
  public isTrialActive(user: User | null): boolean {
    if (!user || user.role === 'admin') return false;
    if (user.trialStatus !== 'ACTIVE') return false;
    const trialEndsAt = user.trialEndsAt ?? (user.trialStartedAt ? user.trialStartedAt + 7 * 86400000 : Date.now());
    return trialEndsAt > Date.now();
  }

  /**
   * Returns current active plan name ('FREE' | 'PRO')
   */
  public getCurrentPlan(user: User | null): 'FREE' | 'PRO' {
    return this.isPro(user) ? 'PRO' : 'FREE';
  }

  /**
   * Checks feature access
   */
  public canAccessFeature(user: User | null, feature: string): boolean {
    return this.isPro(user);
  }

  /**
   * Checks if user can access full signal intelligence for a given symbol.
   * Free users retain BTC & ETH. Other symbols require PRO.
   */
  public canAccessSignal(user: User | null, symbol: string, allowedSymbols: string[] = ['BTC', 'ETH']): boolean {
    if (this.isPro(user)) return true;
    return isFreeAllowedSymbol(symbol, allowedSymbols);
  }

  /**
   * Checks access to specific premium field
   */
  public canAccessPremiumField(user: User | null, _field: string, symbol: string): boolean {
    return this.canAccessSignal(user, symbol);
  }

  /**
   * Checks if user can access Community Forum
   */
  public canAccessCommunity(user: User | null): boolean {
    return this.isPro(user);
  }

  /**
   * Checks AI Trader requirements (ad gate required for FREE; PRO/trial exempt)
   */
  public canUseAITrader(user: User | null): { allowed: boolean; requiresAd: boolean; isPro: boolean } {
    const isPro = this.isPro(user);
    return {
      allowed: true,
      requiresAd: !isPro,
      isPro
    };
  }

  /**
   * Computes human-readable remaining trial time
   */
  public getTrialRemainingText(user: User | null, now: number = Date.now()): string {
    if (!user || user.role === 'admin') return '';
    if (user.trialStatus !== 'ACTIVE') {
      return user.trialStatus === 'EXPIRED' ? 'Trial Expired' : '';
    }

    const trialEndsAt = user.trialEndsAt ?? (user.trialStartedAt ? user.trialStartedAt + 7 * 86400000 : now);
    const diff = trialEndsAt - now;

    if (diff <= 0) {
      return 'Trial Expired';
    }

    const totalHours = Math.floor(diff / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (days >= 1) {
      return `${days} ${days === 1 ? 'day' : 'days'} remaining`;
    }

    if (hours >= 1) {
      return `${hours}h ${minutes}m remaining`;
    }

    return `${minutes}m remaining`;
  }

  /**
   * Computes standardized UserTrialInfo
   */
  public getTrialDetails(user: User | null, now: number = Date.now()): UserTrialInfo {
    const isPro = this.isPro(user);
    const isTrial = this.isTrialActive(user);
    const trialStartedAt = user?.trialStartedAt ?? null;
    const trialEndsAt = user?.trialEndsAt ?? null;
    const remainingMs = trialEndsAt && trialEndsAt > now ? trialEndsAt - now : 0;
    const remainingDays = Math.ceil(remainingMs / 86400000);
    const remainingHours = Math.ceil(remainingMs / 3600000);

    let trialStatus: 'ACTIVE' | 'EXPIRED' | 'NONE' = 'NONE';
    if (user?.trialStatus === 'ACTIVE') {
      trialStatus = remainingMs > 0 ? 'ACTIVE' : 'EXPIRED';
    } else if (user?.trialStatus === 'EXPIRED') {
      trialStatus = 'EXPIRED';
    }

    return {
      plan: isPro ? 'PRO' : 'FREE',
      trialStatus,
      trialStartedAt,
      trialEndsAt,
      remainingMs,
      remainingDays,
      remainingHours,
      isTrialActive: isTrial,
      isExpired: trialStatus === 'EXPIRED',
      serverTime: now
    };
  }
}

export const clientEntitlementService = new ClientEntitlementService();
