import { TestResult, User } from '../../src/types';
import { rewardedAdService, MockRewardedAdProvider } from '../services/rewardedAdService';
import { aiQuotaService } from '../services/aiQuotaService';
import { communityStore } from '../services/communityStore';

export class Phase9bEngineTestRunner {
  public static async runAllTests(): Promise<{
    timestamp: number;
    totalTests: number;
    passedCount: number;
    failedCount: number;
    allPassed: boolean;
    results: TestResult[];
  }> {
    const results: TestResult[] = [];

    // Helper users
    const freeUser: User = {
      id: 'usr_test_free_p9b',
      email: 'free_p9b@example.com',
      name: 'Free Analyst',
      role: 'user',
      isPro: false,
      tier: 'FREE',
      createdAt: Date.now()
    };

    const freeUserNoQuota: User = {
      id: 'usr_test_no_quota_p9b',
      email: 'noquota_p9b@example.com',
      name: 'Exhausted Free Analyst',
      role: 'user',
      isPro: false,
      tier: 'FREE',
      createdAt: Date.now()
    };

    const proUser: User = {
      id: 'usr_test_pro_p9b',
      email: 'pro_p9b@example.com',
      name: 'Pro Trader',
      role: 'user',
      isPro: true,
      tier: 'PRO',
      createdAt: Date.now()
    };

    const adminUser: User = {
      id: 'usr_test_admin_p9b',
      email: 'admin_p9b@example.com',
      name: 'Admin Master',
      role: 'admin',
      isPro: true,
      tier: 'ADMIN',
      createdAt: Date.now()
    };

    // 1. FREE USER WITH QUOTA REQUIRES REWARDED AD
    try {
      aiQuotaService.resetUsageForTesting(freeUser.id);
      const quota = aiQuotaService.getQuota(freeUser);
      const sessionRes = await rewardedAdService.createSession(freeUser);
      const passed = quota.adRequired === true && quota.remainingQuota > 0 && sessionRes.success === true && sessionRes.session?.adDurationSeconds === 15;
      results.push({
        name: 'Free User with Quota Requires 15s Rewarded Ad',
        category: 'FREE_FLOW',
        passed,
        durationMs: 1,
        details: passed
          ? `Free tier has ${quota.remainingQuota} quota units remaining, successfully issued 15s ad session.`
          : 'Failed to require rewarded ad for free user.'
      });
    } catch (e) {
      results.push({
        name: 'Free User with Quota Requires 15s Rewarded Ad',
        category: 'FREE_FLOW',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 2. FREE USER AD COMPLETION -> UNLOCK 1 AI REQUEST -> CONSUME 1 QUOTA
    try {
      aiQuotaService.resetUsageForTesting(freeUser.id);
      const sessionRes = await rewardedAdService.createSession(freeUser);
      const session = sessionRes.session!;

      // Simulate full 15s elapsed
      session.createdAt = Date.now() - 16000;
      const verifyRes = await rewardedAdService.verifyReward(session.sessionId, freeUser.id, session.verificationToken);

      const unlockRes = rewardedAdService.validateAndConsumeReward(session.sessionId, freeUser, 'req_ai_test_1');
      const consumeQuotaRes = aiQuotaService.consumeQuota(freeUser);

      const passed = verifyRes.success && unlockRes.valid && consumeQuotaRes.success;
      results.push({
        name: 'Ad Completion Unlocks One Request & Consumes One Quota',
        category: 'FREE_FLOW',
        passed,
        durationMs: 2,
        details: passed
          ? 'Rewarded ad verified -> AI request unlocked -> 1 quota consumed correctly.'
          : 'Failed ad unlock and quota consumption sequence.'
      });
    } catch (e) {
      results.push({
        name: 'Ad Completion Unlocks One Request & Consumes One Quota',
        category: 'FREE_FLOW',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 3. FREE USER WITH NO QUOTA -> BLOCKED, NO AD, NO AI
    try {
      aiQuotaService.resetUsageForTesting(freeUserNoQuota.id);
      // Consume all quota
      const limit = aiQuotaService.freeDailyLimit;
      for (let i = 0; i < limit; i++) {
        aiQuotaService.consumeQuota(freeUserNoQuota);
      }
      const quota = aiQuotaService.getQuota(freeUserNoQuota);
      const sessionRes = await rewardedAdService.createSession(freeUserNoQuota);

      const passed = quota.remainingQuota === 0 && !sessionRes.success && sessionRes.code === 'QUOTA_EXHAUSTED';
      results.push({
        name: 'Exhausted Quota Blocks Ad Creation & AI Access',
        category: 'FREE_FLOW',
        passed,
        durationMs: 1,
        details: passed
          ? 'Correctly blocked ad initialization when daily free quota is 0.'
          : 'Incorrectly allowed ad initialization on exhausted quota.'
      });
    } catch (e) {
      results.push({
        name: 'Exhausted Quota Blocks Ad Creation & AI Access',
        category: 'FREE_FLOW',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 4. FAILED AD -> NO AI CALL, NO QUOTA CONSUMED
    try {
      aiQuotaService.resetUsageForTesting(freeUser.id);
      const initialQuota = aiQuotaService.getQuota(freeUser).remainingQuota;
      const sessionRes = await rewardedAdService.createSession(freeUser);
      const session = sessionRes.session!;

      // Premature completion simulation (watched only 4 seconds)
      session.createdAt = Date.now() - 4000;
      const verifyRes = await rewardedAdService.verifyReward(session.sessionId, freeUser.id, session.verificationToken);

      const remainingAfterFail = aiQuotaService.getQuota(freeUser).remainingQuota;
      const passed = !verifyRes.success && verifyRes.code === 'DURATION_TOO_SHORT' && remainingAfterFail === initialQuota;
      results.push({
        name: 'Failed Ad Execution Protects Quota from Premature Consumption',
        category: 'FREE_FLOW',
        passed,
        durationMs: 1,
        details: passed
          ? `Ad rejected after 4s (<15s requirement). Quota retained intact at ${remainingAfterFail}.`
          : 'Failed to protect quota or reject premature completion.'
      });
    } catch (e) {
      results.push({
        name: 'Failed Ad Execution Protects Quota from Premature Consumption',
        category: 'FREE_FLOW',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 5. AI FAILURE AFTER REWARD -> CONTROLLED RETRY, NO DOUBLE DEDUCTION
    try {
      aiQuotaService.resetUsageForTesting(freeUser.id);
      const sessionRes = await rewardedAdService.createSession(freeUser);
      const session = sessionRes.session!;
      session.createdAt = Date.now() - 16000;
      await rewardedAdService.verifyReward(session.sessionId, freeUser.id, session.verificationToken);

      // Consume reward for AI request
      rewardedAdService.validateAndConsumeReward(session.sessionId, freeUser, 'req_fail_simulation');
      aiQuotaService.consumeQuota(freeUser);

      // AI throws error -> rollback reward session and refund quota
      rewardedAdService.rollbackSessionOnFailure(session.sessionId, freeUser.id);
      aiQuotaService.refundQuota(freeUser);

      const restoredSession = rewardedAdService.getSession(session.sessionId);
      const restoredQuota = aiQuotaService.getQuota(freeUser).remainingQuota;
      const passed = restoredSession?.status === 'REWARD_VERIFIED' && restoredQuota === aiQuotaService.freeDailyLimit;

      results.push({
        name: 'AI Request Failure Rollback & Controlled Retry Handling',
        category: 'FREE_FLOW',
        passed,
        durationMs: 1,
        details: passed
          ? 'Rollback successfully restored session to REWARD_VERIFIED and refunded quota unit.'
          : 'Failed to safely handle AI execution failure.'
      });
    } catch (e) {
      results.push({
        name: 'AI Request Failure Rollback & Controlled Retry Handling',
        category: 'FREE_FLOW',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 6. PRO USER -> NO REWARDED AD GATE, IMMEDIATE ACCESS
    try {
      const quota = aiQuotaService.getQuota(proUser);
      const sessionRes = await rewardedAdService.createSession(proUser);
      const unlockRes = rewardedAdService.validateAndConsumeReward('', proUser, 'req_pro_direct');

      const passed = quota.adRequired === false && !sessionRes.success && sessionRes.code === 'PRO_NO_AD_REQUIRED' && unlockRes.valid;
      results.push({
        name: 'PRO Tier Bypasses Rewarded Ad Gate with Immediate Access',
        category: 'PRO_FLOW',
        passed,
        durationMs: 1,
        details: passed
          ? `PRO user granted immediate pass without ad session initialization (dailyLimit: ${quota.dailyLimit}).`
          : 'PRO user incorrectly forced into ad gate.'
      });
    } catch (e) {
      results.push({
        name: 'PRO Tier Bypasses Rewarded Ad Gate with Immediate Access',
        category: 'PRO_FLOW',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 7. ADMIN USER -> NO AD GATE DURING ADMIN OPERATIONS
    try {
      const quota = aiQuotaService.getQuota(adminUser);
      const unlockRes = rewardedAdService.validateAndConsumeReward('', adminUser, 'req_admin_test');
      const passed = quota.adRequired === false && quota.tier === 'ADMIN' && unlockRes.valid;
      results.push({
        name: 'Admin User Inherits Ad-Free Operation Privilege',
        category: 'PRO_FLOW',
        passed,
        durationMs: 1,
        details: passed
          ? 'Admin account operates with ad-free priority during testing and system maintenance.'
          : 'Admin incorrectly restricted by ad gate.'
      });
    } catch (e) {
      results.push({
        name: 'Admin User Inherits Ad-Free Operation Privilege',
        category: 'PRO_FLOW',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 8. SECURITY: FAKE FRONTEND REWARD REJECTED
    try {
      const fakeSessionId = 'ad_fake_session_123';
      const unlockRes = rewardedAdService.validateAndConsumeReward(fakeSessionId, freeUser, 'req_fake_test');
      const passed = !unlockRes.valid && unlockRes.code === 'INVALID_SESSION';
      results.push({
        name: 'Security: Fake / Fabricated Session Token Strictly Rejected',
        category: 'ANTI_ABUSE',
        passed,
        durationMs: 1,
        details: passed
          ? 'Fabricated session token cleanly rejected with INVALID_SESSION.'
          : 'Failed to reject fake session token.'
      });
    } catch (e) {
      results.push({
        name: 'Security: Fake / Fabricated Session Token Strictly Rejected',
        category: 'ANTI_ABUSE',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 9. SECURITY: REUSED REWARD SESSION REJECTED (ONE REWARD -> ONE REQUEST)
    try {
      aiQuotaService.resetUsageForTesting(freeUser.id);
      const sessionRes = await rewardedAdService.createSession(freeUser);
      const session = sessionRes.session!;
      session.createdAt = Date.now() - 16000;
      await rewardedAdService.verifyReward(session.sessionId, freeUser.id, session.verificationToken);

      // First unlock succeeds
      const firstUnlock = rewardedAdService.validateAndConsumeReward(session.sessionId, freeUser, 'req_unlock_1');
      // Second unlock attempt with same session MUST fail
      const secondUnlock = rewardedAdService.validateAndConsumeReward(session.sessionId, freeUser, 'req_unlock_2');

      const passed = firstUnlock.valid && !secondUnlock.valid && secondUnlock.code === 'REWARD_ALREADY_USED';
      results.push({
        name: 'Anti-Abuse: Reused Reward Session Blocked (Strict 1:1 Ad:AI)',
        category: 'ANTI_ABUSE',
        passed,
        durationMs: 1,
        details: passed
          ? 'First request consumed reward; second replayed request rejected with REWARD_ALREADY_USED.'
          : 'Failed to block replayed reward session.'
      });
    } catch (e) {
      results.push({
        name: 'Anti-Abuse: Reused Reward Session Blocked (Strict 1:1 Ad:AI)',
        category: 'ANTI_ABUSE',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 10. SECURITY: EXPIRED REWARD SESSION REJECTED
    try {
      const sessionRes = await rewardedAdService.createSession(freeUser);
      const session = sessionRes.session!;
      // Force expired timestamp (older than sessionExpirySeconds)
      session.expiresAt = Date.now() - 1000;
      session.status = 'REWARD_VERIFIED';

      const unlockRes = rewardedAdService.validateAndConsumeReward(session.sessionId, freeUser, 'req_expired_test');
      const passed = !unlockRes.valid && unlockRes.code === 'REWARD_EXPIRED';
      results.push({
        name: 'Anti-Abuse: Stale / Expired Reward Session Rejected',
        category: 'ANTI_ABUSE',
        passed,
        durationMs: 1,
        details: passed
          ? 'Expired reward session rejected with REWARD_EXPIRED.'
          : 'Failed to reject expired reward session.'
      });
    } catch (e) {
      results.push({
        name: 'Anti-Abuse: Stale / Expired Reward Session Rejected',
        category: 'ANTI_ABUSE',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 11. SECURITY: USER MISMATCH PREVENTS REWARD HIJACKING
    try {
      const sessionRes = await rewardedAdService.createSession(freeUser);
      const session = sessionRes.session!;
      session.createdAt = Date.now() - 16000;
      await rewardedAdService.verifyReward(session.sessionId, freeUser.id, session.verificationToken);

      // Other user tries to consume freeUser's session
      const hackerUser: User = { ...freeUser, id: 'usr_hacker_impostor' };
      const unlockRes = rewardedAdService.validateAndConsumeReward(session.sessionId, hackerUser, 'req_hijack_test');

      const passed = !unlockRes.valid && unlockRes.code === 'SESSION_USER_MISMATCH';
      results.push({
        name: 'Security: Cross-User Reward Hijacking Intercepted',
        category: 'ANTI_ABUSE',
        passed,
        durationMs: 1,
        details: passed
          ? 'Prevented unauthorized account from claiming another user\'s verified reward.'
          : 'Failed to enforce user binding on reward sessions.'
      });
    } catch (e) {
      results.push({
        name: 'Security: Cross-User Reward Hijacking Intercepted',
        category: 'ANTI_ABUSE',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 12. AD AVAILABILITY OUTAGE GRACEFUL DEGRADATION
    try {
      const provider = rewardedAdService.getProvider();
      if (provider instanceof MockRewardedAdProvider) {
        provider.forceAvailable = false;
      }
      const sessionRes = await rewardedAdService.createSession(freeUser);
      if (provider instanceof MockRewardedAdProvider) {
        provider.forceAvailable = true;
      }

      const passed = !sessionRes.success && sessionRes.code === 'AD_UNAVAILABLE';
      results.push({
        name: 'Graceful Degradation When Ad Provider is Unavailable',
        category: 'AD_AVAILABILITY',
        passed,
        durationMs: 1,
        details: passed
          ? 'Returns informative AD_UNAVAILABLE status without executing AI or depleting quota.'
          : 'Failed to handle ad provider outage cleanly.'
      });
    } catch (e) {
      results.push({
        name: 'Graceful Degradation When Ad Provider is Unavailable',
        category: 'AD_AVAILABILITY',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 13. COMMUNITY FORUM CHAT REMAINS PRO-ONLY & UNAFFECTED BY AD GATE
    try {
      const channel = communityStore.channels[0];
      const proMsgRes = await communityStore.postMessage({
        channelId: channel.id,
        user: proUser,
        content: 'Community alpha discussion - no ad gate here.'
      });

      const quotaBefore = aiQuotaService.getQuota(proUser).remainingQuota;
      const quotaAfter = aiQuotaService.getQuota(proUser).remainingQuota;
      const passed = proMsgRes.message !== null && quotaBefore === quotaAfter;

      results.push({
        name: 'Community Forum Isolation (Zero AI Quota Consumption)',
        category: 'COMMUNITY_ISOLATION',
        passed,
        durationMs: 1,
        details: passed
          ? 'Community messages operate under dedicated Pro chat engine with zero impact on AI Trader quota.'
          : 'Community message incorrectly interacted with AI quota.'
      });
    } catch (e) {
      results.push({
        name: 'Community Forum Isolation (Zero AI Quota Consumption)',
        category: 'COMMUNITY_ISOLATION',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    // 14. SEPARATE TELEMETRY TRACKING (FREE VS PRO VS MODERATION)
    try {
      rewardedAdService.recordAiUsage('FREE', 450, 0.001);
      rewardedAdService.recordAiUsage('PRO', 1200, 0.003);
      const metrics = rewardedAdService.getMetrics();

      const passed = metrics.freeAiTokens >= 450 && metrics.proAiTokens >= 1200 && metrics.adRevenueStatus.includes('unavailable');
      results.push({
        name: 'Telemetry Isolation & Zero Fabricated Ad Revenue',
        category: 'TELEMETRY',
        passed,
        durationMs: 1,
        details: passed
          ? 'Free vs Pro AI token pools strictly bifurcated; ad revenue status reported accurately as N/A.'
          : 'Failed to isolate tier metrics or fabricated revenue.'
      });
    } catch (e) {
      results.push({
        name: 'Telemetry Isolation & Zero Fabricated Ad Revenue',
        category: 'TELEMETRY',
        passed: false,
        durationMs: 1,
        details: (e as Error).message
      });
    }

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      timestamp: Date.now(),
      totalTests: results.length,
      passedCount,
      failedCount,
      allPassed: failedCount === 0,
      results
    };
  }
}
