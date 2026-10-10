import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { binanceAdapter } from './server/adapters/binanceAdapter';
import { bybitAdapter } from './server/adapters/bybitAdapter';
import { okxAdapter } from './server/adapters/okxAdapter';
import { pionexAdapter } from './server/adapters/pionexAdapter';
import { onChainProviderManager } from './server/adapters/onChainProvider';
import { db } from './server/db/schema';
import { aiToolLayer } from './server/engine/aiTools';
import { marketQueryParser } from './server/engine/marketQueryParser';
import { scoringEngine } from './server/engine/scoringEngine';
import { aiTraderService } from './server/services/aiTraderService';
import { assetRegistryService } from './server/services/assetRegistryService';
import { marketDataService } from './server/services/marketDataService';
import { monitoringService } from './server/services/monitoringService';
import {
  adminRateLimit,
  aiRateLimit,
  alertRateLimit,
  authRateLimit,
  coinDetailRateLimit,
  communityRateLimit,
  notifRateLimit,
  scannerRateLimit
} from './server/services/rateLimiter';
import { telegramService } from './server/services/telegramService';
import { notificationEngine } from './server/services/notificationEngine';
import { realtimeStreamManager } from './server/services/realtimeStreamManager';
import { exchangeCapabilityRegistry } from './server/services/capabilityRegistry';
import { marketDataCache } from './server/services/marketDataCache';
import { pipelineLogger } from './server/services/pipelineLogger';
import { runPhase6Tests } from './server/tests/phase6EngineTests';
import { signalEngine } from './server/engine/signalEngine';
import { SignalEngineTestRunner } from './server/engine/signalEngineTests';
import { whaleProviderManager } from './server/adapters/whaleProvider';
import { orderFlowEngine } from './server/engine/orderFlowEngine';
import { liquidationEngine } from './server/engine/liquidationEngine';
import { Phase8EngineTestRunner } from './server/engine/phase8EngineTests';
import { Phase9EngineTestRunner } from './server/engine/phase9EngineTests';
import { Phase9bEngineTestRunner } from './server/engine/phase9bEngineTests';
import { Phase15EntitlementTestRunner } from './server/tests/phase15EntitlementTests';
import { externalIntelligenceNormalizer } from './server/engine/externalIntelligenceNormalizer';
import { externalIntelligenceRegistry } from './server/providers/externalIntelligenceProvider';
import { evidenceStore } from './server/engine/evidenceStore';
import { adminRouter } from './server/routes/adminRoutes';
import { communityRouter } from './server/routes/communityRoutes';
import { adRouter } from './server/routes/adRoutes';
import { advertisingRouter } from './server/routes/advertisingRoutes';
import { accountRouter, extractDeviceInfo } from './server/routes/accountRoutes';
import { subscriptionRouter } from './server/routes/subscriptionRoutes';
import { notificationRouter } from './server/routes/notificationRoutes';
import { rewardedAdService } from './server/services/rewardedAdService';
import { aiQuotaService } from './server/services/aiQuotaService';
import { exchangeRegistry } from './server/services/exchangeRegistry';
import { entitlementService, isFreeAllowedSymbol } from './server/services/entitlementService';
import { databaseBackupService } from './server/services/backupService';
import { featureFlagService } from './server/services/featureFlagService';
import { analyticsService } from './server/services/analyticsService';
import { signalExplanationEngine } from './server/services/signalExplanationEngine';
import crypto from 'crypto';
import { ExchangeId, Timeframe, WhaleTxDirection, WhaleTxType, User } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Production-Ready Strict CORS Middleware (Phase 25)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedAppUrl = process.env.APP_URL;

    if (origin) {
      const isAllowed =
        process.env.NODE_ENV !== 'production' ||
        !allowedAppUrl ||
        origin === allowedAppUrl ||
        origin.endsWith('.run.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1');

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Correlation-ID');
      }
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Security Hardening Headers (Phase 25)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Request Correlation ID & Structured Logging (Phase 25)
  app.use((req, res, next) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || `req_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path.startsWith('/api') && !req.path.startsWith('/api/health') && !req.path.startsWith('/api/kesehatan')) {
        // Redact authorization header, passwords, tokens
        if (process.env.DEBUG === 'true') {
          console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms) [CID: ${correlationId}]`);
        }
      }
    });
    next();
  });

  // Maintenance Mode Safeguard (Phase 27)
  app.use((req, res, next) => {
    if (featureFlagService.isMaintenanceModeActive()) {
      // Allow admin routes, auth login, and health checks
      if (
        req.path.startsWith('/api/admin') ||
        req.path.startsWith('/api/auth/login') ||
        req.path.startsWith('/api/health') ||
        req.path.startsWith('/api/kesehatan')
      ) {
        return next();
      }
      return res.status(503).json({
        error: 'System maintenance in progress. We will be back shortly.',
        maintenance: true
      });
    }
    next();
  });

  // ==========================================
  // PHASE 25: PRODUCTION HEALTH & READINESS ENDPOINTS
  // ==========================================
  const getSystemHealthReport = () => {
    const uptimeSec = Math.floor(process.uptime());
    const memory = process.memoryUsage();
    const externalHealth = externalIntelligenceRegistry.getHealthSummary();
    const cacheStats = marketDataCache.getStats();
    const backupHealth = databaseBackupService.getHealth();

    const components = {
      APPLICATION: {
        status: 'HEALTHY' as const,
        version: '1.0.0',
        uptimeSeconds: uptimeSec,
        memoryUsageMb: Math.round(memory.heapUsed / 1024 / 1024),
        nodeEnv: process.env.NODE_ENV || 'production'
      },
      DATABASE: {
        status: 'HEALTHY' as const,
        usersCount: db.users.size,
        activeSessions: db.sessions.size,
        watchlistsCount: db.watchlists.size,
        alertsCount: Array.from(db.alerts.values()).reduce((acc, a) => acc + a.length, 0),
        backupsAvailable: backupHealth.totalBackups,
        lastBackupAt: backupHealth.latestBackup?.createdAt || null
      },
      EXTERNAL_PROVIDERS: {
        status: externalHealth.activeCount > 0 ? ('HEALTHY' as const) : ('DEGRADED' as const),
        totalProviders: externalHealth.totalProviders,
        activeCount: externalHealth.activeCount,
        overallStatus: externalHealth.overallStatus
      },
      NOTIFICATION: {
        status: 'HEALTHY' as const,
        registeredPushSubscriptions: Array.from(db.webPushSubscriptions.values()).reduce((acc, list) => acc + list.length, 0),
        notificationHistoryCount: Array.from(db.notifications.values()).reduce((acc, list) => acc + list.length, 0)
      },
      CACHE: {
        status: 'HEALTHY' as const,
        hitRatioPct: cacheStats.hitRatio,
        cachedEntries: cacheStats.size,
        evictions: cacheStats.totalEvictions
      }
    };

    const overallStatus =
      components.APPLICATION.status === 'HEALTHY' && components.DATABASE.status === 'HEALTHY'
        ? (components.EXTERNAL_PROVIDERS.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED')
        : 'UNAVAILABLE';

    return {
      status: overallStatus,
      timestamp: Date.now(),
      isoTimestamp: new Date().toISOString(),
      components
    };
  };

  app.get(['/api/health', '/api/kesehatan'], (req, res) => {
    const report = getSystemHealthReport();
    res.json(report);
  });

  app.get('/api/health/live', (req, res) => {
    res.json({ status: 'HEALTHY', timestamp: Date.now() });
  });

  app.get('/api/health/ready', (req, res) => {
    const report = getSystemHealthReport();
    if (report.status === 'UNAVAILABLE') {
      return res.status(503).json(report);
    }
    res.json(report);
  });

  // Helper to extract session user from Bearer token
  const getAuthUser = (req: express.Request): User | null => {
    let user: User | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim();
      const session = db.getSession(token);
      if (session) {
        user = db.users.get(session.userId) || null;
      }
    }
    if (!user) {
      // Fallback to default demo user for seamless terminal browsing
      user = db.findUserByEmail('demo@cryptointelligence.ai') || null;
    }
    if (user) {
      // Authoritatively sync/check trial status and pro entitlement
      const ent = entitlementService.checkEntitlement(user);
      user.tier = ent.tier;
      user.isPro = ent.isPro;
      user.trialStatus = ent.trialStatus;
    }
    return user;
  };

  // Strict helper: returns User ONLY if valid active session token is supplied (no demo fallback)
  const getStrictAuthUser = (req: express.Request): User | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.replace('Bearer ', '').trim();
    const session = db.getSession(token);
    if (!session) return null;
    const user = db.users.get(session.userId) || null;
    if (user) {
      const ent = entitlementService.checkEntitlement(user);
      user.tier = ent.tier;
      user.isPro = ent.isPro;
      user.trialStatus = ent.trialStatus;
    }
    return user;
  };

  // RBAC Middleware for Admin endpoints
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const session = db.getSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
    const user = db.users.get(session.userId);
    if (!user || user.role.toLowerCase() !== 'admin') {
      db.addSystemLog(
        'WARNING',
        'AUTH',
        `Forbidden admin access attempt by user '${user ? user.email : session.userId}'`,
        req.originalUrl
      );
      return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
    }
    (req as any).adminUser = user;
    next();
  };

  // Health endpoint
  app.get('/api/health', async (req, res) => {
    const [binanceStats, bybitStats] = await Promise.all([
      binanceAdapter.getMarketStats(),
      bybitAdapter.getMarketStats()
    ]);

    res.json({
      status: 'ok',
      timestamp: Date.now(),
      app: 'Crypto Intelligence AI (Phase 2)',
      exchanges: [
        {
          id: 'BINANCE',
          name: 'Binance (Spot & Futures)',
          isHealthy: binanceStats.isHealthy,
          latencyMs: binanceStats.latencyMs,
          status: binanceStats.status
        },
        {
          id: 'BYBIT',
          name: 'Bybit (Linear Perpetual)',
          isHealthy: bybitStats.isHealthy,
          latencyMs: bybitStats.latencyMs,
          status: bybitStats.status
        },
        {
          id: 'OKX',
          name: 'OKX (Derivatives)',
          isHealthy: false,
          latencyMs: 0,
          status: 'Planned for Phase 3'
        }
      ]
    });
  });

  // ==========================================
  // AUTHENTICATION ROUTES
  // ==========================================
  app.post('/api/auth/register', authRateLimit, (req, res) => {
    if (!featureFlagService.isRegistrationEnabled()) {
      return res.status(503).json({
        error: 'New user registration is temporarily paused during soft launch. Please check back soon.',
        registrationPaused: true
      });
    }

    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = db.createUser(email, password, name || email.split('@')[0]);
    const deviceInfo = extractDeviceInfo(req);
    const session = db.createSession(user.id, deviceInfo);
    res.json({ user, token: session.token });
  });

  app.post('/api/auth/login', authRateLimit, (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const lockStatus = db.isAccountLocked(email);
    if (lockStatus.isLocked) {
      return res.status(429).json({
        error: `Account temporarily locked due to too many failed attempts. Try again in ${lockStatus.remainingSec}s.`
      });
    }

    const user = db.findUserByEmail(email);
    const storedPass = user ? db.userPasswords.get(user.email.toLowerCase()) : null;

    if (!user || storedPass !== password) {
      const failResult = db.recordFailedLogin(email);
      if (failResult.locked) {
        return res.status(429).json({
          error: 'Too many failed login attempts. Account temporarily locked for 15 minutes.'
        });
      }
      return res.status(401).json({
        error: `Invalid email or password. (${failResult.remainingAttempts} attempts remaining)`
      });
    }

    db.clearFailedLogin(email);
    const deviceInfo = extractDeviceInfo(req);
    const session = db.createSession(user.id, deviceInfo);
    res.json({ user, token: session.token });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim();
      db.deleteSession(token);
    }
    res.json({ success: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getStrictAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const trial = entitlementService.getTrialDetails(user);
    res.json({
      user: {
        ...user,
        plan: trial.plan,
        trialStatus: trial.trialStatus,
        trialStartedAt: trial.trialStartedAt,
        trialEndsAt: trial.trialEndsAt,
        isTrialActive: trial.isTrialActive,
        remainingTrialDays: trial.remainingDays,
        remainingTrialHours: trial.remainingHours,
        serverTime: trial.serverTime
      }
    });
  });

  // ==========================================
  // MULTI-EXCHANGE & DATA QUALITY ROUTES
  // Authoritative Exchange & Provider Registry (Phase 11)
  // ==========================================
  app.get('/api/exchanges', async (req, res) => {
    try {
      const exchanges = await exchangeRegistry.getAuthoritativeExchanges();
      res.json(exchanges);
    } catch (err) {
      console.error('Error fetching authoritative exchanges:', err);
      res.status(500).json({ error: 'Failed to retrieve authoritative exchange registry' });
    }
  });

  // ==========================================
  // GLOBAL ASSET REGISTRY & DISCOVERY ROUTES
  // ==========================================
  app.get('/api/registry/universe', async (req, res) => {
    try {
      const stats = assetRegistryService.getUniverseStats();
      const assets = assetRegistryService.getAllAssets();
      const markets = assetRegistryService.getAllExchangeMarkets();
      res.json({
        totalAssets: assets.length,
        totalMarkets: markets.length,
        supportedExchanges: assetRegistryService.getSupportedExchanges(),
        exchangeStats: stats,
        timestamp: Date.now()
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/registry/asset/:baseAsset', async (req, res) => {
    try {
      const base = req.params.baseAsset.toUpperCase();
      const asset = assetRegistryService.getAsset(base);
      const markets = assetRegistryService.getMarketsForAsset(base);
      const allCoins = await marketDataService.scanMarket('ALL');
      const aggregatedView = assetRegistryService.getAggregatedAssetView(base, allCoins);

      res.json({
        asset: asset || {
          id: base,
          baseAsset: base,
          displayName: `${base} Asset`,
          status: 'ACTIVE',
          isVerifiedIdentity: false
        },
        markets,
        aggregatedView
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/registry/new-listings', (req, res) => {
    const events = assetRegistryService.getNewListingEvents();
    res.json(events);
  });

  app.post('/api/registry/discover', async (req, res) => {
    try {
      const result = await assetRegistryService.runDiscovery(true);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ==========================================
  // MARKET SCANNER & OVERVIEW ROUTES
  // ==========================================
  app.get('/api/market/overview', scannerRateLimit, async (req, res) => {
    try {
      const exchange = ((req.query.exchange as string)?.toUpperCase() || 'BINANCE') as ExchangeId;
      const overview = await marketDataService.getMarketOverview(exchange);
      res.json(overview);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/market/sentiment', scannerRateLimit, async (req, res) => {
    try {
      const exchange = ((req.query.exchange as string)?.toUpperCase() || 'BINANCE') as ExchangeId;
      const overview = await marketDataService.getMarketOverview(exchange);
      res.json(overview.sentiment);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/market/scanner', scannerRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req);
      const isUserPro = entitlementService.isPro(user);
      const exchange = ((req.query.exchange as string)?.toUpperCase() || 'BINANCE') as ExchangeId;
      let coins = await marketDataService.scanMarket(exchange);

      const {
        search,
        bullMin,
        riskMin,
        volRatioMin,
        rsiMin,
        rsiMax,
        aboveMa20,
        aboveMa50,
        aboveMa200,
        structureState,
        structureEvent,
        oiChangeMin,
        fundingTrend,
        sortBy = 'bullScore',
        sortOrder = 'desc'
      } = req.query;

      if (search && typeof search === 'string') {
        const q = search.toUpperCase();
        coins = coins.filter(c => c.symbol.includes(q) || c.baseAsset.includes(q));
      }

      if (bullMin) {
        const val = parseFloat(bullMin as string);
        if (!isNaN(val)) {
          // Free users only query bullScore for BTC/ETH to prevent leaking premium scores
          coins = coins.filter(c => (isUserPro || isFreeAllowedSymbol(c.symbol)) ? c.scores.bullScore >= val : false);
        }
      }

      if (riskMin) {
        const val = parseFloat(riskMin as string);
        if (!isNaN(val)) {
          coins = coins.filter(c => (isUserPro || isFreeAllowedSymbol(c.symbol)) ? c.scores.downsideRiskScore >= val : false);
        }
      }

      if (volRatioMin) {
        const val = parseFloat(volRatioMin as string);
        if (!isNaN(val)) coins = coins.filter(c => c.indicators.volumeAnalysis.ratio >= val);
      }

      if (rsiMin) {
        const val = parseFloat(rsiMin as string);
        if (!isNaN(val)) coins = coins.filter(c => c.indicators.rsi14 >= val);
      }

      if (rsiMax) {
        const val = parseFloat(rsiMax as string);
        if (!isNaN(val)) coins = coins.filter(c => c.indicators.rsi14 <= val);
      }

      if (aboveMa20 === 'true') {
        coins = coins.filter(c => c.indicators.priceVsMa20 === 'above');
      }

      if (aboveMa50 === 'true') {
        coins = coins.filter(c => c.indicators.priceVsMa50 === 'above');
      }

      if (aboveMa200 === 'true') {
        coins = coins.filter(c => c.indicators.priceVsMa200 === 'above');
      }

      if (structureState && typeof structureState === 'string') {
        coins = coins.filter(c => c.marketStructure.state === structureState);
      }

      if (structureEvent && typeof structureEvent === 'string') {
        coins = coins.filter(c => c.marketStructure.event === structureEvent);
      }

      if (oiChangeMin) {
        const val = parseFloat(oiChangeMin as string);
        if (!isNaN(val)) {
          coins = coins.filter(c => (c.derivatives?.openInterestChange24h ?? -999) >= val);
        }
      }

      if (fundingTrend && typeof fundingTrend === 'string') {
        coins = coins.filter(c => c.derivatives?.fundingTrend === fundingTrend);
      }

      // SECTION 13: RANKING PROTECTION
      // Free users must NOT receive the complete premium ranking through API responses.
      // If sorting by bullScore, downsideRisk, oiChange, or fundingRate,
      // Free non-BTC/ETH coins are sorted by volume24h to avoid leaking confidential model ranks!
      const order = sortOrder === 'asc' ? 1 : -1;
      const isProtectedSort = ['bullScore', 'downsideRisk', 'oiChange', 'fundingRate'].includes(sortBy as string);

      if (!isUserPro && isProtectedSort) {
        coins.sort((a, b) => {
          const aIsFree = isFreeAllowedSymbol(a.symbol);
          const bIsFree = isFreeAllowedSymbol(b.symbol);
          if (aIsFree && !bIsFree) return -1;
          if (!aIsFree && bIsFree) return 1;
          if (aIsFree && bIsFree) {
            return (a.scores.bullScore - b.scores.bullScore) * order;
          }
          // Non-BTC/ETH coins sorted by volume for Free users (ranking protected)
          return (b.volume24h - a.volume24h);
        });
      } else {
        coins.sort((a, b) => {
          if (sortBy === 'bullScore') return (a.scores.bullScore - b.scores.bullScore) * order;
          if (sortBy === 'downsideRisk') return (a.scores.downsideRiskScore - b.scores.downsideRiskScore) * order;
          if (sortBy === 'volumeRatio') return (a.indicators.volumeAnalysis.ratio - b.indicators.volumeAnalysis.ratio) * order;
          if (sortBy === 'rsi14') return (a.indicators.rsi14 - b.indicators.rsi14) * order;
          if (sortBy === 'change24h') return (a.change24h - b.change24h) * order;
          if (sortBy === 'price') return (a.price - b.price) * order;
          if (sortBy === 'openInterest') {
            const aOi = a.derivatives?.openInterestUsd ?? 0;
            const bOi = b.derivatives?.openInterestUsd ?? 0;
            return (aOi - bOi) * order;
          }
          if (sortBy === 'oiChange') {
            const aChg = a.derivatives?.openInterestChange24h ?? 0;
            const bChg = b.derivatives?.openInterestChange24h ?? 0;
            return (aChg - bChg) * order;
          }
          if (sortBy === 'fundingRate') {
            const aF = a.derivatives?.fundingRate ?? 0;
            const bF = b.derivatives?.fundingRate ?? 0;
            return (aF - bF) * order;
          }
          return (a.scores.bullScore - b.scores.bullScore) * order;
        });
      }

      // SECTION 8, 10, 11: Free users retain useful signals for BTC and ETH.
      // For other coins: premium fields (bullScore, signal, MTF, whale, order flow) are locked on the server!
      const sanitizedCoins = coins.map(c => entitlementService.sanitizeCoinDataForUser(c, user));
      res.json(sanitizedCoins);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Coin detail page with timeframe and exchange selection
  app.get('/api/market/coin/:symbol', coinDetailRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req);
      const symbol = req.params.symbol;
      const timeframe = ((req.query.timeframe as string) || '1h') as Timeframe;
      let exchange = ((req.query.exchange as string)?.toUpperCase() || 'BINANCE') as ExchangeId;
      let detail = await marketDataService.getCoinDetail(symbol, timeframe, exchange);

      // If not on requested exchange, check asset registry across all discovered exchanges
      if (!detail.coin) {
        const base = symbol.replace(/[\/\-_]/g, '').replace('USDT', '').toUpperCase();
        const markets = assetRegistryService.getMarketsForAsset(base);
        if (markets.length > 0) {
          exchange = markets[0].exchange;
          detail = await marketDataService.getCoinDetail(symbol, timeframe, exchange);
        }
      }

      if (!detail.coin) {
        return res.status(404).json({ error: 'Coin data unavailable' });
      }

      // SECTION 8, 11, 14: Sanitize coin detail based on user entitlement
      detail.coin = entitlementService.sanitizeCoinDataForUser(detail.coin, user);
      if (detail.coin.isLocked) {
        // Redact premium intelligence for non-BTC/ETH coins on Free tier
        (detail.coin as any).orderFlow = null;
        (detail.coin as any).liquidationIntel = null;
        (detail.coin as any).whaleTransfers = [];
        if (detail.coin.signal) {
          detail.coin.signal = entitlementService.sanitizeSignalForUser(detail.coin.signal, user);
        }
      }

      res.json(detail);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ==========================================
  // PHASE 30: SIGNAL EXPLANATION & TRUST LAYER
  // ==========================================
  app.get('/api/market/signal-explanation/:symbol', coinDetailRateLimit, async (req, res) => {
    try {
      const user = getAuthUser(req);
      const symbol = req.params.symbol;
      const timeframe = ((req.query.timeframe as string) || '1h') as Timeframe;
      let exchange = ((req.query.exchange as string)?.toUpperCase() || 'BINANCE') as ExchangeId;

      let detail = await marketDataService.getCoinDetail(symbol, timeframe, exchange);
      if (!detail.coin) {
        const base = symbol.replace(/[\/\-_]/g, '').replace('USDT', '').toUpperCase();
        const markets = assetRegistryService.getMarketsForAsset(base);
        if (markets.length > 0) {
          exchange = markets[0].exchange;
          detail = await marketDataService.getCoinDetail(symbol, timeframe, exchange);
        }
      }

      if (!detail.coin) {
        return res.status(404).json({ error: 'Coin data unavailable for explanation' });
      }

      // Check user entitlement
      const isFree = !user || (!user.isPro && user.tier !== 'PRO' && user.role !== 'admin');
      const isAllowed = isFreeAllowedSymbol(symbol);

      if (isFree && !isAllowed) {
        // Redacted preview for Free tier on premium altcoins
        return res.status(403).json({
          error: 'PRO_REQUIRED',
          message: 'Detailed signal explainability and evidence layer for altcoins requires PRO entitlement.',
          symbol,
          allowedBenchmarks: ['BTC/USDT', 'ETH/USDT']
        });
      }

      const explanation = signalExplanationEngine.generateExplanation(detail.coin, timeframe);
      res.json({
        success: true,
        explanation
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Submit explanation feedback (Helpful / Not Helpful)
  app.post('/api/market/explanation-feedback', async (req, res) => {
    try {
      const user = getAuthUser(req);
      const { signalId, symbol, isHelpful, reason, comment } = req.body;
      if (!signalId || !symbol || typeof isHelpful !== 'boolean') {
        return res.status(400).json({ error: 'Missing required feedback fields' });
      }

      const record = signalExplanationEngine.recordFeedback({
        signalId,
        symbol,
        userId: user?.id || null,
        userTier: user?.tier || 'FREE',
        isHelpful,
        reason,
        comment
      });

      res.json({
        success: true,
        feedbackId: record.id
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // MARKET DATA ENGINE & PIPELINE (Phase 6)
  // ==========================================
  app.get('/api/market/pipeline/metrics', (req, res) => {
    res.json(marketDataService.getPipelineMetrics());
  });

  app.get('/api/market/pipeline/capabilities', (req, res) => {
    res.json(exchangeCapabilityRegistry.getAllCapabilities());
  });

  app.post('/api/market/pipeline/simulate-ws-disconnect', (req, res) => {
    const exchange = ((req.body.exchange as string) || 'BINANCE').toUpperCase() as ExchangeId;
    realtimeStreamManager.simulateWebSocketDisconnect(exchange);
    res.json({
      message: `Simulated WebSocket disconnect for ${exchange}`,
      status: 'DEGRADED',
      restFallback: true
    });
  });

  app.post('/api/market/pipeline/restore-ws', (req, res) => {
    const exchange = ((req.body.exchange as string) || 'BINANCE').toUpperCase() as ExchangeId;
    realtimeStreamManager.restoreWebSocket(exchange);
    res.json({
      message: `Restored WebSocket connection for ${exchange}`,
      status: 'CONNECTED'
    });
  });

  app.get('/api/admin/phase6/test-suite', async (req, res) => {
    try {
      const results = await runPhase6Tests();
      res.json({
        success: results.every(r => r.passed),
        totalTests: results.length,
        passedTests: results.filter(r => r.passed).length,
        results
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // PHASE 7: SIGNAL INTELLIGENCE ENGINE ROUTES
  // ==========================================
  app.get('/api/signals', (req, res) => {
    const user = getAuthUser(req);
    const { symbol, exchange, timeframe, signalType, direction, status, minStrength, limit } = req.query;
    const signals = db.getHistoricalSignals({
      symbol: symbol as string,
      exchange: exchange as string,
      timeframe: timeframe as string,
      signalType: signalType as string,
      direction: direction as string,
      status: status as string,
      minStrength: minStrength ? parseFloat(minStrength as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 100
    });
    const sanitizedSignals = signals.map(sig => entitlementService.sanitizeSignalForUser(sig, user));
    res.json({
      count: sanitizedSignals.length,
      signals: sanitizedSignals
    });
  });

  app.get('/api/signals/stats', (req, res) => {
    const stats = db.getSignalQualityStats();
    res.json(stats);
  });

  app.get('/api/signals/config', (req, res) => {
    res.json({
      config: db.signalConfig,
      history: db.signalConfigHistory
    });
  });

  app.post('/api/signals/config', requireAdmin, (req, res) => {
    const adminUser = (req as any).adminUser?.email || 'admin';
    const result = db.updateSignalConfig(req.body, adminUser);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    db.addAdminAuditLog(adminUser, 'UPDATE_SIGNAL_ENGINE_CONFIG', 'signalEngine', {
      version: result.config.version
    });
    res.json(result);
  });

  app.post('/api/signals/evaluate', async (req, res) => {
    try {
      const { symbol, exchange = 'BINANCE', timeframe = '1h' } = req.body;
      if (!symbol) return res.status(400).json({ error: 'symbol is required' });
      const detail = await marketDataService.getCoinDetail(symbol, timeframe, exchange);
      if (!detail.coin) return res.status(404).json({ error: 'Asset not found on exchange' });
      const sig = signalEngine.evaluateSignal(detail.coin, { [timeframe]: detail.candles }, null, true);
      res.json(sig);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/signals/tests/run', (req, res) => {
    try {
      const results = SignalEngineTestRunner.runAllTests();
      res.json({
        totalTests: results.length,
        passedCount: results.filter(r => r.passed).length,
        failedCount: results.filter(r => !r.passed).length,
        allPassed: results.every(r => r.passed),
        results
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // SCORING CONFIGURATION ROUTES (Phase 2)
  // ==========================================
  app.get('/api/config/scoring', (req, res) => {
    res.json(scoringEngine.getConfig());
  });

  app.post('/api/config/scoring', (req, res) => {
    const updated = scoringEngine.updateConfig(req.body);
    res.json(updated);
  });

  // ==========================================
  // WATCHLIST ROUTES
  // ==========================================
  app.get('/api/watchlist', (req, res) => {
    const user = getStrictAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const symbols = db.getWatchlist(user.id);
    res.json(symbols);
  });

  app.post('/api/watchlist', (req, res) => {
    const user = getStrictAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    const currentList = db.getWatchlist(user.id);
    const isUserPro = entitlementService.isPro(user);
    const maxFree = db.trialSettings?.freeMaxWatchlist ?? 5;

    // SECTION 17: If Free limit is exceeded, preserve existing entries but prevent adding new ones until upgrade
    if (!isUserPro && !currentList.includes(symbol) && currentList.length >= maxFree) {
      return res.status(403).json({
        error: `Free Plan limit reached (${maxFree} assets max). Upgrade to PRO to add more assets to your watchlist.`,
        code: 'PRO_REQUIRED',
        limit: maxFree,
        currentCount: currentList.length
      });
    }

    const updated = db.addToWatchlist(user.id, symbol);
    res.json({ watchlist: updated });
  });

  app.delete('/api/watchlist/:symbol', (req, res) => {
    const user = getStrictAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const symbol = decodeURIComponent(req.params.symbol);
    const updated = db.removeFromWatchlist(user.id, symbol);
    res.json({ watchlist: updated });
  });

  // ==========================================
  // ALERTS & NOTIFICATION HISTORY ROUTES
  // ==========================================
  app.get('/api/alerts', (req, res) => {
    const user = getStrictAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const userAlerts = db.getAlerts(user.id);
    const symbol = req.query.symbol as string | undefined;
    if (symbol) {
      const cleanTarget = symbol.replace(/[\/\-_]/g, '').toUpperCase();
      return res.json(userAlerts.filter(a => a.symbol.replace(/[\/\-_]/g, '').toUpperCase() === cleanTarget));
    }
    res.json(userAlerts);
  });

  app.post('/api/alerts', alertRateLimit, (req, res) => {
    const user = getStrictAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const currentAlerts = db.getAlerts(user.id);
    const isUserPro = entitlementService.isPro(user);
    const maxLimit = isUserPro
      ? (db.globalAlertConfig.maxAlertsPerUser || 25)
      : (db.trialSettings?.freeMaxAlerts ?? 3);

    // SECTION 18 & Phase 16: During trial, Pro alert limits apply. After trial, Free limits apply.
    if (currentAlerts.length >= maxLimit) {
      return res.status(403).json({
        error: isUserPro
          ? `Maximum alert limit reached (${maxLimit} alerts max allowed per account). Please remove or edit inactive alerts.`
          : 'Advanced Alerts are available with PRO.',
        code: isUserPro ? 'LIMIT_REACHED' : 'PRO_REQUIRED',
        limit: maxLimit,
        currentCount: currentAlerts.length
      });
    }

    const {
      symbol,
      exchange,
      timeframe,
      conditionType,
      targetValue,
      basePrice,
      percentThreshold,
      direction,
      isRecurring,
      cooldownMinutes,
      notes
    } = req.body;

    if (!symbol || !conditionType) {
      return res.status(400).json({ error: 'Symbol and conditionType are required' });
    }

    // Phase 16: Advanced alert conditions or non-BTC/ETH assets are reserved for PRO
    const ADVANCED_ALERT_CONDITIONS = [
      'BULL_SCORE_ABOVE',
      'DOWNSIDE_RISK_ABOVE',
      'MTF_CONFLUENCE_ALIGNED',
      'WHALE_ACTIVITY',
      'ORDER_FLOW_IMBALANCE',
      'BREAKOUT_DETECTED',
      'BREAKDOWN_DETECTED',
      'OI_SPIKE'
    ];
    const isBtcEth = symbol.toUpperCase().includes('BTC') || symbol.toUpperCase().includes('ETH');
    if (!isUserPro && (ADVANCED_ALERT_CONDITIONS.includes(conditionType) || !isBtcEth)) {
      return res.status(403).json({
        error: 'Advanced Alerts are available with PRO.',
        code: 'PRO_REQUIRED'
      });
    }

    const minCooldown = db.globalAlertConfig.minAlertCooldownMinutes || 5;
    const requestedCooldown = cooldownMinutes ? parseInt(cooldownMinutes) : 15;
    const effectiveCooldown = Math.max(minCooldown, requestedCooldown);

    let parsedTarget = targetValue !== undefined && targetValue !== '' ? parseFloat(targetValue) : undefined;
    const parsedBase = basePrice !== undefined && basePrice !== '' ? parseFloat(basePrice) : undefined;
    const parsedPct = percentThreshold !== undefined && percentThreshold !== '' ? parseFloat(percentThreshold) : undefined;

    // Auto-compute targetValue for percentage conditions if not explicitly supplied
    if (parsedTarget === undefined && parsedBase && parsedPct) {
      if (conditionType === 'PRICE_PCT_UP') {
        parsedTarget = parsedBase * (1 + parsedPct / 100);
      } else if (conditionType === 'PRICE_PCT_DOWN') {
        parsedTarget = parsedBase * (1 - parsedPct / 100);
      } else if (conditionType === 'PRICE_PCT_ANY') {
        parsedTarget = parsedBase * (1 + parsedPct / 100);
      }
    }

    const created = db.addAlert(user.id, {
      symbol,
      exchange: exchange || 'BINANCE',
      timeframe: timeframe || '1h',
      conditionType,
      targetValue: parsedTarget,
      basePrice: parsedBase,
      percentThreshold: parsedPct,
      direction: direction || undefined,
      isRecurring: Boolean(isRecurring),
      cooldownMinutes: effectiveCooldown,
      notes: notes || '',
      isActive: true
    });

    res.json(created);
  });

  app.get('/api/alerts/:id', (req, res) => {
    const user = getStrictAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const alert = db.queryAlertById(req.params.id);
    if (!alert || alert.userId !== user.id) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(alert);
  });

  app.put('/api/alerts/:id', (req, res) => {
    const user = getStrictAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const updated = db.updateAlert(user.id, req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Alert not found' });
    res.json(updated);
  });

  app.delete('/api/alerts/:id', (req, res) => {
    const user = getStrictAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const removed = db.removeAlert(user.id, req.params.id);
    res.json({ success: removed });
  });

  app.get('/api/alerts/events', (req, res) => {
    const user = getAuthUser(req);
    const userId = user ? user.id : 'usr_demo_1';

    const categoryGroup = req.query.categoryGroup as any;
    const category = req.query.category as any;
    const exchange = req.query.exchange as string | undefined;
    const symbol = req.query.symbol as string | undefined;
    const severity = req.query.severity as any;
    const status = req.query.status as any;
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const events = notificationEngine.getAlertEvents(userId, {
      categoryGroup,
      category,
      exchange,
      symbol,
      severity,
      status,
      unreadOnly,
      limit
    });
    res.json(events);
  });

  app.put('/api/alerts/events/:id', (req, res) => {
    const user = getAuthUser(req);
    const userId = user ? user.id : 'usr_demo_1';
    const { status, read } = req.body;

    let success = false;
    if (status) {
      success = notificationEngine.updateAlertStatus(userId, req.params.id, status);
    }
    if (read !== undefined) {
      success = notificationEngine.markAlertRead(userId, req.params.id, Boolean(read));
    }

    res.json({ success });
  });

  app.post('/api/alerts/events/mark-all-read', (req, res) => {
    const user = getAuthUser(req);
    const userId = user ? user.id : 'usr_demo_1';
    const updatedCount = notificationEngine.markAllAlertsRead(userId);
    res.json({ success: true, count: updatedCount });
  });

  app.post('/api/alerts/events/acknowledge-all', (req, res) => {
    const user = getAuthUser(req);
    const userId = user ? user.id : 'usr_demo_1';
    const updatedCount = notificationEngine.acknowledgeAllAlerts(userId);
    res.json({ success: true, count: updatedCount });
  });

  app.delete('/api/alerts/events/:id', (req, res) => {
    const user = getAuthUser(req);
    const userId = user ? user.id : 'usr_demo_1';
    const removed = notificationEngine.deleteAlert(userId, req.params.id);
    res.json({ success: removed });
  });

  app.post('/api/alerts/events/clear', (req, res) => {
    const user = getAuthUser(req);
    const userId = user ? user.id : 'usr_demo_1';
    const mode = (req.body.mode || 'dismissed') as 'all' | 'dismissed' | 'read';
    const clearedCount = notificationEngine.clearAlerts(userId, mode);
    res.json({ success: true, count: clearedCount });
  });

  // User Notification Preferences API
  app.get('/api/notifications/preferences', (req, res) => {
    const user = getAuthUser(req);
    const userId = user ? user.id : 'usr_demo_1';
    const prefs = notificationEngine.getUserPreferences(userId);
    res.json(prefs);
  });

  app.put('/api/notifications/preferences', (req, res) => {
    const user = getAuthUser(req);
    const userId = user ? user.id : 'usr_demo_1';
    const updated = notificationEngine.saveUserPreferences(userId, req.body);
    res.json(updated);
  });

  app.post('/api/notifications/test', (req, res) => {
    const user = getAuthUser(req);
    const userId = user ? user.id : 'usr_demo_1';
    const category = req.body?.category;
    const testAlert = notificationEngine.triggerTestAlert(userId, category);
    res.json({ success: true, alert: testAlert });
  });

  // ==========================================
  // PHASE 3: WHALE INTELLIGENCE ROUTES
  // ==========================================
  app.get('/api/whales/transactions', async (req, res) => {
    try {
      const symbol = req.query.symbol as string | undefined;
      const minUsd = req.query.minUsd ? parseFloat(req.query.minUsd as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const direction = req.query.direction as WhaleTxDirection | 'all' | undefined;
      const type = req.query.type as WhaleTxType | 'all' | undefined;

      const summary = await onChainProviderManager.getWhaleActivity({
        symbol,
        minUsd,
        limit,
        direction,
        type
      });

      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/whales/providers', (req, res) => {
    const providers = onChainProviderManager.getProviders();
    res.json(providers);
  });

  app.post('/api/whales/providers/active', (req, res) => {
    const { providerId } = req.body;
    if (!providerId) return res.status(400).json({ error: 'providerId is required' });
    const success = onChainProviderManager.setActiveProvider(providerId);
    res.json({ success, providers: onChainProviderManager.getProviders() });
  });

  app.post('/api/whales/providers/configure', (req, res) => {
    const { providerId, apiKey } = req.body;
    if (!providerId) return res.status(400).json({ error: 'providerId is required' });
    const success = onChainProviderManager.configureProviderKey(providerId, apiKey || null);
    res.json({ success, providers: onChainProviderManager.getProviders() });
  });

  app.post('/api/whales/simulated/toggle', (req, res) => {
    const { enabled } = req.body;
    onChainProviderManager.setSimulatedEnabled(Boolean(enabled));
    res.json({ success: true, providers: onChainProviderManager.getProviders() });
  });

  // ==========================================
  // PHASE 8: WHALE, ORDER FLOW & LIQUIDATIONS
  // ==========================================
  app.get('/api/whales/large-transfers', async (req, res) => {
    try {
      const user = getAuthUser(req);
      const asset = (req.query.asset as string) || 'BTC';
      if (!entitlementService.canAccessSignal(user, asset)) {
        return res.status(403).json({
          error: 'PRO entitlement required to view institutional whale intelligence for this asset. Free access is available for BTC and ETH.',
          code: 'PRO_REQUIRED',
          isLocked: true
        });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const minUsd = req.query.minUsd ? parseFloat(req.query.minUsd as string) : 500_000;
      const classification = req.query.classification as any;

      const transfers = await whaleProviderManager.getLargeTransfers(asset, {
        limit,
        minUsd,
        eventType: classification
      });

      res.json({
        asset: asset.toUpperCase(),
        count: transfers.length,
        dataQuality: transfers.length > 0 ? transfers[0].dataQuality : 'UNAVAILABLE',
        transfers
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/whales/exchange-flows', async (req, res) => {
    try {
      const user = getAuthUser(req);
      const asset = (req.query.asset as string) || 'BTC';
      if (!entitlementService.canAccessSignal(user, asset)) {
        return res.status(403).json({
          error: 'PRO entitlement required to view exchange flow intelligence for this asset. Free access is available for BTC and ETH.',
          code: 'PRO_REQUIRED',
          isLocked: true
        });
      }
      const summary = await whaleProviderManager.getExchangeFlows(asset);
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/whales/provider-capabilities', (req, res) => {
    try {
      const capabilities = whaleProviderManager.getCapabilities();
      const health = whaleProviderManager.getHealth();
      res.json({ capabilities, health });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/order-flow', async (req, res) => {
    try {
      const user = getAuthUser(req);
      const symbol = (req.query.symbol as string) || 'BTC/USDT';
      if (!entitlementService.canAccessSignal(user, symbol)) {
        return res.status(403).json({
          error: 'PRO entitlement required to view order flow intelligence for this asset. Free access is available for BTC and ETH.',
          code: 'PRO_REQUIRED',
          isLocked: true
        });
      }
      const exchange = ((req.query.exchange as string) || 'BINANCE').toUpperCase() as ExchangeId;
      const timeframe = ((req.query.timeframe as string) || '1h') as Timeframe;

      const detail = await marketDataService.getCoinDetail(symbol, timeframe, exchange);
      if (!detail.coin || !detail.coin.orderFlow) {
        return res.json({
          symbol,
          exchange,
          timeframe,
          dataQuality: 'UNAVAILABLE',
          message: 'Order flow unavailable for this asset or market'
        });
      }

      res.json(detail.coin.orderFlow);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/liquidations/intelligence', async (req, res) => {
    try {
      const user = getAuthUser(req);
      const symbol = (req.query.symbol as string) || 'BTC/USDT';
      if (!entitlementService.canAccessSignal(user, symbol)) {
        return res.status(403).json({
          error: 'PRO entitlement required to view liquidation intelligence for this asset. Free access is available for BTC and ETH.',
          code: 'PRO_REQUIRED',
          isLocked: true
        });
      }
      const exchange = ((req.query.exchange as string) || 'BINANCE').toUpperCase() as ExchangeId;
      const timeframe = ((req.query.timeframe as string) || '1h') as Timeframe;

      const detail = await marketDataService.getCoinDetail(symbol, timeframe, exchange);
      if (!detail.coin || !detail.coin.liquidationIntel) {
        return res.json({
          symbol,
          exchange,
          dataQuality: 'UNAVAILABLE',
          message: 'Liquidation intelligence unavailable or exchange does not report perpetual liquidations'
        });
      }

      res.json(detail.coin.liquidationIntel);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/phase8/tests', async (req, res) => {
    try {
      const testReport = await Phase8EngineTestRunner.runAllTests();
      res.json(testReport);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/phase9/tests', async (req, res) => {
    try {
      const testReport = await Phase9EngineTestRunner.runAllTests();
      res.json(testReport);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/phase9b/tests', async (req, res) => {
    try {
      const testReport = await Phase9bEngineTestRunner.runAllTests();
      res.json(testReport);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Phase 15: Reverse Trial & Free/PRO Entitlement Verification Suite
  app.get('/api/admin/phase15/tests', async (req, res) => {
    try {
      const testReport = await Phase15EntitlementTestRunner.runAllTests();
      res.json(testReport);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ==========================================
  // PHASE 21: EXTERNAL INTELLIGENCE DATA LAYER ROUTES
  // ==========================================
  app.get('/api/external/intelligence/:asset', async (req, res) => {
    try {
      const asset = (req.params.asset || 'BTC').toUpperCase();
      const symbol = (req.query.symbol as string) || `${asset}/USDT`;
      const summary = await externalIntelligenceNormalizer.getIntelligenceSummary(asset, symbol);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/external/whales/:asset', async (req, res) => {
    try {
      const asset = (req.params.asset || 'BTC').toUpperCase();
      const whaleProv = externalIntelligenceRegistry.getWhaleProvider();
      if (!whaleProv) return res.status(404).json({ error: 'Whale provider not available' });

      const window = (req.query.window as any) || '1h';
      const [events, flows] = await Promise.all([
        whaleProv.getWhaleEvents(asset, 20),
        whaleProv.getExchangeFlows(asset, window)
      ]);

      res.json({
        asset,
        window,
        metrics: flows,
        events
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/external/dex/:asset', async (req, res) => {
    try {
      const asset = (req.params.asset || 'BTC').toUpperCase();
      const dexProv = externalIntelligenceRegistry.getDexProvider();
      if (!dexProv) return res.status(404).json({ error: 'DEX provider not available' });

      const [pairs, metrics] = await Promise.all([
        dexProv.getDexPairs(asset),
        dexProv.getDexActivityMetrics(asset)
      ]);

      res.json({
        asset,
        pairs,
        metrics
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/external/evidence/:asset', async (req, res) => {
    try {
      const asset = (req.params.asset || 'BTC').toUpperCase();
      const category = req.query.category as any;
      const minConfidence = req.query.minConfidence ? parseInt(req.query.minConfidence as string) : 50;
      const evidence = evidenceStore.getEvidenceForAsset(asset, category, minConfidence);
      res.json({
        asset,
        count: evidence.length,
        evidence
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PHASE 22: External Intelligence Provider Health Endpoint (Section M)
  app.get('/api/external-intelligence/health', (req, res) => {
    try {
      const summary = externalIntelligenceRegistry.getHealthSummary();
      const telemetry = monitoringService.getExternalTelemetry();
      res.json({
        success: true,
        timestamp: Date.now(),
        ...summary,
        telemetry
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/external/health', (req, res) => {
    try {
      const summary = externalIntelligenceRegistry.getHealthSummary();
      const telemetry = monitoringService.getExternalTelemetry();
      res.json({
        success: true,
        timestamp: Date.now(),
        ...summary,
        telemetry
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // PHASE 3 & 9B: AI TRADER CHAT & REWARDED-AD MONETIZATION GATE
  // ==========================================
  app.post('/api/ai/chat', aiRateLimit, async (req, res) => {
    if (featureFlagService.isKillSwitchActive('AI_TRADER') || !featureFlagService.isFeatureEnabled('AI_TRADER_ENABLED')) {
      return res.status(503).json({
        error: 'AI Trader terminal is temporarily disabled for maintenance.',
        killSwitchActive: true
      });
    }

    const user = getAuthUser(req);
    const { message, exchange, rewardSessionId } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const isPro = Boolean(user && user.isPro) || (user && user.role === 'admin');
    const isAdmin = Boolean(user && user.role === 'admin');

    // 1. Quota Check (Applies to all tiers according to configured limits)
    if (!aiQuotaService.hasQuota(user)) {
      return res.status(403).json({
        error: 'Daily AI Trader quota exhausted. Please upgrade to PRO for higher limits or wait for midnight UTC reset.',
        code: 'QUOTA_EXHAUSTED',
        quota: aiQuotaService.getQuota(user)
      });
    }

    // 2. Rewarded-Ad Gate for Free Users (PRO and Admin are exempt)
    if (!isPro && !isAdmin) {
      if (!rewardSessionId) {
        return res.status(403).json({
          error: 'Free tier requires a completed 15-second rewarded advertisement before each AI Trader request.',
          code: 'REWARD_AD_REQUIRED',
          quota: aiQuotaService.getQuota(user)
        });
      }

      if (!user) {
        return res.status(401).json({
          error: 'Authentication required to verify rewarded ad session.',
          code: 'AUTH_REQUIRED'
        });
      }

      const aiRequestId = `req_ai_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const rewardValidation = rewardedAdService.validateAndConsumeReward(rewardSessionId, user, aiRequestId);
      if (!rewardValidation.valid) {
        return res.status(403).json({
          error: rewardValidation.error || 'Invalid or unverified reward session.',
          code: rewardValidation.code || 'INVALID_REWARD_SESSION'
        });
      }
    }

    // 3. Atomically consume 1 AI quota unit
    const quotaResult = aiQuotaService.consumeQuota(user);
    if (!quotaResult.success) {
      return res.status(403).json({
        error: 'Daily AI Trader quota exhausted.',
        code: 'QUOTA_EXHAUSTED'
      });
    }

    const activeExchange = (exchange?.toUpperCase() || 'BINANCE') as ExchangeId;

    try {
      const aiResponse = await aiTraderService.handleMessage(message, activeExchange);

      // Enforce mandatory disclaimer exact requirement: "DYOR — not financial advice."
      if (!aiResponse.content.includes('DYOR — not financial advice')) {
        aiResponse.content += '\n\nDYOR — not financial advice.';
      }
      aiResponse.disclaimer = 'DYOR — not financial advice.';

      // Record separated telemetry
      const tier = isAdmin ? 'ADMIN' : (isPro ? 'PRO' : 'FREE');
      const estimatedTokens = Math.max(120, Math.round((message.length + aiResponse.content.length) / 3));
      const estimatedCost = (estimatedTokens / 1000) * 0.00015;
      rewardedAdService.recordAiUsage(tier, estimatedTokens, estimatedCost);

      res.json(aiResponse);
    } catch (err) {
      console.error('AI chat error:', err);
      // Safe rollback on backend failure so user is not penalized
      if (!isPro && !isAdmin && rewardSessionId && user) {
        rewardedAdService.rollbackSessionOnFailure(rewardSessionId, user.id);
      }
      aiQuotaService.refundQuota(user);

      res.status(500).json({
        error: (err as Error).message,
        retryAllowed: true,
        message: 'Analysis failed. Your ad reward and AI quota unit have been preserved for retry.'
      });
    }
  });

  app.post('/api/ai/parse-query', aiRateLimit, (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    const parsed = marketQueryParser.parseQuery(query);
    res.json(parsed);
  });

  app.post('/api/market/natural-scan', scannerRateLimit, async (req, res) => {
    try {
      const { query, exchange } = req.body;
      const activeExchange = (exchange?.toUpperCase() || 'BINANCE') as ExchangeId;
      const result = await aiToolLayer.scanMarket({ query, exchange: activeExchange });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Direct AI Tool Calling Endpoint (Controlled Tool Layer)
  app.post('/api/ai/tools/:toolName', aiRateLimit, async (req, res) => {
    try {
      const toolName = req.params.toolName;
      const body = req.body || {};

      switch (toolName) {
        case 'getMarketData':
          return res.json(await aiToolLayer.getMarketData(body));
        case 'getTechnicalIndicators':
          return res.json(await aiToolLayer.getTechnicalIndicators(body));
        case 'getDerivatives':
          return res.json(await aiToolLayer.getDerivatives(body));
        case 'getMarketStructure':
          return res.json(await aiToolLayer.getMarketStructure(body));
        case 'getScores':
          return res.json(await aiToolLayer.getScores(body));
        case 'getBTCContext':
          return res.json(await aiToolLayer.getBTCContext(body.exchange));
        case 'getWhaleActivity':
          return res.json(await aiToolLayer.getWhaleActivity(body));
        case 'scanMarket':
          return res.json(await aiToolLayer.scanMarket(body));
        case 'compareCoins':
          return res.json(await aiToolLayer.compareCoins(body));
        case 'getHistoricalChanges':
          return res.json(await aiToolLayer.getHistoricalChanges(body));
        case 'getIndicatorConflicts':
          return res.json(await aiToolLayer.getIndicatorConflicts(body));
        default:
          return res.status(404).json({ error: `Tool ${toolName} not found in AI tool registry.` });
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ==========================================
  // PHASE 3: TELEGRAM NOTIFICATION ROUTES
  // ==========================================
  app.get('/api/notifications/telegram/config', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const config = telegramService.getConfig(user.id);
    res.json(config);
  });

  app.post('/api/notifications/telegram/config', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const updated = telegramService.saveConfig(user.id, req.body);
    res.json(updated);
  });

  app.post('/api/notifications/telegram/test', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const { botToken, chatId } = req.body;
    const testResult = await telegramService.testConnection(botToken, chatId);
    res.json(testResult);
  });

  // ==========================================
  // PHASE 15: 7-DAY PRO TRIAL & FEATURE GATING CONFIG
  // ==========================================
  // Public/Session trial configuration inspection
  app.get('/api/trial/config', (req, res) => {
    res.json({
      config: db.getTrialSettings(),
      serverTime: Date.now()
    });
  });

  // Admin trial configuration management
  app.get('/api/admin/trial/settings', requireAdmin, (req, res) => {
    res.json({
      settings: db.getTrialSettings()
    });
  });

  app.post('/api/admin/trial/settings', requireAdmin, (req, res) => {
    const adminUser = (req as any).adminUser?.email || 'admin';
    const updated = db.updateTrialSettings(req.body, adminUser);
    db.addAdminAuditLog(adminUser, 'UPDATE_TRIAL_SETTINGS', 'trialSettings', {
      enabled: updated.enabled,
      trialDurationDays: updated.trialDurationDays,
      freeAllowedSymbols: updated.freeAllowedSymbols
    });
    res.json({
      success: true,
      settings: updated
    });
  });

  // Background trial expiration sync job (authoritative server-side expiration)
  setInterval(() => {
    db.checkAllTrialExpirations();
  }, 60000);

  // ==========================================
  // PHASE 4A: ADMIN & SYSTEM MONITORING ROUTES
  // ==========================================
  // Admin-only Detailed System Health Endpoint
  app.get('/api/health/detailed', adminRateLimit, requireAdmin, (req, res) => {
    res.json(monitoringService.getDetailedSystemHealth());
  });

  // Phase 9: Community Forum and Moderation Routes
  app.use('/api/community', communityRateLimit, communityRouter);

  // Phase 9B: Rewarded Ad and AI Monetization Routes
  app.use('/api/ad', adRouter);

  // Phase 13: Global Footer Ad & House Ad System
  app.use('/api/advertising', advertisingRouter);

  // Phase 14: User Profile, Account Security & Session Management
  app.use('/api/account', accountRouter);

  // Phase 16: Universal Subscription & Pricing Engine
  app.use('/api/subscription', subscriptionRouter);

  // Phase 17: Notification & Alert Delivery Reliability Engine
  app.use('/api/notifications', notifRateLimit, notificationRouter);

  // Phase 28: Public Product Analytics, Feedback & Performance Telemetry
  app.post('/api/analytics/track', (req, res) => {
    try {
      const user = getAuthUser(req);
      const { eventType, metadata } = req.body;
      if (!eventType || typeof eventType !== 'string') {
        return res.status(400).json({ error: 'eventType string is required' });
      }
      const event = analyticsService.recordEvent(eventType as any, user ? user.id : null, metadata);
      res.json({ success: true, eventId: event.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/analytics/feedback', (req, res) => {
    try {
      const user = getAuthUser(req);
      const { category, rating, message } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message string is required' });
      }
      const feedback = analyticsService.recordFeedback({
        userId: user ? user.id : null,
        category: category || 'general',
        rating: typeof rating === 'number' ? rating : 5,
        message,
        userTier: user ? user.tier : 'FREE'
      });
      res.status(201).json({ success: true, feedbackId: feedback.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/analytics/perf', (req, res) => {
    try {
      const { type, durationMs, isMobile } = req.body;
      if (type && typeof durationMs === 'number') {
        analyticsService.recordPerformance(type, durationMs, Boolean(isMobile));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Module Routes (all protected with requireAdmin and adminRateLimit)
  app.use('/api/admin', adminRateLimit, requireAdmin, adminRouter);

  // Vite Dev Server or Production Static Files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Generic production error handling middleware (Phase 25)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const correlationId = (req as any).correlationId || 'unknown';
    console.error(`[Error] Unhandled exception [CID: ${correlationId}]:`, err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: 'An internal error occurred while processing the request.',
      correlationId
    });
  });

  // Start scheduled database backups (Phase 25)
  databaseBackupService.startScheduledBackups();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Crypto Intelligence AI (Phase 2 Multi-Exchange Engine) running on port ${PORT}`);
  });

  // Graceful Shutdown Handlers (Phase 25)
  let isShuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Server] Received ${signal}. Initiating graceful shutdown...`);

    server.close(() => {
      console.log('[Server] HTTP server closed.');
      databaseBackupService.stopScheduledBackups();
      try {
        marketDataCache.destroy();
      } catch {
        // ignore
      }
      console.log('[Server] Clean exit completed.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Server] Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
