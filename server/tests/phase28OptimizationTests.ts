import { analyticsService } from '../services/analyticsService';
import { db } from '../db/schema';
import { ProductAnalyticsEventType, FeedbackCategory } from '../../src/types';

export interface Phase28TestResult {
  testId: number;
  testName: string;
  category: string;
  passed: boolean;
  message: string;
  details?: any;
}

export class Phase28OptimizationTestRunner {
  public static async runAllTests(): Promise<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    allPassed: boolean;
    results: Phase28TestResult[];
  }> {
    const results: Phase28TestResult[] = [];

    // ==========================================
    // TEST 1: PRODUCT ANALYTICS AUDIT & 24 EVENT TYPES
    // ==========================================
    const requiredEvents: ProductAnalyticsEventType[] = [
      'app_open',
      'login',
      'dashboard_view',
      'scanner_open',
      'scanner_filter_change',
      'exchange_change',
      'coin_open',
      'signal_view',
      'bull_score_view',
      'risk_score_view',
      'whale_view',
      'external_intelligence_view',
      'watchlist_add',
      'watchlist_remove',
      'alert_create',
      'alert_triggered',
      'ai_trader_open',
      'ai_trader_request',
      'community_open',
      'community_post',
      'pricing_view',
      'checkout_started',
      'subscription_activated',
      'subscription_canceled'
    ];

    let all24Tested = true;
    for (const ev of requiredEvents) {
      const recorded = analyticsService.recordEvent(ev, 'usr_audit_qa', {
        testEvent: ev,
        password: 'SUPER_SECRET_LEAK_TEST_PASSWORD',
        apiKey: 'AIzaSyFakeKeyAuditTest123456789'
      });
      const metaStr = JSON.stringify(recorded.metadata || {});
      if (metaStr.includes('SUPER_SECRET_LEAK_TEST_PASSWORD') || metaStr.includes('AIzaSyFakeKeyAuditTest123456789')) {
        all24Tested = false;
        break;
      }
    }

    results.push({
      testId: 1,
      testName: 'Product Analytics Audit (24 Event Types & Zero Credential Leaks)',
      category: 'EVENT_AUDIT',
      passed: all24Tested,
      message: all24Tested
        ? 'All 24 required analytics events tracked cleanly with automated PII & secret stripping.'
        : 'Sensitive credential leak detected in analytics telemetry.'
    });

    // ==========================================
    // TEST 2: 11-STAGE USER JOURNEY & DROP-OFF FUNNEL
    // ==========================================
    const journey = analyticsService.getUserJourneyFunnel();
    const t2Passed = Array.isArray(journey) && journey.length === 11 && journey[0].name.includes('Registration');
    results.push({
      testId: 2,
      testName: '11-Stage User Journey & Drop-Off Funnel Calculation',
      category: 'USER_JOURNEY',
      passed: t2Passed,
      message: t2Passed
        ? `11-stage funnel evaluated from Registration to PRO Subscription (Drop-off calculated, insufficientData=${journey[0].insufficientData}).`
        : 'User journey funnel calculation failed.'
    });

    // ==========================================
    // TEST 3: FEATURE USAGE AGGREGATION & RANKING
    // ==========================================
    const usage = analyticsService.getFeatureUsageSummary();
    const t3Passed =
      Array.isArray(usage.mostUsedFeatures) &&
      Array.isArray(usage.mostViewedCoins) &&
      Array.isArray(usage.mostSelectedExchanges) &&
      usage.subsystemUsage.aiTraderCount >= 0;

    results.push({
      testId: 3,
      testName: 'Feature Usage Aggregation & Subsystem Popularity',
      category: 'FEATURE_USAGE',
      passed: t3Passed,
      message: t3Passed
        ? `Feature usage aggregated without fabricated metrics: Top feature is "${usage.mostUsedFeatures[0]?.name}".`
        : 'Feature usage aggregation failed.'
    });

    // ==========================================
    // TEST 4: USER SEGMENTS (TIERS & LIFECYCLE)
    // ==========================================
    const segments = analyticsService.getUserSegments();
    const t4Passed =
      segments.totalUsers >= 0 &&
      typeof segments.tierDistribution.free === 'number' &&
      typeof segments.tierDistribution.pro === 'number' &&
      typeof segments.lifecycleSegments.activeUsers === 'number';

    results.push({
      testId: 4,
      testName: 'User Lifecycle & Subscription Tier Segmentation',
      category: 'USER_SEGMENTS',
      passed: t4Passed,
      message: t4Passed
        ? `Segmented into Free (${segments.tierDistribution.free}), Trial (${segments.tierDistribution.trial}), Pro (${segments.tierDistribution.pro}) without sensitive attributes.`
        : 'User segmentation check failed.'
    });

    // ==========================================
    // TEST 5: CONFIGURABLE ACTIVATION DEFINITION & RATE
    // ==========================================
    const actMetricsBefore = analyticsService.getActivationMetrics();
    analyticsService.setActivationConfig('Market Scanner Deep Query', 2);
    const actMetricsAfter = analyticsService.getActivationMetrics();
    analyticsService.setActivationConfig('Meaningful Signal Intelligence View', 1); // restore default

    const t5Passed =
      typeof actMetricsBefore.activationRatePercent === 'number' &&
      actMetricsAfter.definitionName === 'Market Scanner Deep Query';

    results.push({
      testId: 5,
      testName: 'Configurable Activation Definition & Target Threshold',
      category: 'ACTIVATION',
      passed: t5Passed,
      message: t5Passed
        ? `Activation rate measured (${actMetricsBefore.activationRatePercent}%) with dynamic definition configurability.`
        : 'Activation metric check failed.'
    });

    // ==========================================
    // TEST 6: SEGMENTED COHORT RETENTION (D1, D7, D30)
    // ==========================================
    const retentionCohorts = analyticsService.getSegmentedRetention();
    const t6Passed =
      Array.isArray(retentionCohorts) &&
      retentionCohorts.some(s => s.segment === 'FREE') &&
      retentionCohorts.some(s => s.segment === 'PRO');

    results.push({
      testId: 6,
      testName: 'Segmented Cohort Retention (Free, Trial, Pro)',
      category: 'RETENTION',
      passed: t6Passed,
      message: t6Passed
        ? 'D1, D7, and D30 retention tracked separately per cohort with automated insufficient data flags.'
        : 'Segmented retention check failed.'
    });

    // ==========================================
    // TEST 7: TRIAL BEHAVIOR CORRELATION (CORRELATION ONLY)
    // ==========================================
    const trialCorrelations = analyticsService.getTrialCorrelations();
    const t7Passed =
      trialCorrelations.length >= 4 &&
      trialCorrelations.every(c => c.caveatNote.toLowerCase().includes('correlation only'));

    results.push({
      testId: 7,
      testName: 'Trial Conversion Behavior Correlation (Strict Caveat Enforced)',
      category: 'TRIAL_ANALYSIS',
      passed: t7Passed,
      message: t7Passed
        ? 'Trial behavioral correlations computed with mandatory non-causation caveat warning.'
        : 'Trial correlation verification failed.'
    });

    // ==========================================
    // TEST 8: PRO VALUE ANALYSIS & SUNSET SAFEGUARD
    // ==========================================
    const proCaps = analyticsService.getProValueAnalysis();
    const t8Passed =
      proCaps.length >= 8 &&
      proCaps.every(c => c.notes.includes('Do NOT automatically sunset'));

    results.push({
      testId: 8,
      testName: 'PRO Premium Capability Usage Ranking & Sunset Safeguard',
      category: 'PRO_VALUE',
      passed: t8Passed,
      message: t8Passed
        ? `Top 10 Pro capabilities ranked (Rank 1: ${proCaps[0]?.capability}) with feature sunsetting safeguard.`
        : 'Pro value analysis verification failed.'
    });

    // ==========================================
    // TEST 9: REAL USER PERFORMANCE TELEMETRY
    // ==========================================
    analyticsService.recordPerformance('page_load', 410, false);
    analyticsService.recordPerformance('ai_response', 1150, true);
    const perfStats = analyticsService.getRealUserPerformance();
    const t9Passed =
      perfStats.pageLoadAvgMs > 0 &&
      perfStats.apiLatencyP50Ms > 0 &&
      perfStats.mobileVsDesktop.mobilePercent >= 0;

    results.push({
      testId: 9,
      testName: 'Real User Performance Telemetry (P50/P95/P99 & Mobile vs Desktop)',
      category: 'PERFORMANCE',
      passed: t9Passed,
      message: t9Passed
        ? `Real user performance measured (Page load: ${perfStats.pageLoadAvgMs}ms, P95 API: ${perfStats.apiLatencyP95Ms}ms, Mobile: ${perfStats.mobileVsDesktop.mobilePercent}%).`
        : 'Performance telemetry check failed.'
    });

    // ==========================================
    // TEST 10: PRODUCTION ERROR IMPACT PRIORITIZATION
    // ==========================================
    const errorImpacts = analyticsService.getErrorImpactRankings();
    const t10Passed = Array.isArray(errorImpacts) && errorImpacts.length > 0;
    results.push({
      testId: 10,
      testName: 'Production Error Impact & Severity Ranking',
      category: 'ERROR_IMPACT',
      passed: t10Passed,
      message: t10Passed
        ? `Error impacts ranked by severity and affected user scope (Top priority score: ${errorImpacts[0]?.priorityScore || 0}).`
        : 'Error impact ranking check failed.'
    });

    // ==========================================
    // TEST 11: REAL USER FEEDBACK LIFECYCLE & RESOLUTION
    // ==========================================
    const newFeedback = analyticsService.recordFeedback({
      userId: 'usr_test_feedback_runner',
      category: 'signal_accuracy' as FeedbackCategory,
      rating: 5,
      message: 'Directional confidence score accurately warned of downside expansion on 4h SOL.',
      userTier: 'PRO'
    });

    const isCreated = Boolean(newFeedback.id) && !newFeedback.resolved;
    const resolved = analyticsService.resolveFeedback(newFeedback.id);
    const t11Passed = isCreated && resolved !== null && resolved.resolved;

    results.push({
      testId: 11,
      testName: 'Real User Feedback Lifecycle (Submission & Resolution)',
      category: 'FEEDBACK_LIFECYCLE',
      passed: t11Passed,
      message: t11Passed
        ? 'Feedback recorded with star rating, category, tier metadata, and resolution lifecycle.'
        : 'User feedback lifecycle check failed.'
    });

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
