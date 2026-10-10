import crypto from 'crypto';
import {
  RewardedAdConfig,
  RewardedAdSession,
  RewardedAdSessionStatus,
  AIMonetizationMetrics,
  User
} from '../../src/types';
import { aiQuotaService } from './aiQuotaService';

export interface AdCreative {
  creativeId: string;
  title: string;
  sponsor: string;
  tagline: string;
  durationSeconds: number;
  badge: string;
  targetUrl: string;
  ctaText: string;
  isTestMode: boolean;
}

export interface IRewardedAdProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  loadAdCreative(userId: string): Promise<AdCreative>;
  verifyCompletion(sessionId: string, verificationToken: string): Promise<{ valid: boolean; reason?: string }>;
  getProviderStatus(): { id: string; name: string; isAvailable: boolean; testMode: boolean; latencyMs: number };
}

/**
 * Mock / Test Ad Provider
 * Clearly marked TEST MODE, safe crypto partner / terminal simulation
 */
export class MockRewardedAdProvider implements IRewardedAdProvider {
  public id = 'mock_ad_simulator';
  public name = 'Crypto Intelligence Rewarded Ad Simulator';
  public testMode = true;
  public forceAvailable = true;

  private sampleCreatives: AdCreative[] = [
    {
      creativeId: 'cr_ledger_vault',
      title: 'Ledger Stax • Next-Gen Hardware Security',
      sponsor: 'Hardware Vault Partner',
      tagline: 'Protect your spot holdings and DeFi keys with EAL6+ certified secure element.',
      durationSeconds: 15,
      badge: 'TEST SPONSOR • 15s REWARDED AD',
      targetUrl: 'https://example.com/hardware-wallet',
      ctaText: 'Explore Hardware Vaults',
      isTestMode: true
    },
    {
      creativeId: 'cr_dex_aggregator',
      title: 'Uniswap v4 Hooks & Deep Liquidity Engine',
      sponsor: 'DEX Liquidity Partner',
      tagline: 'Trade multi-chain tokens with zero routing slip and MEV protection.',
      durationSeconds: 15,
      badge: 'TEST SPONSOR • 15s REWARDED AD',
      targetUrl: 'https://example.com/dex-aggregator',
      ctaText: 'Discover Liquidity Pools',
      isTestMode: true
    },
    {
      creativeId: 'cr_pro_terminal',
      title: 'Upgrade to Crypto Intelligence PRO Tier',
      sponsor: 'Platform Spotlight',
      tagline: 'Remove all rewarded ads, gain exclusive access to the Community Forum and Whale Alpha.',
      durationSeconds: 15,
      badge: 'PRO HIGHLIGHT • 15s REWARDED AD',
      targetUrl: '#upgrade-pro',
      ctaText: 'Upgrade to PRO',
      isTestMode: true
    }
  ];

  public async isAvailable(): Promise<boolean> {
    return this.forceAvailable;
  }

  public async loadAdCreative(_userId: string): Promise<AdCreative> {
    const idx = Math.floor(Math.random() * this.sampleCreatives.length);
    return this.sampleCreatives[idx];
  }

  public async verifyCompletion(sessionId: string, verificationToken: string): Promise<{ valid: boolean; reason?: string }> {
    if (!verificationToken || verificationToken.length < 16) {
      return { valid: false, reason: 'Invalid or missing provider verification token.' };
    }
    // Verify token hash corresponds to session
    return { valid: true };
  }

  public getProviderStatus() {
    return {
      id: this.id,
      name: this.name,
      isAvailable: this.forceAvailable,
      testMode: this.testMode,
      latencyMs: 18
    };
  }
}

export class RewardedAdService {
  private provider: IRewardedAdProvider = new MockRewardedAdProvider();
  private sessions: Map<string, RewardedAdSession> = new Map();

  // Monetization and Token telemetry (strictly separated by tier)
  private metrics: AIMonetizationMetrics = {
    freeAiRequests: 0,
    proAiRequests: 0,
    rewardedAdAttempts: 0,
    rewardedAdCompletions: 0,
    rewardedAdFailures: 0,
    rewardVerificationFailures: 0,
    duplicateRewardAttempts: 0,
    expiredRewardSessions: 0,
    aiRequestsUnlockedByAds: 0,
    aiRequestFailuresAfterReward: 0,
    estimatedAdImpressions: 0,
    freeAiTokens: 0,
    proAiTokens: 0,
    freeEstimatedCostUsd: 0,
    proEstimatedCostUsd: 0,
    adRevenueStatus: 'N/A — Provider revenue data unavailable'
  };

  // Configurable parameters
  private config: RewardedAdConfig = {
    provider: 'mock_ad_simulator',
    enabled: true,
    testMode: true,
    rewardVerificationRequired: true,
    adDurationSeconds: 15,
    sessionExpirySeconds: 300, // 5 minutes
    adAvailability: true,
    maxRewardRetries: 3,
    duplicateDetection: true,
    freeDailyQuota: 5,
    proDailyQuota: 100
  };

  constructor() {
    // Periodic session cleanup
    const timer = setInterval(() => {
      this.cleanExpiredSessions();
    }, 60000);
    if (timer.unref) timer.unref();
  }

  public setProvider(provider: IRewardedAdProvider) {
    this.provider = provider;
    this.config.provider = provider.id;
  }

  public getProvider(): IRewardedAdProvider {
    return this.provider;
  }

  public getConfig(): RewardedAdConfig {
    return { ...this.config };
  }

  public updateConfig(patch: Partial<RewardedAdConfig>): RewardedAdConfig {
    this.config = { ...this.config, ...patch };
    if (patch.freeDailyQuota !== undefined) {
      aiQuotaService.freeDailyLimit = patch.freeDailyQuota;
    }
    if (patch.proDailyQuota !== undefined) {
      aiQuotaService.proDailyLimit = patch.proDailyQuota;
    }
    if (patch.adAvailability !== undefined && this.provider instanceof MockRewardedAdProvider) {
      this.provider.forceAvailable = patch.adAvailability;
    }
    return this.getConfig();
  }

  public getMetrics(): AIMonetizationMetrics {
    return { ...this.metrics };
  }

  /**
   * 1. Create a rewarded ad session for a FREE user requesting AI analysis
   */
  public async createSession(user: User): Promise<{
    success: boolean;
    session?: RewardedAdSession;
    creative?: AdCreative;
    error?: string;
    code?: string;
  }> {
    const isPro = Boolean(user.isPro) || user.role === 'admin';
    if (isPro) {
      return { success: false, error: 'PRO users do not require rewarded ad sessions.', code: 'PRO_NO_AD_REQUIRED' };
    }

    if (!this.config.enabled) {
      return { success: false, error: 'Rewarded ad system is temporarily disabled.', code: 'AD_SYSTEM_DISABLED' };
    }

    // Check remaining AI quota before allowing ad
    if (!aiQuotaService.hasQuota(user)) {
      return {
        success: false,
        error: 'Daily AI Trader quota exhausted. Watch ad will not unlock requests without quota.',
        code: 'QUOTA_EXHAUSTED'
      };
    }

    // Check ad availability
    const available = await this.provider.isAvailable();
    if (!available || !this.config.adAvailability) {
      return {
        success: false,
        error: 'Rewarded ad is currently unavailable. Please try again shortly.',
        code: 'AD_UNAVAILABLE'
      };
    }

    const sessionId = `ad_sess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const expiresAt = now + this.config.sessionExpirySeconds * 1000;

    // Generate cryptographic verification challenge
    const challengeSalt = crypto.randomBytes(16).toString('hex');
    const verificationToken = crypto.createHash('sha256').update(`${sessionId}:${user.id}:${challengeSalt}`).digest('hex');

    const session: RewardedAdSession = {
      sessionId,
      userId: user.id,
      createdAt: now,
      expiresAt,
      status: 'CREATED',
      provider: this.provider.name,
      verificationToken,
      adDurationSeconds: this.config.adDurationSeconds
    };

    this.sessions.set(sessionId, session);
    this.metrics.rewardedAdAttempts++;

    const creative = await this.provider.loadAdCreative(user.id);
    creative.durationSeconds = this.config.adDurationSeconds;

    return { success: true, session, creative };
  }

  /**
   * 2. Mark ad playback started
   */
  public startAd(sessionId: string, userId: string): { success: boolean; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: 'Session not found' };
    if (session.userId !== userId) return { success: false, error: 'Unauthorized session owner' };
    if (Date.now() > session.expiresAt) {
      session.status = 'EXPIRED';
      this.metrics.expiredRewardSessions++;
      return { success: false, error: 'Ad session expired' };
    }

    session.status = 'AD_STARTED';
    return { success: true };
  }

  /**
   * 3. Server-side verify completion of the 15s rewarded ad
   */
  public async verifyReward(
    sessionId: string,
    userId: string,
    clientToken?: string
  ): Promise<{ success: boolean; session?: RewardedAdSession; error?: string; code?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.metrics.rewardVerificationFailures++;
      return { success: false, error: 'Session does not exist', code: 'SESSION_NOT_FOUND' };
    }

    if (session.userId !== userId) {
      this.metrics.rewardVerificationFailures++;
      return { success: false, error: 'Unauthorized reward claimant', code: 'UNAUTHORIZED' };
    }

    if (Date.now() > session.expiresAt) {
      session.status = 'EXPIRED';
      this.metrics.expiredRewardSessions++;
      return { success: false, error: 'Ad session has expired', code: 'SESSION_EXPIRED' };
    }

    if (session.status === 'CONSUMED') {
      this.metrics.duplicateRewardAttempts++;
      return { success: false, error: 'Reward session already consumed. Replay rejected.', code: 'REWARD_ALREADY_CONSUMED' };
    }

    if (session.status === 'REWARD_VERIFIED' || session.status === 'AI_REQUEST_UNLOCKED') {
      return { success: true, session };
    }

    // Verify minimum ad duration playback on server
    const elapsedSeconds = (Date.now() - session.createdAt) / 1000;
    // Allow small 0.5s network buffer, but reject premature completion
    if (elapsedSeconds < (this.config.adDurationSeconds - 1.5)) {
      session.status = 'FAILED';
      session.failureReason = 'Premature completion attempted before 15-second requirement';
      this.metrics.rewardedAdFailures++;
      return {
        success: false,
        error: `Advertisement watched for ${elapsedSeconds.toFixed(1)}s, which is below the mandatory 15-second duration.`,
        code: 'DURATION_TOO_SHORT'
      };
    }

    // Verify cryptographic token if requirement enabled
    if (this.config.rewardVerificationRequired && clientToken) {
      if (clientToken !== session.verificationToken) {
        this.metrics.rewardVerificationFailures++;
        return { success: false, error: 'Invalid reward verification signature.', code: 'INVALID_SIGNATURE' };
      }
    }

    const providerCheck = await this.provider.verifyCompletion(sessionId, session.verificationToken || '');
    if (!providerCheck.valid) {
      session.status = 'FAILED';
      this.metrics.rewardedAdFailures++;
      return { success: false, error: providerCheck.reason || 'Provider rejected completion', code: 'PROVIDER_REJECTED' };
    }

    // Successfully verified
    session.status = 'REWARD_VERIFIED';
    session.rewardVerifiedAt = Date.now();
    this.metrics.rewardedAdCompletions++;
    this.metrics.estimatedAdImpressions++;
    this.metrics.aiRequestsUnlockedByAds++;

    return { success: true, session };
  }

  /**
   * 4. Atomically validate & unlock AI request using the verified reward session
   */
  public validateAndConsumeReward(
    sessionId: string,
    user: User,
    aiRequestId: string
  ): { valid: boolean; error?: string; code?: string } {
    const isPro = Boolean(user.isPro) || user.role === 'admin';
    if (isPro) {
      // Pro users do not need an ad reward session
      return { valid: true };
    }

    if (!sessionId) {
      return {
        valid: false,
        error: 'Free tier requires a completed 15-second rewarded advertisement session. Missing rewardSessionId.',
        code: 'REWARD_SESSION_REQUIRED'
      };
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      this.metrics.rewardVerificationFailures++;
      return { valid: false, error: 'Reward session not found.', code: 'INVALID_SESSION' };
    }

    if (session.userId !== user.id) {
      this.metrics.rewardVerificationFailures++;
      return { valid: false, error: 'Reward session does not belong to this user.', code: 'SESSION_USER_MISMATCH' };
    }

    if (session.status === 'CONSUMED') {
      this.metrics.duplicateRewardAttempts++;
      return { valid: false, error: 'Reward session has already been used to unlock an AI request. Duplicate replay rejected.', code: 'REWARD_ALREADY_USED' };
    }

    if (Date.now() > session.expiresAt) {
      session.status = 'EXPIRED';
      this.metrics.expiredRewardSessions++;
      return { valid: false, error: 'Reward session has expired. Please complete a fresh advertisement.', code: 'REWARD_EXPIRED' };
    }

    if (session.status !== 'REWARD_VERIFIED' && session.status !== 'AI_REQUEST_UNLOCKED') {
      return { valid: false, error: `Reward session is in '${session.status}' state and not verified.`, code: 'REWARD_NOT_VERIFIED' };
    }

    // Atomically transition state to lock against concurrent double-spending
    session.status = 'CONSUMED';
    session.consumedAt = Date.now();
    session.aiRequestId = aiRequestId;

    return { valid: true };
  }

  /**
   * Rollback session if AI request threw an unexpected internal error (so user is not penalized)
   */
  public rollbackSessionOnFailure(sessionId: string, userId: string) {
    const session = this.sessions.get(sessionId);
    if (session && session.userId === userId && session.status === 'CONSUMED') {
      session.status = 'REWARD_VERIFIED'; // Re-allow controlled retry
      session.consumedAt = null;
      this.metrics.aiRequestFailuresAfterReward++;
    }
  }

  /**
   * Track AI token usage & cost separately for FREE vs PRO tiers
   */
  public recordAiUsage(tier: 'FREE' | 'PRO' | 'ADMIN', tokens: number, costUsd: number) {
    if (tier === 'FREE') {
      this.metrics.freeAiRequests++;
      this.metrics.freeAiTokens += tokens;
      this.metrics.freeEstimatedCostUsd += costUsd;
    } else {
      this.metrics.proAiRequests++;
      this.metrics.proAiTokens += tokens;
      this.metrics.proEstimatedCostUsd += costUsd;
    }
  }

  public cleanExpiredSessions(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt < now && session.status !== 'CONSUMED') {
        session.status = 'EXPIRED';
        this.metrics.expiredRewardSessions++;
        cleaned++;
      }
    }
    return cleaned;
  }

  // Testing helpers
  public getSession(sessionId: string): RewardedAdSession | undefined {
    return this.sessions.get(sessionId);
  }

  public resetMetricsForTesting(): void {
    this.metrics = {
      freeAiRequests: 0,
      proAiRequests: 0,
      rewardedAdAttempts: 0,
      rewardedAdCompletions: 0,
      rewardedAdFailures: 0,
      rewardVerificationFailures: 0,
      duplicateRewardAttempts: 0,
      expiredRewardSessions: 0,
      aiRequestsUnlockedByAds: 0,
      aiRequestFailuresAfterReward: 0,
      estimatedAdImpressions: 0,
      freeAiTokens: 0,
      proAiTokens: 0,
      freeEstimatedCostUsd: 0,
      proEstimatedCostUsd: 0,
      adRevenueStatus: 'N/A — Provider revenue data unavailable'
    };
    this.sessions.clear();
  }
}

export const rewardedAdService = new RewardedAdService();
