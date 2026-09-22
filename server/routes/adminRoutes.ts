import express, { Request, Response } from 'express';
import { db } from '../db/schema';
import { scoringEngine } from '../engine/scoringEngine';
import { monitoringService } from '../services/monitoringService';
import { marketDataService } from '../services/marketDataService';
import { historicalReplayEngine } from '../engine/historicalReplayEngine';
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
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;

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
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
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

