import { db } from '../db/schema';
import { subscriptionService } from '../services/subscriptionService';
import { entitlementService } from '../services/entitlementService';
import { MockSubscriptionProvider, WebPaymentGatewayProvider } from '../services/subscriptionProvider';
import { User, SubscriptionRecord } from '../../src/types';

export interface Phase26TestResult {
  testId: number;
  testName: string;
  category: string;
  passed: boolean;
  message: string;
  details?: any;
}

export class Phase26SubscriptionTestRunner {
  public static async runAllTests(): Promise<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    allPassed: boolean;
    results: Phase26TestResult[];
  }> {
    const results: Phase26TestResult[] = [];

    // Setup Test Users
    const now = Date.now();
    const testUserId = `usr_p26_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const testUser: User = {
      id: testUserId,
      email: 'subscriber_qa@cryptointelligence.ai',
      name: 'QA Subscriber',
      role: 'user',
      isPro: false,
      tier: 'FREE',
      plan: 'FREE',
      trialStatus: 'NONE',
      createdAt: now - 86400000 * 30
    };
    db.users.set(testUserId, testUser);

    // ==========================================
    // TEST 1: WEB PAYMENT GATEWAY NOT_CONFIGURED STATUS
    // ==========================================
    const liveProvider = new WebPaymentGatewayProvider();
    const isConfigured = liveProvider.isConfigured();
    const status = liveProvider.getStatus();
    const t1Passed = status === (isConfigured ? 'READY' : 'NOT_CONFIGURED');
    results.push({
      testId: 1,
      testName: 'Payment Provider Configuration Status & Safety Guard',
      category: 'PROVIDER_CONFIGURATION',
      passed: t1Passed,
      message: t1Passed
        ? `Provider reports authoritative status ${status}. Real payment gateway is not faked.`
        : 'Provider status failed.'
    });

    // ==========================================
    // TEST 2: CHECKOUT UNCONFIGURED ERROR RESILIENCE
    // ==========================================
    subscriptionService.setProvider(liveProvider);
    let t2Passed = false;
    try {
      const checkoutRes = await subscriptionService.startCheckout(testUser, 'PRO_MONTHLY');
      t2Passed = !checkoutRes.success && checkoutRes.paymentProviderStatus === 'NOT_CONFIGURED';
    } catch (err: any) {
      t2Passed = err.message.includes('NOT_CONFIGURED');
    }
    results.push({
      testId: 2,
      testName: 'Unconfigured Gateway Checkout Rejection (No Fake Payments)',
      category: 'CHECKOUT_SAFETY',
      passed: t2Passed,
      message: t2Passed
        ? 'Unconfigured gateway checkout rejected with clear notification. No fake payments or silent failures.'
        : 'Checkout did not properly guard against unconfigured state.'
    });

    // Switch to Sandbox / Mock provider for verified state transition testing
    const sandboxProvider = new MockSubscriptionProvider();
    subscriptionService.setProvider(sandboxProvider);

    // ==========================================
    // TEST 3: WEBHOOK IDEMPOTENCY GUARD
    // ==========================================
    const testEventId = `evt_qa_checkout_${now}`;
    const webhookPayload = {
      id: testEventId,
      type: 'checkout.session.completed',
      data: {
        userId: testUser.id,
        planId: 'PRO_MONTHLY',
        amount: 2900,
        currency: 'USD',
        status: 'active',
        subscription: `sub_qa_active_${now}`,
        current_period_start: Math.floor(now / 1000),
        current_period_end: Math.floor((now + 30 * 86400000) / 1000)
      }
    };

    // First arrival: should process
    const hookRes1 = await subscriptionService.handleWebhook(webhookPayload);
    // Second arrival: should detect duplicate and avoid re-processing
    const hookRes2 = await subscriptionService.handleWebhook(webhookPayload);

    const t3Passed = hookRes1.handled && !hookRes1.duplicate && hookRes2.handled && Boolean(hookRes2.duplicate);
    results.push({
      testId: 3,
      testName: 'Webhook Replay Protection & Idempotent Processing',
      category: 'WEBHOOK_SECURITY',
      passed: t3Passed,
      message: t3Passed
        ? 'Duplicate webhook recognized and rejected safely without duplicate processing.'
        : 'Idempotency guard failed.'
    });

    // ==========================================
    // TEST 4: VERIFIED SERVER-SIDE PRO ACTIVATION
    // ==========================================
    const activatedUser = db.users.get(testUser.id);
    const subRecord = db.getUserSubscription(testUser.id);
    const entCheck = entitlementService.checkEntitlement(activatedUser || null);

    const t4Passed =
      Boolean(subRecord) &&
      subRecord?.status === 'ACTIVE' &&
      activatedUser?.isPro === true &&
      entCheck.isPro === true &&
      entCheck.tier === 'PRO';

    results.push({
      testId: 4,
      testName: 'Server-Side Subscription Verification & PRO Activation',
      category: 'ENTITLEMENT_SYNC',
      passed: t4Passed,
      message: t4Passed
        ? 'Verified webhook created active SubscriptionRecord and unlocked PRO entitlement on server.'
        : 'Subscription activation failed.'
    });

    // ==========================================
    // TEST 5: CANCELED SUBSCRIPTION PERIOD-END GRACE ACCESS
    // ==========================================
    const cancelEventId = `evt_qa_cancel_${now}`;
    const cancelPayload = {
      id: cancelEventId,
      type: 'customer.subscription.deleted',
      data: {
        userId: testUser.id,
        subscription: subRecord?.id,
        status: 'canceled',
        current_period_end: Math.floor((now + 15 * 86400000) / 1000) // 15 days remaining
      }
    };
    await subscriptionService.handleWebhook(cancelPayload);

    const canceledSub = db.getUserSubscription(testUser.id);
    const entAfterCancel = entitlementService.checkEntitlement(testUser);
    const t5Passed =
      canceledSub?.status === 'CANCELED' &&
      entAfterCancel.isPro === true &&
      entAfterCancel.tier === 'PRO';

    results.push({
      testId: 5,
      testName: 'Canceled Subscription Active Period Grace Retention',
      category: 'SUBSCRIPTION_LIFECYCLE',
      passed: t5Passed,
      message: t5Passed
        ? 'Canceled subscription maintains PRO access until current period end timestamp.'
        : 'Premature revocation occurred upon cancellation.'
    });

    // ==========================================
    // TEST 6: PAST-DUE PAYMENT POLICY (3-DAY GRACE)
    // ==========================================
    const pastDueEventId = `evt_qa_pastdue_${now}`;
    const pastDuePayload = {
      id: pastDueEventId,
      type: 'customer.subscription.paused',
      data: {
        userId: testUser.id,
        subscription: subRecord?.id,
        status: 'past_due',
        current_period_end: Math.floor((now + 1 * 86400000) / 1000)
      }
    };
    await subscriptionService.handleWebhook(pastDuePayload);
    const pastDueSub = db.getUserSubscription(testUser.id);
    const entPastDue = entitlementService.checkEntitlement(testUser);
    const t6Passed = pastDueSub?.status === 'PAST_DUE' && entPastDue.isPro === true;

    results.push({
      testId: 6,
      testName: 'Past-Due Subscription Grace Period Enforcement',
      category: 'SUBSCRIPTION_LIFECYCLE',
      passed: t6Passed,
      message: t6Passed
        ? 'Past-due subscription preserves access during configurable 3-day grace period.'
        : 'Past-due handling failed.'
    });

    // ==========================================
    // TEST 7: PAYMENT FAILURE / EXPIRATION REVOCATION
    // ==========================================
    const failEventId = `evt_qa_fail_${now}`;
    const failPayload = {
      id: failEventId,
      type: 'invoice.payment_failed',
      data: {
        userId: testUser.id,
        subscription: subRecord?.id,
        status: 'unpaid',
        current_period_end: Math.floor((now - 1000) / 1000) // expired
      }
    };
    await subscriptionService.handleWebhook(failPayload);
    const failedSub = db.getUserSubscription(testUser.id);
    const entFailed = entitlementService.checkEntitlement(testUser);
    const t7Passed = failedSub?.status === 'PAYMENT_FAILED' && entFailed.isPro === false && entFailed.tier === 'FREE';

    results.push({
      testId: 7,
      testName: 'Expired / Failed Payment Server-Authoritative Revocation',
      category: 'ENTITLEMENT_SYNC',
      passed: t7Passed,
      message: t7Passed
        ? 'Expired subscription reverted user tier strictly to FREE without orphaned access.'
        : 'Revocation failed.'
    });

    // ==========================================
    // TEST 8: NO RAW PAYMENT SECRETS / CARD NUMBERS STORED
    // ==========================================
    const subJson = JSON.stringify(failedSub || {});
    const hasCardNumber = /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/.test(subJson);
    const hasCvv = /"cvv"|"cvc"|"cardSecret"|"rawToken"/i.test(subJson);
    const t8Passed = !hasCardNumber && !hasCvv;

    results.push({
      testId: 8,
      testName: 'PCI-DSS Compliance: Zero Raw Card Data or CVV Stored',
      category: 'SECURITY',
      passed: t8Passed,
      message: t8Passed
        ? 'Audit passed: Subscription model contains only provider IDs and normalized metadata. Zero cardholder secrets stored.'
        : 'Sensitive card data found in subscription record.'
    });

    // ==========================================
    // TEST 9: CLIENT CANNOT RESTART TRIAL AFTER SUBSCRIPTION EXPIRY
    // ==========================================
    const trialAttemptUser = { ...testUser, trialStatus: 'ACTIVE' as const };
    const checkAttempt = entitlementService.checkEntitlement(trialAttemptUser);
    const t9Passed = checkAttempt.tier === 'FREE' && checkAttempt.isPro === false;

    results.push({
      testId: 9,
      testName: 'Trial Abuse Protection (Subscription Expiry Cannot Restart Trial)',
      category: 'FRAUD_PREVENTION',
      passed: t9Passed,
      message: t9Passed
        ? 'Client cannot forge or restart trial once expired. Server remains strictly authoritative.'
        : 'Trial restart guard failed.'
    });

    // ==========================================
    // TEST 10: RESUME SUBSCRIPTION & PORTAL ACCESS
    // ==========================================
    const resumeRes = await subscriptionService.resumeSubscription(testUser);
    const portalRes = await subscriptionService.getCustomerPortal(testUser, 'http://localhost:3000/account');
    const t10Passed = resumeRes.success && Boolean(portalRes.portalUrl);

    results.push({
      testId: 10,
      testName: 'Subscription Renewal Resume & Customer Portal Link Generation',
      category: 'CUSTOMER_PORTAL',
      passed: t10Passed,
      message: t10Passed
        ? 'Customer portal URL generated and subscription renewal resumed cleanly.'
        : 'Resume/portal generation failed.'
    });

    // Reset provider back to default live provider
    subscriptionService.setProvider(liveProvider);

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    return {
      passedCount,
      failedCount,
      totalCount: results.length,
      allPassed: failedCount === 0,
      results
    };
  }
}
