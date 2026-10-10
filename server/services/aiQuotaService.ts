import { User, AIQuotaStatus } from '../../src/types';
import { db } from '../db/schema';
import { entitlementService } from './entitlementService';

export class AiQuotaService {
  // Map of `${userId}:${dayKeyUTC}` -> count
  private usageMap: Map<string, number> = new Map();

  // Configurable limits
  public freeDailyLimit = 5;
  public proDailyLimit = 100;

  private getDayKeyUTC(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  }

  private getNextResetTimestamp(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    return tomorrow.getTime();
  }

  public getQuota(user: User | null): AIQuotaStatus {
    if (!user) {
      return {
        userId: 'unauthenticated',
        tier: 'FREE',
        isPro: false,
        dailyLimit: this.freeDailyLimit,
        usedToday: 0,
        remainingQuota: 0,
        adRequired: true,
        rewardedAdAvailable: true,
        resetAt: this.getNextResetTimestamp()
      };
    }

    const isAdmin = user.role === 'admin';
    const isPro = entitlementService.isPro(user);
    const tier: 'FREE' | 'PRO' | 'ADMIN' = isAdmin ? 'ADMIN' : (isPro ? 'PRO' : 'FREE');

    const dayKey = this.getDayKeyUTC();
    const key = `${user.id}:${dayKey}`;
    const usedToday = this.usageMap.get(key) || 0;

    const dailyLimit = isAdmin ? 9999 : (isPro ? this.proDailyLimit : this.freeDailyLimit);
    const remainingQuota = Math.max(0, dailyLimit - usedToday);
    const adRequired = !isPro && !isAdmin;

    return {
      userId: user.id,
      tier,
      isPro,
      dailyLimit,
      usedToday,
      remainingQuota,
      adRequired,
      rewardedAdAvailable: true,
      resetAt: this.getNextResetTimestamp()
    };
  }

  public hasQuota(user: User | null): boolean {
    const quota = this.getQuota(user);
    return quota.remainingQuota > 0;
  }

  public consumeQuota(user: User | null): { success: boolean; remaining: number } {
    if (!user) return { success: false, remaining: 0 };
    const quota = this.getQuota(user);
    if (quota.remainingQuota <= 0) {
      return { success: false, remaining: 0 };
    }

    const dayKey = this.getDayKeyUTC();
    const key = `${user.id}:${dayKey}`;
    const current = this.usageMap.get(key) || 0;
    this.usageMap.set(key, current + 1);

    return { success: true, remaining: quota.remainingQuota - 1 };
  }

  public refundQuota(user: User | null): void {
    if (!user) return;
    const dayKey = this.getDayKeyUTC();
    const key = `${user.id}:${dayKey}`;
    const current = this.usageMap.get(key) || 0;
    if (current > 0) {
      this.usageMap.set(key, current - 1);
    }
  }

  public resetUsageForTesting(userId: string): void {
    const dayKey = this.getDayKeyUTC();
    this.usageMap.delete(`${userId}:${dayKey}`);
  }

  public setLimitForTesting(freeLimit: number, proLimit: number): void {
    this.freeDailyLimit = freeLimit;
    this.proDailyLimit = proLimit;
  }
}

export const aiQuotaService = new AiQuotaService();
