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
  scannerRateLimit
} from './server/services/rateLimiter';
import { telegramService } from './server/services/telegramService';
import { realtimeStreamManager } from './server/services/realtimeStreamManager';
import { exchangeCapabilityRegistry } from './server/services/capabilityRegistry';
import { marketDataCache } from './server/services/marketDataCache';
import { pipelineLogger } from './server/services/pipelineLogger';
import { runPhase6Tests } from './server/tests/phase6EngineTests';
import { adminRouter } from './server/routes/adminRoutes';
import { ExchangeId, Timeframe, WhaleTxDirection, WhaleTxType } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Security Hardening Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  // Helper to extract session user from Bearer token
  const getAuthUser = (req: express.Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      // Fallback to default demo user for seamless terminal browsing
      const demoUser = db.findUserByEmail('demo@cryptointelligence.ai');
      return demoUser || null;
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const session = db.getSession(token);
    if (!session) {
      const demoUser = db.findUserByEmail('demo@cryptointelligence.ai');
      return demoUser || null;
    }
    return db.users.get(session.userId) || null;
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
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = db.createUser(email, password, name || email.split('@')[0]);
    const session = db.createSession(user.id);
    res.json({ user, token: session.token });
  });

  app.post('/api/auth/login', authRateLimit, (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const storedPass = db.userPasswords.get(user.email.toLowerCase());
    if (storedPass !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const session = db.createSession(user.id);
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
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user });
  });

  // ==========================================
  // MULTI-EXCHANGE & DATA QUALITY ROUTES
  // ==========================================
  app.get('/api/exchanges', async (req, res) => {
    const [binanceStats, okxStats, pionexStats, bybitStats] = await Promise.all([
      binanceAdapter.getMarketStats(),
      okxAdapter.getMarketStats(),
      pionexAdapter.getMarketStats(),
      bybitAdapter.getMarketStats()
    ]);

    res.json([
      {
        id: 'BINANCE',
        name: 'Binance',
        marketType: 'Spot & Futures',
        isHealthy: binanceStats.isHealthy,
        latencyMs: binanceStats.latencyMs,
        pairsCount: 50,
        features: ['Spot Tickers', 'OHLCV', 'RSI/MA/BB', 'Open Interest', 'Funding Rate', 'Long/Short Ratio'],
        status: binanceStats.status
      },
      {
        id: 'OKX',
        name: 'OKX',
        marketType: 'Spot Feed v5',
        isHealthy: okxStats.isHealthy,
        latencyMs: okxStats.latencyMs,
        pairsCount: okxStats.totalMarkets,
        features: ['Spot Tickers v5', 'Instruments Discovery', 'Candles v5', 'Order Book Depth', 'Multi-Asset Mapping'],
        status: okxStats.status
      },
      {
        id: 'PIONEX',
        name: 'Pionex',
        marketType: 'Spot Trading Universe',
        isHealthy: pionexStats.isHealthy,
        latencyMs: pionexStats.latencyMs,
        pairsCount: pionexStats.totalMarkets,
        features: ['Spot Tickers v1', 'Symbols Discovery', 'Klines v1', 'Order Depth', 'Grid Trading Universe'],
        status: pionexStats.status
      },
      {
        id: 'BYBIT',
        name: 'Bybit',
        marketType: 'USDT Linear Perpetual',
        isHealthy: bybitStats.isHealthy,
        latencyMs: bybitStats.latencyMs,
        pairsCount: 35,
        features: ['Perpetual Tickers', 'Kline Streams', 'Open Interest v5', 'Funding History', 'Account Ratio'],
        status: bybitStats.status
      }
    ]);
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
        if (!isNaN(val)) coins = coins.filter(c => c.scores.bullScore >= val);
      }

      if (riskMin) {
        const val = parseFloat(riskMin as string);
        if (!isNaN(val)) coins = coins.filter(c => c.scores.downsideRiskScore >= val);
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

      // Sort
      const order = sortOrder === 'asc' ? 1 : -1;
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

      res.json(coins);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Coin detail page with timeframe and exchange selection
  app.get('/api/market/coin/:symbol', coinDetailRateLimit, async (req, res) => {
    try {
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
      res.json(detail);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
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
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const symbols = db.getWatchlist(user.id);
    res.json(symbols);
  });

  app.post('/api/watchlist', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    const updated = db.addToWatchlist(user.id, symbol);
    res.json({ watchlist: updated });
  });

  app.delete('/api/watchlist/:symbol', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const symbol = decodeURIComponent(req.params.symbol);
    const updated = db.removeFromWatchlist(user.id, symbol);
    res.json({ watchlist: updated });
  });

  // ==========================================
  // ALERTS & NOTIFICATION HISTORY ROUTES
  // ==========================================
  app.get('/api/alerts', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const userAlerts = db.getAlerts(user.id);
    res.json(userAlerts);
  });

  app.post('/api/alerts', alertRateLimit, (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const currentAlerts = db.getAlerts(user.id);
    const maxLimit = db.globalAlertConfig.maxAlertsPerUser || 20;
    if (currentAlerts.length >= maxLimit) {
      return res.status(400).json({
        error: `Maximum alert limit reached (${maxLimit} alerts max allowed per account). Please remove or edit inactive alerts.`
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

  app.put('/api/alerts/:id', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const updated = db.updateAlert(user.id, req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Alert not found' });
    res.json(updated);
  });

  app.delete('/api/alerts/:id', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const removed = db.removeAlert(user.id, req.params.id);
    res.json({ success: removed });
  });

  app.get('/api/alerts/events', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const events = db.getAlertEvents(user.id);
    res.json(events);
  });

  app.put('/api/alerts/events/:id', (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { status } = req.body;
    if (status !== 'ACKNOWLEDGED' && status !== 'DISMISSED') {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const success = db.updateAlertEventStatus(user.id, req.params.id, status);
    res.json({ success });
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
  // PHASE 3: AI TRADER CHAT & TOOL LAYER ROUTES
  // ==========================================
  app.post('/api/ai/chat', aiRateLimit, async (req, res) => {
    try {
      const { message, exchange } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const activeExchange = (exchange?.toUpperCase() || 'BINANCE') as ExchangeId;
      const aiResponse = await aiTraderService.handleMessage(message, activeExchange);
      res.json(aiResponse);
    } catch (err) {
      console.error('AI chat error:', err);
      res.status(500).json({ error: (err as Error).message });
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
  // PHASE 4A: ADMIN & SYSTEM MONITORING ROUTES
  // ==========================================
  // Admin-only Detailed System Health Endpoint
  app.get('/api/health/detailed', adminRateLimit, requireAdmin, (req, res) => {
    res.json(monitoringService.getDetailedSystemHealth());
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Crypto Intelligence AI (Phase 2 Multi-Exchange Engine) running on port ${PORT}`);
  });
}

startServer();
