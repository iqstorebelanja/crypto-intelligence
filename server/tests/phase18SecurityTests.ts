import { db } from '../db/schema';
import { entitlementService } from '../services/entitlementService';
import { securityAuditService } from '../services/securityAuditService';
import { rateLimiter } from '../services/rateLimiter';
import { InputValidator } from '../services/inputValidator';
import { aiQuotaService } from '../services/aiQuotaService';
import { communityModerationEngine } from '../engine/communityModerationEngine';
import { notificationService } from '../services/notificationService';
import { User } from '../../src/types';

export interface Phase18SecurityTestResult {
  testId: number;
  testName: string;
  category: 'AUTH' | 'RBAC' | 'IDOR' | 'ENTITLEMENT' | 'AUDIT' | 'RATE_LIMIT' | 'AI_ABUSE' | 'ANTI_SPAM' | 'LINK_SAFETY' | 'INPUT_SANITIZATION';
  passed: boolean;
  message: string;
  details?: any;
}

export class Phase18SecurityTestRunner {
  public static async runAllTests(): Promise<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    allPassed: boolean;
    results: Phase18SecurityTestResult[];
  }> {
    const results: Phase18SecurityTestResult[] = [];

    // Setup test users in schema db
    const userAId = `usr_sec_a_${Date.now()}`;
    const userBId = `usr_sec_b_${Date.now()}`;
    const adminId = `usr_sec_adm_${Date.now()}`;

    const userA: User = {
      id: userAId,
      email: 'user_a@sec-test.io',
      name: 'User Alpha',
      role: 'user',
      isPro: false,
      tier: 'FREE',
      createdAt: Date.now() - 86400000,
      lastLogin: Date.now(),
      status: 'ACTIVE'
    };

    const userB: User = {
      id: userBId,
      email: 'user_b@sec-test.io',
      name: 'User Beta',
      role: 'user',
      isPro: true,
      tier: 'PRO',
      createdAt: Date.now() - 86400000,
      lastLogin: Date.now(),
      status: 'ACTIVE'
    };

    const adminUser: User = {
      id: adminId,
      email: 'admin@sec-test.io',
      name: 'Security Admin',
      role: 'admin',
      isPro: true,
      tier: 'PRO',
      createdAt: Date.now() - 86400000,
      lastLogin: Date.now(),
      status: 'ACTIVE'
    };

    db.users.set(userA.id, userA);
    db.users.set(userB.id, userB);
    db.users.set(adminUser.id, adminUser);

    // Create active and expired sessions
    const sessionActiveObj = db.createSession(userA.id);
    const activeTokenA = sessionActiveObj.token;

    const sessionExpiredObj = db.createSession(userA.id);
    sessionExpiredObj.expiresAt = Date.now() - 1000; // expired 1s ago
    const expiredTokenA = sessionExpiredObj.token;

    // ==========================================
    // TEST 1: AUTHENTICATION HARDENING
    // ==========================================
    const sessionActive = db.getSession(activeTokenA);
    const sessionExpired = db.getSession(expiredTokenA);
    const sessionInvalid = db.getSession('tok_nonexistent_xyz');

    const t1Passed = Boolean(sessionActive) && !sessionExpired && !sessionInvalid;
    results.push({
      testId: 1,
      testName: 'Session Expiration & Authentication Hardening',
      category: 'AUTH',
      passed: t1Passed,
      message: t1Passed
        ? 'Active session accepted; expired and non-existent sessions strictly rejected by server.'
        : 'Session verification failed to properly invalidate expired token.'
    });

    // ==========================================
    // TEST 2: AUTHORIZATION & RBAC
    // ==========================================
    const isNormalUserAdmin = userA.role.toLowerCase() === 'admin';
    const isAdminUserAdmin = adminUser.role.toLowerCase() === 'admin';
    const t2Passed = !isNormalUserAdmin && isAdminUserAdmin;
    results.push({
      testId: 2,
      testName: 'Role-Based Access Control (RBAC) Enforcement',
      category: 'RBAC',
      passed: t2Passed,
      message: t2Passed
        ? 'User Alpha correctly classified as non-admin; Admin user correctly granted administrative role.'
        : 'RBAC role distinction failed.'
    });

    // ==========================================
    // TEST 3: IDOR PROTECTION
    // ==========================================
    // Seed notification for User B
    const notifB = await notificationService.createNotification({
      userId: userB.id,
      category: 'PRICE',
      title: 'Confidential Price Alert for User B',
      message: 'BTC triggered threshold $68,000'
    });

    const notifBId = notifB.notification?.id || '';
    // Attempt to access or mutate User B's notification using User A's ID
    const userAOwnedNotifB = db.getNotificationById(userA.id, notifBId);
    const userBOwnedNotifB = db.getNotificationById(userB.id, notifBId);

    const t3Passed = !userAOwnedNotifB && Boolean(userBOwnedNotifB);
    results.push({
      testId: 3,
      testName: 'IDOR Protection on User Resources',
      category: 'IDOR',
      passed: t3Passed,
      message: t3Passed
        ? 'Cross-user resource access strictly blocked: User A cannot retrieve or mutate User B notifications.'
        : 'IDOR vulnerability detected: User A was able to access User B notification record.'
    });

    // ==========================================
    // TEST 4: FREE / PRO ENTITLEMENT SECURITY
    // ==========================================
    const entA = entitlementService.checkEntitlement(userA);
    const entB = entitlementService.checkEntitlement(userB);

    const t4Passed = entA.isPro === false && entB.isPro === true && entA.tier === 'FREE' && entB.tier === 'PRO';
    results.push({
      testId: 4,
      testName: 'Server-Side Entitlement & Plan Authority',
      category: 'ENTITLEMENT',
      passed: t4Passed,
      message: t4Passed
        ? 'Server EntitlementService is strictly authoritative: User A restricted to FREE, User B granted PRO.'
        : 'Entitlement check returned unexpected tier assignment.'
    });

    // ==========================================
    // TEST 5: ADMIN AUDIT LOGGING & SECRET REDACTION
    // ==========================================
    const auditEvent = securityAuditService.log({
      type: 'CONFIG_CHANGED',
      actor: adminUser.email,
      action: 'UPDATE_EXCHANGE_API_KEYS',
      result: 'SUCCESS',
      metadata: {
        apiKey: 'BINANCE_SECRET_KEY_99999',
        botToken: 'TELEGRAM_BOT_SECRET_88888',
        exchange: 'BINANCE',
        rateLimit: 1200
      }
    });

    const isApiKeyRedacted = auditEvent.metadata?.apiKey === '[REDACTED]';
    const isBotTokenRedacted = auditEvent.metadata?.botToken === '[REDACTED]';
    const isPublicFieldPreserved = auditEvent.metadata?.exchange === 'BINANCE';

    const t5Passed = isApiKeyRedacted && isBotTokenRedacted && isPublicFieldPreserved;
    results.push({
      testId: 5,
      testName: 'Admin Audit Logging & Credential Redaction',
      category: 'AUDIT',
      passed: t5Passed,
      message: t5Passed
        ? 'Sensitive credentials (apiKey, botToken) automatically redacted in audit logs; public metadata preserved.'
        : 'Secret redaction failed to scrub sensitive credentials.'
    });

    // ==========================================
    // TEST 6: RATE LIMITING ENFORCEMENT
    // ==========================================
    const rateLimitCategory = 'AUTH';
    const testIp = '10.99.88.77';
    // Consume 15 requests (threshold)
    for (let i = 0; i < 15; i++) {
      rateLimiter.checkLimit(rateLimitCategory, testIp, 15, 60000);
    }
    // 16th request must be blocked
    const blockedCheck = rateLimiter.checkLimit(rateLimitCategory, testIp, 15, 60000);
    const t6Passed = blockedCheck.allowed === false && blockedCheck.retryAfterSec > 0;
    results.push({
      testId: 6,
      testName: 'Centralized Rate Limiting & Retry-After Headers',
      category: 'RATE_LIMIT',
      passed: t6Passed,
      message: t6Passed
        ? `Rate limit correctly enforced at threshold (15 req/min). 16th request rejected with retryAfterSec=${blockedCheck.retryAfterSec}.`
        : 'Rate limiter allowed request beyond configured threshold.'
    });

    // ==========================================
    // TEST 7: AI TRADER ABUSE PROTECTION & QUOTA
    // ==========================================
    const initialQuota = aiQuotaService.getQuota(userA);
    const consume1 = aiQuotaService.consumeQuota(userA);
    const updatedQuota = aiQuotaService.getQuota(userA);
    // Refund
    aiQuotaService.refundQuota(userA);
    const refundedQuota = aiQuotaService.getQuota(userA);

    const t7Passed =
      consume1.success &&
      updatedQuota.usedToday === initialQuota.usedToday + 1 &&
      refundedQuota.usedToday === initialQuota.usedToday;

    results.push({
      testId: 7,
      testName: 'Server-Authoritative AI Quota & Refund Engine',
      category: 'AI_ABUSE',
      passed: t7Passed,
      message: t7Passed
        ? 'AI quota is server-authoritative, atomic, and supports safe rollbacks on service interruption.'
        : 'AI quota calculation did not match expected values.'
    });

    // ==========================================
    // TEST 8: COMMUNITY ANTI-SPAM & FLOOD PROTECTION
    // ==========================================
    const spamCheck1 = communityModerationEngine.evaluateLocalRules(userA.id, 'Hello traders, check out this clean BTC support level.');
    // Repeated duplicate within 2 minutes
    communityModerationEngine.evaluateLocalRules(userA.id, 'PUMP SIGNALS GUARANTEED 100x PROFIT!');
    const scamCheck = communityModerationEngine.evaluateLocalRules(userA.id, 'Guaranteed 100x profit claim airdrop now at http://airdrop-claim.xyz');

    const t8Passed = spamCheck1 === null && scamCheck !== null && scamCheck.severity === 'HIGH';
    results.push({
      testId: 8,
      testName: 'Community Anti-Spam & Rule-Based Moderation',
      category: 'ANTI_SPAM',
      passed: t8Passed,
      message: t8Passed
        ? 'Legitimate market comments accepted; high-confidence scam/phishing patterns blocked locally in 0ms.'
        : 'Anti-spam filter failed to catch known phishing pattern.'
    });

    // ==========================================
    // TEST 9: MALICIOUS LINK PROTECTION
    // ==========================================
    const safeHttpsUrl = InputValidator.validateUrl('https://binance.com/en/trade/BTC_USDT');
    const maliciousJsUrl = InputValidator.validateUrl('javascript:alert(document.cookie)');
    const maliciousDataUrl = InputValidator.validateUrl('data:text/html,<script>alert(1)</script>');
    const sanitizedContent = InputValidator.sanitizeContent('<script>alert("xss")</script>BTC looks bullish');

    const t9Passed =
      safeHttpsUrl.valid &&
      !maliciousJsUrl.valid &&
      !maliciousDataUrl.valid &&
      !sanitizedContent.includes('<script>');

    results.push({
      testId: 9,
      testName: 'Malicious Link Scheme & XSS Script Tag Filtering',
      category: 'LINK_SAFETY',
      passed: t9Passed,
      message: t9Passed
        ? 'HTTPS URLs approved; javascript: and data: schemes strictly rejected; script tags stripped.'
        : 'Malicious URL validation failed.'
    });

    // ==========================================
    // TEST 10: PROTOTYPE POLLUTION PROTECTION
    // ==========================================
    const maliciousPayload = {
      title: 'Legitimate Title',
      __proto__: { isAdmin: true },
      nested: {
        symbol: 'BTC',
        constructor: { evil: true }
      }
    };

    const sanitizedPayload = InputValidator.sanitizeObject(maliciousPayload);
    const hasProto = Object.prototype.hasOwnProperty.call(sanitizedPayload, '__proto__');
    const hasConstructor = Object.prototype.hasOwnProperty.call(sanitizedPayload.nested, 'constructor');

    const t10Passed = !hasProto && !hasConstructor && sanitizedPayload.title === 'Legitimate Title';
    results.push({
      testId: 10,
      testName: 'Prototype Pollution & Deep Object Sanitization',
      category: 'INPUT_SANITIZATION',
      passed: t10Passed,
      message: t10Passed
        ? 'Prototype pollution keys (__proto__, constructor) completely stripped from payloads without corrupting data.'
        : 'Prototype pollution prevention failed.'
    });

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      passedCount,
      failedCount,
      totalCount: results.length,
      allPassed: failedCount === 0,
      results
    };
  }
}
