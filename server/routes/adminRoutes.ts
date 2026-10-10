import express, { Request, Response } from 'express';
import { db } from '../db/schema';
import { scoringEngine } from '../engine/scoringEngine';
import { monitoringService } from '../services/monitoringService';
import { marketDataService } from '../services/marketDataService';
import { historicalReplayEngine } from '../engine/historicalReplayEngine';
import { advertisingService } from '../services/advertisingService';
import { notificationService } from '../services/notificationService';
import { securityAuditService } from '../services/securityAuditService';
import { Phase18SecurityTestRunner } from '../tests/phase18SecurityTests';
import { Phase19PerformanceTestRunner } from '../tests/phase19PerformanceTests';
import { Phase21ExternalIntelTestRunner } from '../tests/phase21ExternalIntelTests';
import { Phase22ExternalIntegrationTestRunner } from '../tests/phase22ExternalIntegrationTests';
import { Phase15EntitlementTestRunner } from '../tests/phase15EntitlementTests';
import { Phase26SubscriptionTestRunner } from '../tests/phase26SubscriptionTests';
import { Phase27SoftLaunchTestRunner } from '../tests/phase27SoftLaunchTests';
import { Phase28OptimizationTestRunner } from '../tests/phase28OptimizationTests';
import { Phase29SignalQualityTestRunner } from '../tests/phase29SignalQualityTests';
import { Phase30TrustLayerTestRunner } from '../tests/phase30TrustLayerTests';
import { runPhase6Tests } from '../tests/phase6EngineTests';
import { externalIntelligenceRegistry } from '../providers/externalIntelligenceProvider';
import { databaseBackupService } from '../services/backupService';
import { featureFlagService } from '../services/featureFlagService';
import { analyticsService } from '../services/analyticsService';
import { signalQualityService } from '../services/signalQualityService';
import { signalExplanationEngine } from '../services/signalExplanationEngine';
import { ExchangeId } from '../../src/types';

export const adminRouter = express.Router();

/**
 * Audit log helper
 */
function logAudit(req: Request, action: string, target: string, details?: Record<string, any>) {
  const adminUser = (req as any).adminUser;
  db.addAdminAuditLog(
    adminUser ? adminUser.email : 'admin',
    action,
    target,
    details
  );
}

// ==========================================
// 1. SYSTEM OVERVIEW & METRICS
// ==========================================
adminRouter.get('/overview', (req: Request, res: Response) => {
  const health = monitoringService.getDetailedSystemHealth();
  const aiUsage = monitoringService.getAIUsageMetrics();
  const recentLogs = db.getSystemLogs(undefined, undefined, 10);
  const recentAudit = db.getAdminAuditLogs(10);

  res.json({
    health,
    aiUsage,
    cache: db.cacheMetrics,
    performance: db.performanceMetrics,
    counts: {
      users: db.users.size,
      activeAlerts: db.getAllActiveAlerts().length,
      managedSymbols: db.managedSymbols.size,
      systemLogs: db.systemLogs.length,
      aiErrorLogs: db.aiErrorLogs.length,
      auditLogs: db.adminAuditLogs.length
    },
    recentLogs,
    recentAudit
  });
});

// ==========================================
// 2. DATA FRESHNESS & HEALTH ENDPOINTS
// ==========================================
adminRouter.get('/freshness', (req: Request, res: Response) => {
  const items = monitoringService.getDataFreshnessList();
  res.json({
    thresholds: db.freshnessThresholds,
    items,
    summary: {
      total: items.length,
      live: items.filter(i => i.status === 'LIVE').length,
      delayed: items.filter(i => i.status === 'DELAYED').length,
      stale: items.filter(i => i.status === 'STALE').length
    }
  });
});

adminRouter.put('/freshness/thresholds', (req: Request, res: Response) => {
  const { liveMaxSec, delayedMaxSec, staleMinSec } = req.body;

  if (
    typeof liveMaxSec !== 'number' ||
    typeof delayedMaxSec !== 'number' ||
    typeof staleMinSec !== 'number'
  ) {
    return res.status(400).json({ error: 'Invalid thresholds: numbers required' });
  }

  if (liveMaxSec <= 0 || delayedMaxSec <= liveMaxSec || staleMinSec < delayedMaxSec) {
    return res.status(400).json({
      error: 'Thresholds must satisfy: 0 < liveMaxSec < delayedMaxSec <= staleMinSec'
    });
  }

  const old = { ...db.freshnessThresholds };
  db.freshnessThresholds = { liveMaxSec, delayedMaxSec, staleMinSec };

  logAudit(req, 'UPDATE_FRESHNESS_THRESHOLDS', 'FreshnessConfig', {
    old,
    new: db.freshnessThresholds
  });

  res.json({ success: true, thresholds: db.freshnessThresholds });
});

// Detailed health status
adminRouter.get('/health/detailed', (req: Request, res: Response) => {
  res.json(monitoringService.getDetailedSystemHealth());
});

// ==========================================
// 3. EXCHANGE MONITORING & TOGGLES
// ==========================================
adminRouter.get('/exchanges', (req: Request, res: Response) => {
  const binance = monitoringService.getExchangeHealth('BINANCE');
  const bybit = monitoringService.getExchangeHealth('BYBIT');
  res.json([binance, bybit]);
});

adminRouter.put('/exchanges/:id/toggle', (req: Request, res: Response) => {
  const exchangeId = req.params.id.toUpperCase() as ExchangeId;
  const ex = db.exchanges.get(exchangeId);
  if (!ex) {
    return res.status(404).json({ error: `Exchange ${exchangeId} not found.` });
  }

  ex.isEnabled = !ex.isEnabled;
  logAudit(req, 'TOGGLE_EXCHANGE', exchangeId, { isEnabled: ex.isEnabled });

  res.json({
    success: true,
    exchange: ex,
    health: monitoringService.getExchangeHealth(exchangeId)
  });
});

// ==========================================
// 4. SCANNER & MARKET SYMBOL CONFIGURATION
// ==========================================
adminRouter.get('/scanner/config', (req: Request, res: Response) => {
  res.json(db.scannerConfig);
});

adminRouter.put('/scanner/config', (req: Request, res: Response) => {
  const {
    minVolume,
    volumeSpikeThreshold,
    maxPairs,
    pollingIntervalSec,
    cacheDurationSec,
    supportedTimeframes
  } = req.body;

  const old = { ...db.scannerConfig };

  if (minVolume !== undefined) db.scannerConfig.minVolume = Number(minVolume);
  if (volumeSpikeThreshold !== undefined) db.scannerConfig.volumeSpikeThreshold = Number(volumeSpikeThreshold);
  if (maxPairs !== undefined) db.scannerConfig.maxPairs = Number(maxPairs);
  if (pollingIntervalSec !== undefined) db.scannerConfig.pollingIntervalSec = Math.max(1, Number(pollingIntervalSec));
  if (cacheDurationSec !== undefined) db.scannerConfig.cacheDurationSec = Math.max(1, Number(cacheDurationSec));
  if (Array.isArray(supportedTimeframes) && supportedTimeframes.length > 0) {
    db.scannerConfig.supportedTimeframes = supportedTimeframes;
  }

  logAudit(req, 'UPDATE_SCANNER_CONFIG', 'ScannerConfig', { old, new: db.scannerConfig });
  res.json({ success: true, config: db.scannerConfig });
});

// Managed Symbols (Rules: Do not delete market history when disabling a symbol)
adminRouter.get('/symbols', (req: Request, res: Response) => {
  const symbols = Array.from(db.managedSymbols.values());
  res.json(symbols);
});

adminRouter.put('/symbols/:symbol/toggle', (req: Request, res: Response) => {
  const rawSymbol = decodeURIComponent(req.params.symbol);
  // Support both "BTC/USDT" and "BINANCE:BTC/USDT"
  let found = db.managedSymbols.get(rawSymbol);
  if (!found) {
    // Try finding by symbol
    for (const [key, item] of db.managedSymbols.entries()) {
      if (item.symbol.toUpperCase() === rawSymbol.toUpperCase() || key.toUpperCase() === rawSymbol.toUpperCase()) {
        found = item;
        break;
      }
    }
  }

  if (!found) {
    return res.status(404).json({ error: `Symbol ${rawSymbol} not found in managed registry.` });
  }

  // Preserve history: only toggle status between ACTIVE and DISABLED
  found.status = found.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';

  logAudit(req, 'TOGGLE_SYMBOL_STATUS', found.symbol, {
    exchange: found.exchange,
    status: found.status
  });

  res.json({
    success: true,
    symbol: found,
    message: `Symbol ${found.symbol} is now ${found.status}. Historical market data is preserved.`
  });
});

// ==========================================
// 5. SCORING ENGINE CONFIGURATION & VERSIONING
// ==========================================
adminRouter.get('/scoring/config', (req: Request, res: Response) => {
  res.json({
    bull: scoringEngine.getBullConfig(),
    risk: scoringEngine.getRiskConfig(),
    history: scoringEngine.getVersionHistory()
  });
});

adminRouter.put('/scoring/bull', (req: Request, res: Response) => {
  const { weights, notes } = req.body;
  const adminUser = (req as any).adminUser;

  try {
    const updated = scoringEngine.updateBullConfig(
      weights,
      adminUser ? adminUser.email : 'admin',
      notes
    );

    logAudit(req, 'UPDATE_BULL_SCORE_CONFIG', `v${updated.version}`, {
      version: updated.version,
      weights,
      notes
    });

    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

adminRouter.put('/scoring/risk', (req: Request, res: Response) => {
  const { weights, notes } = req.body;
  const adminUser = (req as any).adminUser;

  try {
    const updated = scoringEngine.updateRiskConfig(
      weights,
      adminUser ? adminUser.email : 'admin',
      notes
    );

    logAudit(req, 'UPDATE_DOWNSIDE_RISK_CONFIG', `v${updated.version}`, {
      version: updated.version,
      weights,
      notes
    });

    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// ==========================================
// 6. GLOBAL ALERT ENGINE CONFIGURATION
// ==========================================
adminRouter.get('/alerts/config', (req: Request, res: Response) => {
  res.json(db.globalAlertConfig);
});

adminRouter.put('/alerts/config', (req: Request, res: Response) => {
  const {
    maxAlertsPerUser,
    minAlertCooldownMinutes,
    maxNotificationsPerHour,
    maxTelegramMessagesPerHour,
    systemWideAlertsEnabled
  } = req.body;

  const old = { ...db.globalAlertConfig };

  if (maxAlertsPerUser !== undefined) db.globalAlertConfig.maxAlertsPerUser = Math.max(1, Number(maxAlertsPerUser));
  if (minAlertCooldownMinutes !== undefined) db.globalAlertConfig.minAlertCooldownMinutes = Math.max(1, Number(minAlertCooldownMinutes));
  if (maxNotificationsPerHour !== undefined) db.globalAlertConfig.maxNotificationsPerHour = Math.max(1, Number(maxNotificationsPerHour));
  if (maxTelegramMessagesPerHour !== undefined) db.globalAlertConfig.maxTelegramMessagesPerHour = Math.max(1, Number(maxTelegramMessagesPerHour));
  if (systemWideAlertsEnabled !== undefined) db.globalAlertConfig.systemWideAlertsEnabled = Boolean(systemWideAlertsEnabled);

  logAudit(req, 'UPDATE_GLOBAL_ALERT_CONFIG', 'GlobalAlertConfig', { old, new: db.globalAlertConfig });
  res.json({ success: true, config: db.globalAlertConfig });
});

// Phase 17: Notification Delivery Health & Reliability Monitor
adminRouter.get('/notifications/health', async (req: Request, res: Response) => {
  const health = await notificationService.getNotificationHealth();
  const logs = notificationService.getStructuredLogs(50);
  res.json({ health, logs });
});

adminRouter.get('/notifications/failures', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const failures = notificationService.getFailedDeliveries(limit);
  res.json({ failures });
});

adminRouter.post('/notifications/retry', async (req: Request, res: Response) => {
  const { attemptId } = req.body;
  if (!attemptId) return res.status(400).json({ error: 'attemptId is required' });
  logAudit(req, 'RETRY_NOTIFICATION_DELIVERY', 'DeliveryAttempt', { attemptId });
  const result = await notificationService.retryDelivery(attemptId);
  res.json(result);
});

// ==========================================
// 7. AI TELEMETRY & ERROR MONITORING
// ==========================================
adminRouter.get('/ai/usage', (req: Request, res: Response) => {
  const metrics = monitoringService.getAIUsageMetrics();
  const errors = db.getAIErrorLogs(50);
  res.json({
    metrics,
    errors
  });
});

// ==========================================
// 8. USER MANAGEMENT (Strictly No Billing / Subscriptions)
// ==========================================
adminRouter.get('/users', (req: Request, res: Response) => {
  const users = db.getAllManagedUsers();
  res.json(users);
});

adminRouter.put('/users/:id/role', (req: Request, res: Response) => {
  const { role } = req.body;
  if (role !== 'user' && role !== 'admin') {
    return res.status(400).json({ error: "Role must be either 'user' or 'admin'" });
  }

  const updated = db.updateUserRole(req.params.id, role);
  if (!updated) {
    return res.status(404).json({ error: 'User not found' });
  }

  logAudit(req, 'UPDATE_USER_ROLE', updated.email, { newRole: role });
  res.json({ success: true, user: updated });
});

adminRouter.put('/users/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  if (status !== 'ACTIVE' && status !== 'DISABLED') {
    return res.status(400).json({ error: "Status must be 'ACTIVE' or 'DISABLED'" });
  }

  const user = db.users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.updateUserStatus(req.params.id, status);
  logAudit(req, 'UPDATE_USER_STATUS', user.email, { newStatus: status });

  res.json({
    success: true,
    user: {
      ...user,
      status
    }
  });
});

// ==========================================
// 9. LOGS & AUDIT TRAIL
// ==========================================
adminRouter.get('/logs', (req: Request, res: Response) => {
  const level = req.query.level as any;
  const source = req.query.source as any;
  const limit = Math.min(250, Math.max(1, parseInt(req.query.limit as string) || 100));

  const logs = db.getSystemLogs(level, source, limit);
  res.json(logs);
});

adminRouter.delete('/logs', (req: Request, res: Response) => {
  const count = db.systemLogs.length;
  db.systemLogs.length = 0;

  logAudit(req, 'CLEAR_SYSTEM_LOGS', 'SystemLogs', { clearedCount: count });
  res.json({ success: true, clearedCount: count });
});

adminRouter.get('/audit', (req: Request, res: Response) => {
  const limit = Math.min(250, Math.max(1, parseInt(req.query.limit as string) || 100));
  const auditLogs = db.getAdminAuditLogs(limit);
  res.json(auditLogs);
});

// ==========================================
// 10. CACHE MANAGEMENT
// ==========================================
adminRouter.post('/cache/purge', (req: Request, res: Response) => {
  db.recordCachePurge();
  logAudit(req, 'PURGE_CACHE', 'MarketDataCache', { timestamp: Date.now() });
  res.json({ success: true, message: 'Market data cache purged successfully.', cacheMetrics: db.cacheMetrics });
});

// ==========================================
// 11. VALIDATION LAB & HISTORICAL REPLAY (PHASE 5)
// ==========================================
adminRouter.post('/validation/run', async (req: Request, res: Response) => {
  try {
    const {
      symbol = 'BTCUSDT',
      exchange = 'BINANCE',
      timeframe = '1h',
      period = '30d',
      selectedHorizon = '24h',
      modelVersion,
      customFilters
    } = req.body;

    const result = await historicalReplayEngine.runValidation({
      symbol,
      exchange,
      timeframe,
      period,
      selectedHorizon,
      modelVersion,
      customFilters
    });

    logAudit(req, 'RUN_HISTORICAL_VALIDATION', symbol, {
      exchange,
      timeframe,
      period,
      selectedHorizon,
      evaluatedSignals: result.metadata?.totalSignalsEvaluated || 0,
      success: result.success
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Validation replay encountered an error.'
    });
  }
});

adminRouter.get('/validation/models', (req: Request, res: Response) => {
  const bullConfig = scoringEngine.getBullConfig();
  const riskConfig = scoringEngine.getRiskConfig();
  const history = scoringEngine.getVersionHistory();

  res.json({
    currentBullVersion: bullConfig.version,
    currentRiskVersion: riskConfig.version,
    versions: [
      {
        id: 'bull_v1',
        name: `Bull Score Model v${bullConfig.version}.0`,
        type: 'BULL',
        version: bullConfig.version,
        weights: bullConfig
      },
      {
        id: 'risk_v1',
        name: `Downside Risk Model v${riskConfig.version}.0`,
        type: 'RISK',
        version: riskConfig.version,
        weights: riskConfig
      }
    ],
    history
  });
});

// ==========================================
// PHASE 13: ADVERTISING MANAGEMENT ROUTES
// ==========================================
adminRouter.get('/advertising', (req: Request, res: Response) => {
  try {
    const config = advertisingService.getConfig();
    const creatives = advertisingService.getAllHouseAdsAdmin();
    const analytics = advertisingService.getAnalyticsSummary();
    const providerStatus = advertisingService.getProviderStatus();

    res.json({
      config,
      creatives,
      analytics,
      providerStatus
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put('/advertising/config', (req: Request, res: Response) => {
  try {
    const updated = advertisingService.updateConfig(req.body);
    logAudit(req, 'UPDATE_AD_CONFIG', 'global_ad_config', req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post('/advertising/creatives', (req: Request, res: Response) => {
  try {
    const newAd = advertisingService.createHouseAd(req.body);
    logAudit(req, 'CREATE_HOUSE_AD', newAd.id, { title: newAd.title, targetUrl: newAd.targetUrl });
    res.status(201).json(newAd);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.put('/advertising/creatives/:id', (req: Request, res: Response) => {
  try {
    const updated = advertisingService.updateHouseAd(req.params.id, req.body);
    logAudit(req, 'UPDATE_HOUSE_AD', req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.delete('/advertising/creatives/:id', (req: Request, res: Response) => {
  try {
    const success = advertisingService.deleteHouseAd(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Creative not found' });
    }
    logAudit(req, 'DELETE_HOUSE_AD', req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/advertising/creatives/:id/toggle', (req: Request, res: Response) => {
  try {
    const toggled = advertisingService.toggleHouseAdActive(req.params.id);
    logAudit(req, 'TOGGLE_HOUSE_AD_ACTIVE', req.params.id, { active: toggled.active });
    res.json(toggled);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post('/advertising/reset-analytics', (req: Request, res: Response) => {
  try {
    advertisingService.resetAnalytics();
    logAudit(req, 'RESET_AD_ANALYTICS', 'ad_analytics');
    res.json({ success: true, message: 'Ad analytics reset successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 12. SECURITY AUDIT LOGS & TEST RUNNER (PHASE 18)
// ==========================================
adminRouter.get('/security/audit-logs', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const type = req.query.type as any;
    const events = securityAuditService.getEvents(limit, type);
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/security/tests', async (req: Request, res: Response) => {
  try {
    const testSummary = await Phase18SecurityTestRunner.runAllTests();
    logAudit(req, 'RUN_SECURITY_TESTS', 'security_test_runner', {
      passed: testSummary.passedCount,
      failed: testSummary.failedCount,
      allPassed: testSummary.allPassed
    });
    res.json({
      success: true,
      timestamp: Date.now(),
      summary: testSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 13. PERFORMANCE BENCHMARK & TELEMETRY (PHASE 19)
// ==========================================
adminRouter.get('/performance/benchmark', async (req: Request, res: Response) => {
  try {
    const benchSummary = await Phase19PerformanceTestRunner.runAllTests();
    logAudit(req, 'RUN_PERFORMANCE_BENCHMARK', 'performance_test_runner', {
      passed: benchSummary.passedCount,
      failed: benchSummary.failedCount,
      allPassed: benchSummary.allPassed,
      benchmarks: benchSummary.benchmarks
    });
    res.json({
      success: true,
      timestamp: Date.now(),
      summary: benchSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/performance/telemetry', (req: Request, res: Response) => {
  try {
    const telemetry = monitoringService.getPerformanceTelemetry();
    res.json({
      success: true,
      telemetry
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 14. EXTERNAL INTELLIGENCE DATA LAYER (PHASE 21)
// ==========================================
adminRouter.get('/external-intelligence/config', (req: Request, res: Response) => {
  try {
    const config = db.getExternalIntelligenceConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put('/external-intelligence/config', (req: Request, res: Response) => {
  try {
    const updated = db.updateExternalIntelligenceConfig(req.body, (req as any).adminUser?.email || 'admin');
    logAudit(req, 'UPDATE_EXTERNAL_INTEL_CONFIG', 'external_intelligence', updated);
    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/external-intelligence/providers', (req: Request, res: Response) => {
  try {
    const summary = externalIntelligenceRegistry.getHealthSummary();
    res.json({ success: true, ...summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/external-intelligence/tests', async (req: Request, res: Response) => {
  try {
    if (req.query.phase === '22') {
      const p22Summary = await Phase22ExternalIntegrationTestRunner.runAllTests();
      logAudit(req, 'RUN_EXTERNAL_INTEL_PHASE22_TESTS', 'phase22_test_runner', {
        passed: p22Summary.passedCount,
        failed: p22Summary.failedCount,
        allPassed: p22Summary.allPassed
      });
      return res.json({
        success: true,
        phase: 22,
        timestamp: Date.now(),
        summary: p22Summary
      });
    }

    const testSummary = await Phase21ExternalIntelTestRunner.runAllTests();
    logAudit(req, 'RUN_EXTERNAL_INTEL_TESTS', 'phase21_test_runner', {
      passed: testSummary.passedCount,
      failed: testSummary.failedCount,
      allPassed: testSummary.allPassed
    });
    res.json({
      success: true,
      timestamp: Date.now(),
      summary: testSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/external-intelligence/phase22-tests', async (req: Request, res: Response) => {
  try {
    const testSummary = await Phase22ExternalIntegrationTestRunner.runAllTests();
    logAudit(req, 'RUN_EXTERNAL_INTEL_PHASE22_TESTS', 'phase22_test_runner', {
      passed: testSummary.passedCount,
      failed: testSummary.failedCount,
      allPassed: testSummary.allPassed
    });
    res.json({
      success: true,
      phase: 22,
      timestamp: Date.now(),
      summary: testSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 15. ENTITLEMENT TESTS (PHASE 15)
// ==========================================
adminRouter.get('/entitlement/tests', async (req: Request, res: Response) => {
  try {
    const testSummary = await Phase15EntitlementTestRunner.runAllTests();
    logAudit(req, 'RUN_ENTITLEMENT_TESTS', 'entitlement_test_runner', {
      passed: testSummary.passedCount,
      failed: testSummary.failedCount,
      allPassed: testSummary.allPassed
    });
    res.json({
      success: true,
      timestamp: Date.now(),
      summary: testSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 16. ENGINE TESTS (PHASE 6)
// ==========================================
adminRouter.get('/engine/tests', async (req: Request, res: Response) => {
  try {
    const results = await runPhase6Tests();
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    const allPassed = failedCount === 0;

    logAudit(req, 'RUN_ENGINE_TESTS', 'engine_test_runner', {
      passed: passedCount,
      failed: failedCount,
      allPassed
    });

    res.json({
      success: true,
      timestamp: Date.now(),
      summary: {
        totalCount: results.length,
        passedCount,
        failedCount,
        allPassed,
        results
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 17. FINAL QA FULL-SUITE (PHASE 24, 26, 27, 28 & 29)
// ==========================================
adminRouter.get('/qa/full-suite', async (req: Request, res: Response) => {
  try {
    const [
      engineTests,
      entitlementTests,
      securityTests,
      perfTests,
      intel21Tests,
      intel22Tests,
      sub26Tests,
      soft27Tests,
      opt28Tests,
      qual29Tests,
      trust30Tests
    ] = await Promise.all([
      runPhase6Tests(),
      Phase15EntitlementTestRunner.runAllTests(),
      Phase18SecurityTestRunner.runAllTests(),
      Phase19PerformanceTestRunner.runAllTests(),
      Phase21ExternalIntelTestRunner.runAllTests(),
      Phase22ExternalIntegrationTestRunner.runAllTests(),
      Phase26SubscriptionTestRunner.runAllTests(),
      Phase27SoftLaunchTestRunner.runAllTests(),
      Phase28OptimizationTestRunner.runAllTests(),
      Phase29SignalQualityTestRunner.runAllTests(),
      Phase30TrustLayerTestRunner.runAllTests()
    ]);

    const enginePassed = engineTests.filter(r => r.passed).length;
    const engineFailed = engineTests.filter(r => !r.passed).length;

    const totalTests =
      engineTests.length +
      entitlementTests.totalCount +
      securityTests.totalCount +
      perfTests.totalCount +
      intel21Tests.totalCount +
      intel22Tests.totalCount +
      sub26Tests.totalCount +
      soft27Tests.totalCount +
      opt28Tests.totalCount +
      qual29Tests.totalCount +
      trust30Tests.totalCount;

    const totalPassed =
      enginePassed +
      entitlementTests.passedCount +
      securityTests.passedCount +
      perfTests.passedCount +
      intel21Tests.passedCount +
      intel22Tests.passedCount +
      sub26Tests.passedCount +
      soft27Tests.passedCount +
      opt28Tests.passedCount +
      qual29Tests.passedCount +
      trust30Tests.passedCount;

    const totalFailed =
      engineFailed +
      entitlementTests.failedCount +
      securityTests.failedCount +
      perfTests.failedCount +
      intel21Tests.failedCount +
      intel22Tests.failedCount +
      sub26Tests.failedCount +
      soft27Tests.failedCount +
      opt28Tests.failedCount +
      qual29Tests.failedCount +
      trust30Tests.failedCount;

    const allPassed = totalFailed === 0;

    logAudit(req, 'RUN_FULL_QA_SUITE', 'qa_full_suite', {
      totalTests,
      totalPassed,
      totalFailed,
      allPassed
    });

    res.json({
      success: true,
      timestamp: Date.now(),
      overall: {
        totalTests,
        totalPassed,
        totalFailed,
        allPassed,
        status: allPassed ? 'RELEASE_CANDIDATE_READY' : 'NOT_READY_FAILURES_DETECTED'
      },
      suites: {
        phase6Engine: {
          total: engineTests.length,
          passed: enginePassed,
          failed: engineFailed,
          allPassed: engineFailed === 0,
          results: engineTests
        },
        phase15Entitlement: entitlementTests,
        phase18Security: securityTests,
        phase19Performance: perfTests,
        phase21ExternalIntel: intel21Tests,
        phase22ExternalIntegration: intel22Tests,
        phase26Subscription: sub26Tests,
        phase27SoftLaunch: soft27Tests,
        phase28Optimization: opt28Tests,
        phase29SignalQuality: qual29Tests,
        phase30TrustLayer: trust30Tests
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/subscription/tests', async (req: Request, res: Response) => {
  try {
    const testSummary = await Phase26SubscriptionTestRunner.runAllTests();
    logAudit(req, 'RUN_SUBSCRIPTION_TESTS', 'phase26_test_runner', {
      passed: testSummary.passedCount,
      failed: testSummary.failedCount,
      allPassed: testSummary.allPassed
    });
    res.json({
      success: true,
      phase: 26,
      timestamp: Date.now(),
      summary: testSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 18. DATABASE PRODUCTION BACKUP & RECOVERY (PHASE 25)
// ==========================================
adminRouter.get('/database/backups', (req: Request, res: Response) => {
  try {
    const backups = databaseBackupService.listBackups();
    res.json({
      success: true,
      count: backups.length,
      backups
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/database/backup', (req: Request, res: Response) => {
  try {
    const adminUser = (req as any).adminUser?.email || 'admin';
    const backup = databaseBackupService.createBackup(adminUser);
    res.json({
      success: true,
      backupId: backup.backupId,
      createdAt: backup.createdAt,
      recordCounts: backup.recordCounts,
      checksum: backup.checksum
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/database/restore', (req: Request, res: Response) => {
  try {
    const { backupId } = req.body;
    if (!backupId || typeof backupId !== 'string') {
      return res.status(400).json({ error: 'backupId string is required for restoration.' });
    }
    const adminUser = (req as any).adminUser?.email || 'admin';
    const result = databaseBackupService.restoreBackup(backupId, adminUser);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get('/database/health', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      health: databaseBackupService.getHealth()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 19. SOFT LAUNCH, FEATURE FLAGS & OBSERVABILITY (PHASE 27)
// ==========================================
adminRouter.get('/feature-flags', (req: Request, res: Response) => {
  res.json({
    success: true,
    launchMode: featureFlagService.getLaunchMode(),
    flags: featureFlagService.getAllFeatureFlags()
  });
});

adminRouter.post('/feature-flags', (req: Request, res: Response) => {
  try {
    const { flag, enabled } = req.body;
    const adminUser = (req as any).adminUser?.email || 'admin';
    featureFlagService.setFeatureFlag(flag, Boolean(enabled), adminUser);
    res.json({
      success: true,
      flag,
      enabled: featureFlagService.isFeatureEnabled(flag)
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get('/kill-switches', (req: Request, res: Response) => {
  res.json({
    success: true,
    killSwitches: featureFlagService.getAllKillSwitches()
  });
});

adminRouter.post('/kill-switches', (req: Request, res: Response) => {
  try {
    const { component, active, reason } = req.body;
    const adminUser = (req as any).adminUser?.email || 'admin';
    featureFlagService.setKillSwitch(component, Boolean(active), adminUser, reason);
    res.json({
      success: true,
      component,
      active: featureFlagService.isKillSwitchActive(component)
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get('/incidents', (req: Request, res: Response) => {
  res.json({
    success: true,
    incidents: featureFlagService.getIncidents()
  });
});

adminRouter.post('/incidents', (req: Request, res: Response) => {
  try {
    const { title, severity, affectedComponent } = req.body;
    const adminUser = (req as any).adminUser?.email || 'admin';
    const incident = featureFlagService.recordIncident({
      title,
      severity,
      affectedComponent,
      actor: adminUser
    });
    res.json({
      success: true,
      incident
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post('/incidents/:id/resolve', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolutionSummary } = req.body;
    const adminUser = (req as any).adminUser?.email || 'admin';
    const resolved = featureFlagService.resolveIncident(id, resolutionSummary || 'Resolved by admin', adminUser);
    if (!resolved) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json({
      success: true,
      incident: resolved
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get('/analytics/funnel', (req: Request, res: Response) => {
  res.json({
    success: true,
    funnel: analyticsService.getFunnelMetrics()
  });
});

adminRouter.get('/analytics/retention', (req: Request, res: Response) => {
  res.json({
    success: true,
    retention: analyticsService.getRetentionMetrics()
  });
});

adminRouter.get('/analytics/costs', (req: Request, res: Response) => {
  res.json({
    success: true,
    costs: featureFlagService.getCostMonitoringSummary()
  });
});

adminRouter.get('/data-integrity', (req: Request, res: Response) => {
  res.json({
    success: true,
    integrity: analyticsService.checkDataIntegrity()
  });
});

adminRouter.get('/support/user/:idOrEmail', (req: Request, res: Response) => {
  const { idOrEmail } = req.params;
  const userView = analyticsService.getSupportUserView(idOrEmail);
  if (!userView) {
    return res.status(404).json({ error: 'User not found in support repository.' });
  }
  res.json({
    success: true,
    user: userView
  });
});

adminRouter.get('/launch-config', (req: Request, res: Response) => {
  res.json({
    success: true,
    launchMode: featureFlagService.getLaunchMode(),
    limits: featureFlagService.getSoftLaunchLimits(),
    flags: featureFlagService.getAllFeatureFlags(),
    killSwitches: featureFlagService.getAllKillSwitches()
  });
});

adminRouter.post('/launch-config', (req: Request, res: Response) => {
  try {
    const { launchMode, limits } = req.body;
    const adminUser = (req as any).adminUser?.email || 'admin';
    if (launchMode) {
      featureFlagService.setLaunchMode(launchMode, adminUser);
    }
    if (limits) {
      featureFlagService.updateSoftLaunchLimits(limits, adminUser);
    }
    res.json({
      success: true,
      launchMode: featureFlagService.getLaunchMode(),
      limits: featureFlagService.getSoftLaunchLimits()
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get('/soft-launch/tests', async (req: Request, res: Response) => {
  try {
    const testSummary = await Phase27SoftLaunchTestRunner.runAllTests();
    logAudit(req, 'RUN_SOFT_LAUNCH_TESTS', 'phase27_test_runner', {
      passed: testSummary.passedCount,
      failed: testSummary.failedCount,
      allPassed: testSummary.allPassed
    });
    res.json({
      success: true,
      phase: 27,
      timestamp: Date.now(),
      summary: testSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 20. REAL USER FEEDBACK & PRODUCT OPTIMIZATION (PHASE 28)
// ==========================================

adminRouter.get('/feedback', (req: Request, res: Response) => {
  res.json({
    success: true,
    feedbacks: analyticsService.getFeedbacks()
  });
});

adminRouter.post('/feedback/:id/resolve', (req: Request, res: Response) => {
  const { id } = req.params;
  const resolved = analyticsService.resolveFeedback(id);
  if (!resolved) {
    return res.status(404).json({ error: 'Feedback item not found' });
  }
  logAudit(req, 'RESOLVE_FEEDBACK', id);
  res.json({
    success: true,
    feedback: resolved
  });
});

adminRouter.get('/analytics/journey-funnel', (req: Request, res: Response) => {
  res.json({
    success: true,
    steps: analyticsService.getUserJourneyFunnel()
  });
});

adminRouter.get('/analytics/feature-usage', (req: Request, res: Response) => {
  res.json({
    success: true,
    summary: analyticsService.getFeatureUsageSummary()
  });
});

adminRouter.get('/analytics/user-segments', (req: Request, res: Response) => {
  res.json({
    success: true,
    segments: analyticsService.getUserSegments()
  });
});

adminRouter.get('/analytics/activation', (req: Request, res: Response) => {
  res.json({
    success: true,
    activation: analyticsService.getActivationMetrics()
  });
});

adminRouter.post('/analytics/activation', (req: Request, res: Response) => {
  const { definitionName, thresholdCalls } = req.body;
  if (!definitionName) {
    return res.status(400).json({ error: 'definitionName is required' });
  }
  analyticsService.setActivationConfig(definitionName, thresholdCalls || 1);
  logAudit(req, 'UPDATE_ACTIVATION_CONFIG', 'ACTIVATION', { definitionName, thresholdCalls });
  res.json({
    success: true,
    activation: analyticsService.getActivationMetrics()
  });
});

adminRouter.get('/analytics/segmented-retention', (req: Request, res: Response) => {
  res.json({
    success: true,
    cohorts: analyticsService.getSegmentedRetention()
  });
});

adminRouter.get('/analytics/trial-correlations', (req: Request, res: Response) => {
  res.json({
    success: true,
    correlations: analyticsService.getTrialCorrelations()
  });
});

adminRouter.get('/analytics/pro-value', (req: Request, res: Response) => {
  res.json({
    success: true,
    capabilities: analyticsService.getProValueAnalysis()
  });
});

adminRouter.get('/analytics/real-user-perf', (req: Request, res: Response) => {
  res.json({
    success: true,
    perf: analyticsService.getRealUserPerformance()
  });
});

adminRouter.get('/analytics/error-impact', (req: Request, res: Response) => {
  res.json({
    success: true,
    errors: analyticsService.getErrorImpactRankings()
  });
});

adminRouter.get('/phase28/tests', async (req: Request, res: Response) => {
  try {
    const testSummary = await Phase28OptimizationTestRunner.runAllTests();
    logAudit(req, 'RUN_PHASE28_TESTS', 'phase28_test_runner', {
      passed: testSummary.passedCount,
      failed: testSummary.failedCount,
      allPassed: testSummary.allPassed
    });
    res.json({
      success: true,
      phase: 28,
      timestamp: Date.now(),
      summary: testSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 21. SIGNAL QUALITY, CALIBRATION & INTELLIGENCE VALIDATION (PHASE 29)
// ==========================================

adminRouter.get('/signal-quality/inventory', (req: Request, res: Response) => {
  res.json({
    success: true,
    inventory: signalQualityService.getSignalInventory()
  });
});

adminRouter.get('/signal-quality/calibration', (req: Request, res: Response) => {
  res.json({
    success: true,
    buckets: signalQualityService.getSignalCalibrationBuckets()
  });
});

adminRouter.get('/signal-quality/risk-calibration', (req: Request, res: Response) => {
  res.json({
    success: true,
    riskBuckets: signalQualityService.getRiskCalibrationBuckets()
  });
});

adminRouter.get('/signal-quality/mtf-calibration', (req: Request, res: Response) => {
  res.json({
    success: true,
    confluence: signalQualityService.getMtfConfluenceCalibration()
  });
});

adminRouter.get('/signal-quality/components', (req: Request, res: Response) => {
  res.json({
    success: true,
    components: signalQualityService.getComponentContributions()
  });
});

adminRouter.get('/signal-quality/whale-validation', (req: Request, res: Response) => {
  res.json({
    success: true,
    whaleValidation: signalQualityService.getWhaleSignalValidation()
  });
});

adminRouter.get('/signal-quality/dex-validation', (req: Request, res: Response) => {
  res.json({
    success: true,
    dexValidation: signalQualityService.getDexSignalValidation()
  });
});

adminRouter.get('/signal-quality/derivatives-validation', (req: Request, res: Response) => {
  res.json({
    success: true,
    derivativesValidation: signalQualityService.getDerivativesValidation()
  });
});

adminRouter.get('/signal-quality/regime-validation', (req: Request, res: Response) => {
  res.json({
    success: true,
    regimes: signalQualityService.getRegimeValidation()
  });
});

adminRouter.get('/signal-quality/btc-context', (req: Request, res: Response) => {
  res.json({
    success: true,
    btcContext: signalQualityService.getBtcContextValidation()
  });
});

adminRouter.get('/signal-quality/exchange-comparison', (req: Request, res: Response) => {
  res.json({
    success: true,
    exchanges: signalQualityService.getExchangeComparison()
  });
});

adminRouter.get('/signal-quality/versions', (req: Request, res: Response) => {
  res.json({
    success: true,
    versions: signalQualityService.getModelVersions()
  });
});

adminRouter.get('/signal-quality/promotion-gate', (req: Request, res: Response) => {
  res.json({
    success: true,
    promotionGate: signalQualityService.evaluatePromotionGate()
  });
});

adminRouter.get('/signal-quality/drift', (req: Request, res: Response) => {
  res.json({
    success: true,
    drift: signalQualityService.detectModelDrift()
  });
});

adminRouter.get('/signal-quality/dashboard-summary', (req: Request, res: Response) => {
  res.json({
    success: true,
    summary: signalQualityService.getSignalQualityDashboardSummary()
  });
});

adminRouter.get('/phase29/tests', async (req: Request, res: Response) => {
  try {
    const testSummary = await Phase29SignalQualityTestRunner.runAllTests();
    logAudit(req, 'RUN_PHASE29_TESTS', 'phase29_test_runner', {
      passed: testSummary.passedCount,
      failed: testSummary.failedCount,
      allPassed: testSummary.allPassed
    });
    res.json({
      success: true,
      phase: 29,
      timestamp: Date.now(),
      summary: testSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PHASE 30: INTELLIGENCE TRUST & EXPLAINABILITY ROUTES
// ==========================================

adminRouter.get('/intelligence/trust', (req: Request, res: Response) => {
  try {
    const metrics = signalExplanationEngine.getTrustMetrics();
    res.json({
      success: true,
      metrics,
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/intelligence/feedback', (req: Request, res: Response) => {
  try {
    const records = signalExplanationEngine.getFeedbackRecords(100);
    res.json({
      success: true,
      records,
      count: records.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/phase30/tests', async (req: Request, res: Response) => {
  try {
    const testSummary = await Phase30TrustLayerTestRunner.runAllTests();
    logAudit(req, 'RUN_PHASE30_TESTS', 'phase30_test_runner', {
      passed: testSummary.passedCount,
      failed: testSummary.failedCount,
      allPassed: testSummary.allPassed
    });
    res.json({
      success: true,
      phase: 30,
      timestamp: Date.now(),
      summary: testSummary
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});



