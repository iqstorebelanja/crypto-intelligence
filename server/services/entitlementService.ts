import { Request, Response, NextFunction } from 'express';
import {
  User,
  NormalizedCoinData,
  MarketSignal,
  UserTrialInfo,
  EntitlementAnalyticsEvent,
  EntitlementAnalyticsEventType
} from '../../src/types';
import { db } from '../db/schema';

export interface EntitlementCheckResult {
  hasAccess: boolean;
  isPro: boolean;
  isAdmin: boolean;
  isTrial: boolean;
  trialStatus: 'ACTIVE' | 'EXPIRED' | 'NONE';
  trialStartedAt: number | null;
  trialEndsAt: number | null;
  remainingTrialMs: number;
  tier: 'FREE' | 'PRO' | 'ADMIN';
  expiresAt: number | null;
  reason?: string;
}

/**
 * Checks if a coin symbol is eligible for free signal/intelligence access (BTC and ETH)
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

export class EntitlementService {
  private analyticsEvents: EntitlementAnalyticsEvent[] = [];

  /**
   * Evaluates if a given user object has active PRO entitlement.
   * Authoritative calculation performed server-side.
   */
  public checkEntitlement(user: User | null): EntitlementCheckResult {
    const now = Date.now();

    if (!user) {
      return {
        hasAccess: false,
        isPro: false,
        isAdmin: false,
        isTrial: false,
        trialStatus: 'NONE',
        trialStartedAt: null,
        trialEndsAt: null,
        remainingTrialMs: 0,
        tier: 'FREE',
        expiresAt: null,
        reason: 'User is not authenticated'
      };
    }

    // Admins always have full uninhibited access
    if (user.role === 'admin') {
      user.isAdmin = true;
      user.plan = 'PRO';
      user.subscriptionStatus = 'ACTIVE';
      user.subscriptionSource = 'ADMIN';
      return {
        hasAccess: true,
        isPro: true,
        isAdmin: true,
        isTrial: false,
        trialStatus: 'NONE',
        trialStartedAt: null,
        trialEndsAt: null,
        remainingTrialMs: 0,
        tier: 'ADMIN',
        expiresAt: null
      };
    }

    user.isAdmin = false;

    // 0. Check verified active subscription record in database (Phase 26)
    const verifiedSub = db.getUserSubscription(user.id);
    if (verifiedSub) {
      if (verifiedSub.status === 'ACTIVE') {
        user.isPro = true;
        user.tier = 'PRO';
        user.plan = 'PRO';
        user.subscriptionStatus = 'ACTIVE';
        return {
          hasAccess: true,
          isPro: true,
          isAdmin: false,
          isTrial: false,
          trialStatus: 'NONE',
          trialStartedAt: null,
          trialEndsAt: null,
          remainingTrialMs: 0,
          tier: 'PRO',
          expiresAt: verifiedSub.currentPeriodEnd
        };
      } else if (verifiedSub.status === 'CANCELED' && verifiedSub.currentPeriodEnd > now) {
        user.isPro = true;
        user.tier = 'PRO';
        user.plan = 'PRO';
        user.subscriptionStatus = 'CANCELED';
        return {
          hasAccess: true,
          isPro: true,
          isAdmin: false,
          isTrial: false,
          trialStatus: 'NONE',
          trialStartedAt: null,
          trialEndsAt: null,
          remainingTrialMs: 0,
          tier: 'PRO',
          expiresAt: verifiedSub.currentPeriodEnd,
          reason: 'Canceled: active until end of billing cycle'
        };
      } else if (verifiedSub.status === 'PAST_DUE') {
        const graceEnd = verifiedSub.currentPeriodEnd + 3 * 86400000;
        if (now < graceEnd) {
          user.isPro = true;
          user.tier = 'PRO';
          user.plan = 'PRO';
          user.subscriptionStatus = 'PAST_DUE';
          return {
            hasAccess: true,
            isPro: true,
            isAdmin: false,
            isTrial: false,
            trialStatus: 'NONE',
            trialStartedAt: null,
            trialEndsAt: null,
            remainingTrialMs: 0,
            tier: 'PRO',
            expiresAt: graceEnd,
            reason: 'Payment past due - in grace period'
          };
        }
      }
    }

    // 1. Check Paid PRO subscription
    if (user.tier === 'PRO' && user.trialStatus !== 'ACTIVE') {
      // If pro has an expiration timestamp, verify it has not expired
      if (user.proExpiresAt && user.proExpiresAt < now) {
        // Expired paid subscription
        user.isPro = false;
        user.tier = 'FREE';
        user.plan = 'FREE';
        user.subscriptionStatus = 'EXPIRED';
        db.users.set(user.id, user);

        return {
          hasAccess: false,
          isPro: false,
          isAdmin: false,
          isTrial: false,
          trialStatus: 'NONE',
          trialStartedAt: null,
          trialEndsAt: null,
          remainingTrialMs: 0,
          tier: 'FREE',
          expiresAt: user.proExpiresAt,
          reason: 'PRO subscription has expired'
        };
      }

      user.plan = 'PRO';
      user.subscriptionStatus = 'ACTIVE';
      user.subscriptionSource = user.subscriptionSource || 'PAYMENT';

      return {
        hasAccess: true,
        isPro: true,
        isAdmin: false,
        isTrial: false,
        trialStatus: 'NONE',
        trialStartedAt: null,
        trialEndsAt: null,
        remainingTrialMs: 0,
        tier: 'PRO',
        expiresAt: user.proExpiresAt || null
      };
    }

    // 2. Check 7-Day PRO Trial
    if (user.trialStatus === 'ACTIVE') {
      const trialEndsAt = user.trialEndsAt ?? (user.trialStartedAt ? user.trialStartedAt + 7 * 86400000 : (user.createdAt ? user.createdAt + 7 * 86400000 : now + 7 * 86400000));

      if (trialEndsAt > now) {
        // Active trial: temporarily receives existing PRO feature set
        const remainingTrialMs = trialEndsAt - now;

        user.plan = 'PRO';
        user.subscriptionStatus = 'TRIAL';
        user.subscriptionSource = 'TRIAL';
        user.isPro = true;

        // Contextual reminder check (3 days, 1 day)
        this.checkTrialWarnings(user, remainingTrialMs);

        return {
          hasAccess: true,
          isPro: true,
          isAdmin: false,
          isTrial: true,
          trialStatus: 'ACTIVE',
          trialStartedAt: user.trialStartedAt ?? (now - 86400000 * 2),
          trialEndsAt,
          remainingTrialMs,
          tier: 'PRO',
          expiresAt: trialEndsAt
        };
      } else {
        // Exact 7-day expiration reached: user automatically becomes FREE
        user.trialStatus = 'EXPIRED';
        user.tier = 'FREE';
        user.plan = 'FREE';
        user.subscriptionStatus = 'EXPIRED';
        user.subscriptionSource = 'TRIAL';
        user.isPro = false;
        db.users.set(user.id, user);

        // Record trial expired analytics event
        this.recordAnalyticsEvent('TRIAL_EXPIRED', {
          userId: user.id,
          userTier: 'FREE',
          metadata: { trialEndedAt: trialEndsAt }
        });

        // Notify user in-app that trial expired
        this.sendTrialExpiredNotice(user);

        return {
          hasAccess: false,
          isPro: false,
          isAdmin: false,
          isTrial: false,
          trialStatus: 'EXPIRED',
          trialStartedAt: user.trialStartedAt || null,
          trialEndsAt,
          remainingTrialMs: 0,
          tier: 'FREE',
          expiresAt: trialEndsAt,
          reason: '7-Day PRO Trial has expired'
        };
      }
    }

    // 3. Free plan (trial expired or no trial)
    user.plan = 'FREE';
    user.subscriptionStatus = user.trialStatus === 'EXPIRED' ? 'EXPIRED' : 'FREE';
    user.subscriptionSource = user.subscriptionSource || 'NONE';
    user.isPro = false;

    return {
      hasAccess: false,
      isPro: false,
      isAdmin: false,
      isTrial: false,
      trialStatus: user.trialStatus || 'NONE',
      trialStartedAt: user.trialStartedAt || null,
      trialEndsAt: user.trialEndsAt || null,
      remainingTrialMs: 0,
      tier: 'FREE',
      expiresAt: null,
      reason: user.trialStatus === 'EXPIRED' ? 'PRO trial expired' : 'Active PRO subscription required'
    };
  }

  /**
   * Helper to inspect if a user has active PRO entitlement (paid, admin, or active trial)
   */
  public isProUser(user: User | null): boolean {
    return this.checkEntitlement(user).hasAccess;
  }

  public isPro(user: User | null): boolean {
    return this.checkEntitlement(user).hasAccess;
  }

  public isTrialActive(user: User | null): boolean {
    return this.checkEntitlement(user).isTrial;
  }

  public isFree(user: User | null): boolean {
    return !this.checkEntitlement(user).hasAccess;
  }

  /**
   * Returns current active plan name ('FREE' | 'PRO')
   */
  public getCurrentPlan(user: User | null): 'FREE' | 'PRO' {
    return this.isPro(user) ? 'PRO' : 'FREE';
  }

  /**
   * Feature check
   */
  public canAccessFeature(user: User | null, feature: string): boolean {
    return this.isPro(user);
  }

  /**
   * Signal access check:
   * Free users retain useful signals for BTC and ETH.
   * Other coins require PRO entitlement (active trial or paid Pro or Admin).
   */
  public canAccessSignal(user: User | null, symbol: string, _exchange?: string): boolean {
    if (this.isPro(user)) return true;
    const freeSymbols = db.trialSettings?.freeAllowedSymbols || ['BTC', 'ETH'];
    return isFreeAllowedSymbol(symbol, freeSymbols);
  }

  /**
   * Check if a field is permitted
   */
  public canAccessPremiumField(user: User | null, _field: string, symbol: string): boolean {
    return this.canAccessSignal(user, symbol);
  }

  /**
   * Checks if user can access the Community Forum
   */
  public canAccessCommunity(user: User | null): boolean {
    return this.isPro(user);
  }

  /**
   * Evaluates AI Trader access and whether ad gate is required
   */
  public canUseAITrader(user: User | null): { allowed: boolean; requiresAd: boolean; isPro: boolean; dailyQuota: number } {
    const isPro = this.isPro(user);
    return {
      allowed: true,
      requiresAd: !isPro,
      isPro,
      dailyQuota: isPro ? 100 : 10
    };
  }

  /**
   * Evaluates if user can create a new alert given current limits
   */
  public canCreateAlert(user: User | null): { allowed: boolean; maxAlerts: number; currentCount: number; reason?: string } {
    if (!user) {
      return { allowed: false, maxAlerts: 0, currentCount: 0, reason: 'Authentication required' };
    }
    const currentAlerts = db.getAlerts(user.id);
    const isPro = this.isPro(user);
    const maxAlerts = isPro
      ? (db.globalAlertConfig.maxAlertsPerUser || 25)
      : (db.trialSettings?.freeMaxAlerts ?? 3);

    const allowed = currentAlerts.length < maxAlerts;
    return {
      allowed,
      maxAlerts,
      currentCount: currentAlerts.length,
      reason: allowed ? undefined : (isPro ? 'Pro alert limit reached' : 'Free alert limit reached. Upgrade to PRO.')
    };
  }

  public canUseAdvancedSignalAlert(user: User | null, symbol?: string): boolean {
    return symbol ? this.canAccessSignal(user, symbol) : this.isPro(user);
  }

  public canUseWhaleAlert(user: User | null): boolean {
    return this.isPro(user);
  }

  public canUseOrderFlowAlert(user: User | null): boolean {
    return this.isPro(user);
  }

  public canUseAdvancedStructureAlert(user: User | null): boolean {
    return this.isPro(user);
  }

  /**
   * Get feature limits object for client or backend evaluation
   */
  public getFeatureLimits(user: User | null) {
    const isPro = this.isPro(user);
    const isTrial = this.isTrialActive(user);
    const freeSymbols = db.trialSettings?.freeAllowedSymbols || ['BTC', 'ETH'];

    return {
      plan: this.getCurrentPlan(user),
      isPro,
      isTrialActive: isTrial,
      maxAlerts: isPro ? (db.globalAlertConfig.maxAlertsPerUser || 25) : (db.trialSettings?.freeMaxAlerts ?? 3),
      maxWatchlist: isPro ? 100 : (db.trialSettings?.freeMaxWatchlist ?? 5),
      maxScannerPairs: isPro ? 500 : (db.trialSettings?.freeScannerMaxPairs ?? 50),
      canAccessWhales: isPro,
      canAccessOrderFlow: isPro,
      canAccessLiquidations: isPro,
      canAccessCommunity: isPro,
      aiTraderUnlimited: isPro,
      aiTraderAdGateRequired: !isPro,
      allowedSignalSymbols: isPro ? ['ALL'] : freeSymbols
    };
  }

  /**
   * Record analytics events
   */
  public recordAnalyticsEvent(
    type: EntitlementAnalyticsEventType,
    payload: {
      userId?: string;
      userTier?: 'FREE' | 'PRO' | 'ADMIN';
      symbol?: string;
      exchange?: string;
      feature?: string;
      metadata?: Record<string, any>;
    } = {}
  ): EntitlementAnalyticsEvent {
    const event: EntitlementAnalyticsEvent = {
      id: `evt_ana_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      userId: payload.userId,
      userTier: payload.userTier,
      symbol: payload.symbol,
      exchange: payload.exchange,
      feature: payload.feature,
      metadata: payload.metadata,
      timestamp: Date.now()
    };
    this.analyticsEvents.unshift(event);
    if (this.analyticsEvents.length > 500) {
      this.analyticsEvents.length = 500;
    }
    return event;
  }

  public getRecentAnalyticsEvents(limit = 100): EntitlementAnalyticsEvent[] {
    return this.analyticsEvents.slice(0, limit);
  }

  /**
   * Get server-authoritative trial status object
   */
  public getTrialDetails(user: User | null): UserTrialInfo {
    const entitlement = this.checkEntitlement(user);
    const now = Date.now();
    const remainingMs = entitlement.remainingTrialMs;
    const remainingDays = Math.ceil(remainingMs / 86400000);
    const remainingHours = Math.ceil(remainingMs / 3600000);

    return {
      plan: entitlement.tier === 'ADMIN' ? 'PRO' : entitlement.isTrial ? 'FREE' : entitlement.tier,
      trialStatus: entitlement.trialStatus,
      trialStartedAt: entitlement.trialStartedAt,
      trialEndsAt: entitlement.trialEndsAt,
      remainingMs,
      remainingDays,
      remainingHours,
      isTrialActive: entitlement.isTrial,
      isExpired: entitlement.trialStatus === 'EXPIRED',
      serverTime: now
    };
  }

  /**
   * Sanitizes a NormalizedCoinData object based on the user's entitlement.
   * Free users retain basic market prices, BTC/ETH signals, basic exchange info.
   * Premium intelligence (Bull Score, Signal, MTF Confluence, Advanced Structure, Whale Intel, Order Flow)
   * is locked/redacted on the server so no sensitive data is leaked in the payload!
   */
  public sanitizeCoinDataForUser(coin: NormalizedCoinData, user: User | null): NormalizedCoinData {
    if (!coin) return coin;

    // Pro users and BTC/ETH have full uninhibited access
    if (this.canAccessSignal(user, coin.symbol)) {
      return {
        ...coin,
        isLocked: false
      };
    }

    // Free users on non-BTC/ETH coins:
    // Retain: symbol, rawSymbol, marketId, exchangeSymbol, normalizedSymbol, baseAsset, quoteAsset,
    // price, change24h, high24h, low24h, volume24h, quoteVolume24h, exchange, marketType, source,
    // timestamp, dataStatus, freshnessSeconds, isVerifiedIdentity, indicators (basic technical indicators).
    //
    // Redact/Lock: Bull Score, Downside Risk Score, Signal, MTF Confluence, Order Flow, Liquidations, Whale Transfers, Derivatives
    const sanitizedScores = {
      ...coin.scores,
      bullScore: -1, // Locked sentinel
      downsideRiskScore: -1, // Locked sentinel
      bullClassification: 'Neutral conditions' as any,
      downsideRiskClassification: 'Low downside pressure' as any,
      signal: 'Neutral conditions' as any,
      bullBreakdown: {} as any,
      downsideRiskBreakdown: {} as any
    };

    const sanitizedSignal: MarketSignal = {
      id: `locked_${coin.symbol}`,
      exchange: coin.exchange,
      marketId: coin.marketId || `${coin.exchange}_${coin.rawSymbol}`,
      marketType: coin.marketType,
      symbol: coin.symbol,
      timeframe: '1h',
      signalType: 'NEUTRAL',
      direction: 'NEUTRAL',
      status: 'ACTIVE',
      strength: 0,
      confidence: 0,
      timestamp: coin.timestamp,
      evidence: [],
      supportingFactors: [],
      conflictingFactors: [],
      neutralFactors: [],
      downsideRiskStrength: 0,
      timeframeAnalysis: {} as any,
      multiTimeframeSummary: {
        alignedDirection: 'NEUTRAL',
        alignmentScore: 0,
        bullishTimeframes: [],
        bearishTimeframes: [],
        neutralTimeframes: [],
        isConfluent: false,
        isConflicted: false,
        summaryText: 'PRO Entitlement Required'
      },
      modelVersion: 'P15_LOCKED',
      indicatorVersion: 1,
      structureVersion: 1,
      weightConfigVersion: 1,
      isLocked: true,
      lockedReason: 'PRO_REQUIRED'
    };

    return {
      ...coin,
      scores: sanitizedScores,
      scoreSnapshot: undefined,
      signal: sanitizedSignal,
      multiTimeframeSummary: undefined,
      orderFlow: null,
      liquidationIntel: null,
      whaleTransfers: [],
      derivatives: null,
      isLocked: true,
      lockedReason: 'PRO_REQUIRED'
    };
  }

  /**
   * Sanitizes a MarketSignal record
   */
  public sanitizeSignalForUser(signal: MarketSignal, user: User | null): MarketSignal {
    if (!signal) return signal;

    if (this.canAccessSignal(user, signal.symbol)) {
      return { ...signal, isLocked: false };
    }

    return {
      ...signal,
      strength: 0,
      confidence: 0,
      targetLevels: [],
      evidence: [],
      supportingFactors: [],
      conflictingFactors: [],
      neutralFactors: [],
      multiTimeframeSummary: {
        alignedDirection: 'NEUTRAL',
        alignmentScore: 0,
        bullishTimeframes: [],
        bearishTimeframes: [],
        neutralTimeframes: [],
        isConfluent: false,
        isConflicted: false,
        summaryText: 'PRO Entitlement Required'
      },
      isLocked: true,
      lockedReason: 'PRO_REQUIRED'
    };
  }

  /**
   * Contextual Trial Warning In-App Notifications (3 days, 1 day)
   */
  private checkTrialWarnings(user: User, remainingMs: number): void {
    const daysLeft = remainingMs / 86400000;
    const userEvents = db.alertEvents.get(user.id) || [];

    if (daysLeft <= 3 && daysLeft > 1) {
      const alreadySent = userEvents.some(e => e.title.includes('3 Days Remaining in Pro Trial'));
      if (!alreadySent) {
        db.addAlertEvent({
          id: `evt_trial_warn_3d_${Date.now()}`,
          userId: user.id,
          category: 'BTC Market Condition',
          type: 'TRIAL_EXPIRATION_WARNING',
          severity: 'MEDIUM',
          symbol: 'BTC/USDT',
          title: 'PRO Trial: 3 Days Remaining',
          message: 'Your 7-Day PRO Trial has 3 days remaining. Upgrade now to preserve institutional market intelligence and full scanner access.',
          source: 'Entitlement Engine',
          timestamp: Date.now(),
          status: 'TRIGGERED',
          read: false
        });
      }
    } else if (daysLeft <= 1 && daysLeft > 0) {
      const alreadySent = userEvents.some(e => e.title.includes('Final 24 Hours of Pro Trial'));
      if (!alreadySent) {
        db.addAlertEvent({
          id: `evt_trial_warn_1d_${Date.now()}`,
          userId: user.id,
          category: 'BTC Market Condition',
          type: 'TRIAL_EXPIRATION_WARNING',
          severity: 'HIGH',
          symbol: 'BTC/USDT',
          title: 'PRO Trial: Final 24 Hours of Pro Trial',
          message: 'Your 7-Day PRO Trial expires in less than 24 hours. After expiration, your account will automatically return to the Free Plan.',
          source: 'Entitlement Engine',
          timestamp: Date.now(),
          status: 'TRIGGERED',
          read: false
        });
      }
    }
  }

  private sendTrialExpiredNotice(user: User): void {
    const userEvents = db.alertEvents.get(user.id) || [];
    const alreadySent = userEvents.some(e => e.title.includes('PRO Trial Has Expired'));
    if (!alreadySent) {
      db.addAlertEvent({
        id: `evt_trial_exp_${Date.now()}`,
        userId: user.id,
        category: 'BTC Market Condition',
        type: 'TRIAL_EXPIRED',
        severity: 'MEDIUM',
        symbol: 'BTC/USDT',
        title: 'PRO Trial Has Expired — Welcome to Free Plan',
        message: 'Your 7-Day PRO Trial has completed. You now have Free Plan access: full BTC & ETH signals, live market prices, and basic scanner access.',
        source: 'Entitlement Engine',
        timestamp: Date.now(),
        status: 'TRIGGERED',
        read: false
      });
    }
  }

  /**
   * Grants PRO entitlement to a user (used by admin or demo/testing)
   */
  public grantPro(userId: string, durationDays: number = 30, actor: string = 'admin', reason: string = 'Manual admin grant'): User | null {
    const user = db.users.get(userId);
    if (!user) return null;

    const previousState = {
      plan: user.plan || 'FREE',
      tier: user.tier || 'FREE',
      isPro: Boolean(user.isPro),
      trialStatus: user.trialStatus || 'NONE'
    };

    user.isPro = true;
    user.tier = user.role === 'admin' ? 'ADMIN' : 'PRO';
    user.plan = 'PRO';
    user.subscriptionStatus = 'ACTIVE';
    user.subscriptionSource = 'ADMIN';
    user.proExpiresAt = Date.now() + durationDays * 86400000;
    user.trialStatus = 'NONE';
    db.users.set(userId, user);

    const newState = {
      plan: user.plan,
      tier: user.tier,
      isPro: user.isPro,
      trialStatus: user.trialStatus
    };

    db.addAdminAuditLog(actor, 'PRO_GRANTED_BY_ADMIN', `user:${userId}`, {
      userId,
      actor,
      reason,
      durationDays,
      previousState,
      newState,
      timestamp: Date.now()
    });

    db.addAdminAuditLog(actor, 'PLAN_CHANGED', `user:${userId}`, {
      userId,
      actor,
      reason,
      fromPlan: previousState.plan,
      toPlan: 'PRO',
      timestamp: Date.now()
    });

    this.recordAnalyticsEvent('TRIAL_FEATURE_USED', {
      userId,
      userTier: 'PRO',
      feature: 'ADMIN_PRO_GRANT',
      metadata: { durationDays, reason }
    });

    return user;
  }

  /**
   * Revokes PRO entitlement from a user
   */
  public revokePro(userId: string, actor: string = 'admin', reason: string = 'Manual admin revoke'): User | null {
    const user = db.users.get(userId);
    if (!user) return null;

    const previousState = {
      plan: user.plan || 'FREE',
      tier: user.tier || 'FREE',
      isPro: Boolean(user.isPro),
      trialStatus: user.trialStatus || 'NONE'
    };

    if (user.role !== 'admin') {
      user.isPro = false;
      user.tier = 'FREE';
      user.plan = 'FREE';
      user.subscriptionStatus = 'EXPIRED';
      user.subscriptionSource = 'ADMIN';
      user.trialStatus = 'EXPIRED';
      user.proExpiresAt = null;
    }
    db.users.set(userId, user);

    const newState = {
      plan: user.plan,
      tier: user.tier,
      isPro: user.isPro,
      trialStatus: user.trialStatus
    };

    db.addAdminAuditLog(actor, 'PRO_REVOKED_BY_ADMIN', `user:${userId}`, {
      userId,
      actor,
      reason,
      previousState,
      newState,
      timestamp: Date.now()
    });

    db.addAdminAuditLog(actor, 'PLAN_CHANGED', `user:${userId}`, {
      userId,
      actor,
      reason,
      fromPlan: previousState.plan,
      toPlan: 'FREE',
      timestamp: Date.now()
    });

    return user;
  }
}

export const entitlementService = new EntitlementService();

/**
 * Express Middleware: Enforces that the request has a valid session AND active PRO entitlement.
 * Blocks unauthenticated users with 401 and non-PRO users with 403 Forbidden.
 */
export const requireProAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      error: 'Authentication required to access Community Forum',
      code: 'UNAUTHENTICATED'
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const session = db.getSession(token);
  if (!session) {
    return res.status(401).json({
      error: 'Invalid or expired session token',
      code: 'SESSION_EXPIRED'
    });
  }

  const user = db.users.get(session.userId);
  if (!user) {
    return res.status(401).json({
      error: 'User account not found',
      code: 'USER_NOT_FOUND'
    });
  }

  const entitlement = entitlementService.checkEntitlement(user);
  if (!entitlement.hasAccess) {
    return res.status(403).json({
      error: 'PRO entitlement required to access Community Forum',
      code: 'PRO_REQUIRED',
      reason: entitlement.reason,
      tier: entitlement.tier
    });
  }

  // Attach verified user to request for downstream handlers
  (req as any).user = user;
  next();
};
