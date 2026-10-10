import { AIQuotaStatus, RewardedAdSession } from '../types';

export interface AdCreativeData {
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

export interface RewardedAdInitResult {
  success: boolean;
  session?: RewardedAdSession;
  creative?: AdCreativeData;
  error?: string;
  code?: string;
}

export interface RewardedAdVerifyResult {
  success: boolean;
  session?: RewardedAdSession;
  error?: string;
  code?: string;
  message?: string;
}

export class RewardedAdClientService {
  /**
   * Fetch current AI quota status for the user
   */
  public async getQuota(token?: string | null): Promise<AIQuotaStatus | null> {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ad/quota', { headers });
      if (!res.ok) return null;
      const data = await res.json();
      return data.quota;
    } catch {
      return null;
    }
  }

  /**
   * Initialize a 15-second rewarded ad session
   */
  public async loadAd(token?: string | null): Promise<RewardedAdInitResult> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ad/session/create', {
        method: 'POST',
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to initialize ad', code: data.code };
      }

      return {
        success: true,
        session: data.session,
        creative: data.creative
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Notify server that ad playback has started
   */
  public async startAd(sessionId: string, token?: string | null): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ad/session/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Server-side verify completion of the 15-second rewarded ad
   */
  public async verifyReward(
    sessionId: string,
    verificationToken?: string,
    token?: string | null
  ): Promise<RewardedAdVerifyResult> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ad/session/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId, verificationToken })
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Reward verification failed',
          code: data.code
        };
      }

      return {
        success: true,
        session: data.session,
        message: data.message
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

export const rewardedAdClient = new RewardedAdClientService();
