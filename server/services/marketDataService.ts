import { binanceAdapter } from '../adapters/binanceAdapter';
import { bybitAdapter } from '../adapters/bybitAdapter';
import { okxAdapter } from '../adapters/okxAdapter';
import { pionexAdapter } from '../adapters/pionexAdapter';
import { IExchangeAdapter } from '../adapters/exchangeAdapter';
import { alertEngine } from '../engine/alertEngine';
import { derivativesEngine } from '../engine/derivativesEngine';
import { analyzeMarketStructure } from '../engine/marketStructure';
import { scoringEngine } from '../engine/scoringEngine';
import { computeTechnicalIndicators } from '../engine/technicalIndicators';
import { signalEngine } from '../engine/signalEngine';
import { orderFlowEngine } from '../engine/orderFlowEngine';
import { liquidationEngine } from '../engine/liquidationEngine';
import { whaleProviderManager } from '../adapters/whaleProvider';
import { db } from '../db/schema';
import { assetRegistryService } from './assetRegistryService';
import { exchangeCapabilityRegistry } from './capabilityRegistry';
import { marketDataCache } from './marketDataCache';
import { pipelineLogger } from './pipelineLogger';
import { realtimeStreamManager } from './realtimeStreamManager';
import { singleFlight } from './singleFlight';
import { MarketDataPipeline } from '../engine/marketDataPipeline';
import { DataValidator } from '../engine/dataValidator';
import {
  BtcMarketCondition,
  Candle,
  ExchangeId,
  MarketOverview,
  MarketSentimentData,
  NormalizedCoinData,
  PriceHistoryPoint,
  Timeframe
} from '../../src/types';

export class MarketDataService {
  private exchangeCache: Map<string, { coins: NormalizedCoinData[]; timestamp: number }> = new Map();
  private isScanningExchange: Map<string, boolean> = new Map();
  private cachedFearAndGreed: { value: number; classification: string; timestamp: number } | null = null;
  private lastFngFetchAt = 0;

  constructor() {
    // Initial discovery trigger on service start
    assetRegistryService.runDiscovery().catch(err => {
      console.warn('Initial asset discovery warning:', (err as Error).message);
    });
  }

  public getAdapter(exchange: ExchangeId): IExchangeAdapter {
    return assetRegistryService.getAdapter(exchange);
  }

  /**
   * Main Scanner Entrypoint:
   * Supports:
   * - 'ALL' / 'ALL EXCHANGES' (every active market from every exchange, separate rows per exchange)
   * - 'BINANCE'
   * - 'OKX'
   * - 'PIONEX'
   * - 'BYBIT'
   * - Comma-delimited list e.g. 'BINANCE,OKX'
   */
  public async scanMarket(exchangeQuery: string = 'ALL'): Promise<NormalizedCoinData[]> {
    const rawUpper = (exchangeQuery || 'ALL').toUpperCase().trim();

    if (rawUpper === 'ALL' || rawUpper === 'ALL EXCHANGES') {
      return this.scanAllExchanges(['BINANCE', 'OKX', 'PIONEX', 'BYBIT']);
    }

    if (rawUpper.includes(',')) {
      const selected = rawUpper.split(',').map(s => s.trim()) as ExchangeId[];
      return this.scanAllExchanges(selected);
    }

    return this.scanSingleExchange(rawUpper as ExchangeId);
  }

  public async scanAllExchanges(exchanges: ExchangeId[] = ['BINANCE', 'OKX', 'PIONEX', 'BYBIT']): Promise<NormalizedCoinData[]> {
    const results = await Promise.allSettled(
      exchanges.map(ex => this.scanSingleExchange(ex))
    );

    const allCoins: NormalizedCoinData[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allCoins.push(...res.value);
      }
    }

    // Enrich cross-exchange linkages: each coin knows which other exchanges list this baseAsset
    this.enrichCrossExchangeMarkets(allCoins);

    return allCoins;
  }

  public async scanSingleExchange(exchange: ExchangeId): Promise<NormalizedCoinData[]> {
    const normEx = exchange.toUpperCase() as ExchangeId;
    const now = Date.now();
    const cacheTtl = (db.scannerConfig.cacheDurationSec || 6) * 1000;

    const cached = this.exchangeCache.get(normEx);
    if (cached && now - cached.timestamp < cacheTtl) {
      db.recordCacheHit();
      return this.enrichFreshness(cached.coins);
    }

    if (this.isScanningExchange.get(normEx) && cached) {
      db.recordCacheHit();
      return this.enrichFreshness(cached.coins);
    }

    db.recordCacheMiss();
    this.isScanningExchange.set(normEx, true);

    try {
      const adapter = this.getAdapter(normEx);
      const tickers = await adapter.getAllTickers();
      const normalizedCoins: NormalizedCoinData[] = [];

      // Process in controlled batches
      const batchSize = normEx === 'BINANCE' ? 10 : 8;
      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize);
        const processed = await Promise.all(
          batch.map(async ticker => {
            const hasDerivatives = exchangeCapabilityRegistry.supports(normEx, 'openInterest') ||
                                   exchangeCapabilityRegistry.supports(normEx, 'funding');

            const [rawCandles, oiSnap, fundingSnap, lsSnap, liqSnap] = await Promise.all([
              adapter.getOHLCV(ticker.symbol, '1h', 50),
              hasDerivatives && typeof adapter.getOpenInterest === 'function' ? adapter.getOpenInterest(ticker.rawSymbol) : Promise.resolve(null),
              hasDerivatives && typeof adapter.getFundingRate === 'function' ? adapter.getFundingRate(ticker.rawSymbol) : Promise.resolve(null),
              hasDerivatives && typeof adapter.getLongShortRatio === 'function' ? adapter.getLongShortRatio(ticker.rawSymbol) : Promise.resolve(null),
              hasDerivatives && typeof adapter.getLiquidations === 'function' ? adapter.getLiquidations(ticker.rawSymbol) : Promise.resolve(null)
            ]);

            // Validate and clean OHLCV candles
            const validatedEngineCandles = DataValidator.validateAndNormalizeCandles(rawCandles, normEx, ticker.symbol, '1h');
            const confirmedCandles = DataValidator.extractConfirmedCandles(validatedEngineCandles);
            const effectiveCandles = confirmedCandles.length >= 10 ? confirmedCandles : rawCandles;

            const indicators = computeTechnicalIndicators(effectiveCandles);
            const structure = analyzeMarketStructure(effectiveCandles, '1h', 5);

            // Reconcile live price from WebSocket if available
            const liveTick = realtimeStreamManager.getLiveTicker(normEx, ticker.rawSymbol);
            const effectivePrice = liveTick?.price || ticker.price;
            const effectiveTimestamp = liveTick?.timestamp || ticker.timestamp;

            const derivatives = hasDerivatives
              ? derivativesEngine.assembleDerivativesData(
                  ticker.symbol,
                  normEx,
                  effectivePrice,
                  ticker.change24h,
                  oiSnap,
                  fundingSnap,
                  lsSnap,
                  liqSnap
                )
              : null;

            const scores = scoringEngine.computeScores(
              ticker.symbol,
              indicators,
              effectivePrice,
              ticker.change24h,
              '1h',
              normEx,
              structure,
              derivatives
            );

            const freshnessRecord = MarketDataPipeline.calculateFreshness(
              effectiveTimestamp,
              liveTick ? `${normEx} WebSocket` : `${adapter.name} API`
            );
            const dataStatus: 'LIVE' | 'DATA DELAYED' = freshnessRecord.status === 'LIVE' ? 'LIVE' : 'DATA DELAYED';
            const ageSeconds = Math.max(0, Math.floor((Date.now() - effectiveTimestamp) / 1000));

            const asset = assetRegistryService.getAsset(ticker.baseAsset);

            const coin: NormalizedCoinData = {
              id: `${normEx.toLowerCase()}_${ticker.rawSymbol}`,
              symbol: ticker.symbol,
              rawSymbol: ticker.rawSymbol,
              marketId: ticker.marketId || `${normEx.toLowerCase()}_${ticker.rawSymbol}`,
              exchangeSymbol: ticker.exchangeSymbol || ticker.rawSymbol,
              normalizedSymbol: ticker.normalizedSymbol || ticker.symbol,
              baseAsset: ticker.baseAsset,
              quoteAsset: ticker.quoteAsset,
              price: effectivePrice,
              change24h: ticker.change24h,
              high24h: Math.max(ticker.high24h, effectivePrice),
              low24h: Math.min(ticker.low24h, effectivePrice),
              volume24h: ticker.volume24h,
              quoteVolume24h: ticker.quoteVolume24h,
              exchange: normEx,
              marketType: ticker.marketType || (normEx === 'BYBIT' ? 'PERPETUAL' : 'SPOT'),
              source: liveTick ? `${normEx} WebSocket` : `${adapter.name} API`,
              timestamp: effectiveTimestamp,
              dataStatus,
              freshnessSeconds: ageSeconds,
              isVerifiedIdentity: asset?.isVerifiedIdentity ?? true,
              unverifiedReason: asset?.unverifiedReason,
              indicators,
              scores,
              scoreSnapshot: scores,
              marketStructure: structure,
              derivatives: derivatives || null
            };
            return coin;
          })
        );
        normalizedCoins.push(...processed);
      }

      // Enrich all scanned coins with Signal Intelligence Engine signals
      const btcCoin = normalizedCoins.find(
        c => c.symbol.toUpperCase().includes('BTC/USDT') || c.symbol.toUpperCase().includes('BTCUSDT')
      );
      for (const coin of normalizedCoins) {
        try {
          const sig = signalEngine.evaluateSignal(coin, undefined, btcCoin, true);
          coin.signal = sig;
          coin.multiTimeframeSummary = sig.multiTimeframeSummary;
        } catch {
          // Keep resilient
        }
      }

      this.exchangeCache.set(normEx, { coins: normalizedCoins, timestamp: now });

      // Run Alert Engine on newly scanned coins in the background
      alertEngine.checkAlertsAgainstMarket(normalizedCoins);

      return this.enrichFreshness(normalizedCoins);
    } catch (err) {
      console.warn(`[MarketDataService] ${normEx} scan error:`, (err as Error).message);
      if (cached) {
        return this.enrichFreshness(cached.coins);
      }
      return [];
    } finally {
      this.isScanningExchange.set(normEx, false);
    }
  }

  private enrichCrossExchangeMarkets(coins: NormalizedCoinData[]): void {
    const byBase = new Map<string, NormalizedCoinData[]>();
    for (const c of coins) {
      const b = c.baseAsset.toUpperCase();
      if (!byBase.has(b)) byBase.set(b, []);
      byBase.get(b)!.push(c);
    }

    for (const c of coins) {
      const sameBaseCoins = byBase.get(c.baseAsset.toUpperCase()) || [];
      c.crossExchangeMarkets = sameBaseCoins
        .filter(other => other.exchange !== c.exchange || other.marketType !== c.marketType)
        .map(other => ({
          exchange: other.exchange,
          exchangeSymbol: other.exchangeSymbol || other.rawSymbol,
          price: other.price,
          change24h: other.change24h,
          marketType: other.marketType
        }));
    }
  }

  private enrichFreshness(coins: NormalizedCoinData[]): NormalizedCoinData[] {
    const now = Date.now();
    return coins.map(c => {
      const ageSeconds = Math.max(0, Math.floor((now - c.timestamp) / 1000));
      return {
        ...c,
        freshnessSeconds: ageSeconds,
        dataStatus: ageSeconds > 45 ? 'DATA DELAYED' : 'LIVE'
      };
    });
  }

  private async fetchFearAndGreed(btcCondition?: BtcMarketCondition): Promise<{ value: number; classification: string; source: string; timestamp: number }> {
    const now = Date.now();
    if (this.cachedFearAndGreed && now - this.lastFngFetchAt < 600000) {
      return {
        ...this.cachedFearAndGreed,
        source: 'Alternative.me Crypto F&G API'
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('https://api.alternative.me/fng/?limit=1', { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        if (json?.data && json.data.length > 0) {
          const item = json.data[0];
          const val = parseInt(item.value, 10);
          if (!isNaN(val)) {
            this.cachedFearAndGreed = {
              value: Math.max(0, Math.min(100, val)),
              classification: item.value_classification || 'Neutral',
              timestamp: parseInt(item.timestamp, 10) * 1000 || now
            };
            this.lastFngFetchAt = now;
            return {
              ...this.cachedFearAndGreed,
              source: 'Alternative.me Crypto F&G API'
            };
          }
        }
      }
    } catch {
      // Fallback
    }

    const btcRsi = btcCondition?.rsi14 ?? 50;
    const btcChange = btcCondition?.change24h ?? 0;
    const syntheticVal = Math.round(
      Math.max(10, Math.min(95, btcRsi * 0.7 + (btcChange > 0 ? Math.min(25, btcChange * 3) : Math.max(-25, btcChange * 3)) + 15))
    );
    const classification =
      syntheticVal < 25
        ? 'Extreme Fear'
        : syntheticVal < 45
        ? 'Fear'
        : syntheticVal < 56
        ? 'Neutral'
        : syntheticVal < 76
        ? 'Greed'
        : 'Extreme Greed';

    return {
      value: syntheticVal,
      classification,
      source: 'Market Confluence Fallback Engine',
      timestamp: now
    };
  }

  public async calculateSentiment(coins: NormalizedCoinData[], btcCondition: BtcMarketCondition): Promise<MarketSentimentData> {
    const fng = await this.fetchFearAndGreed(btcCondition);

    // 1. Global RSI calculation
    const validRsis = coins
      .map(c => c.indicators?.rsi14)
      .filter((r): r is number => typeof r === 'number' && !isNaN(r));

    const avgRsi = validRsis.length > 0
      ? validRsis.reduce((sum, r) => sum + r, 0) / validRsis.length
      : btcCondition.rsi14;

    const oversoldCount = validRsis.filter(r => r < 30).length;
    const overboughtCount = validRsis.filter(r => r > 70).length;
    const neutralCount = validRsis.length - (oversoldCount + overboughtCount);
    const totalCount = validRsis.length || 1;

    const rsiStatus = avgRsi < 30
      ? 'Oversold'
      : avgRsi < 45
      ? 'Bearish Momentum'
      : avgRsi <= 55
      ? 'Neutral'
      : avgRsi <= 70
      ? 'Bullish Momentum'
      : 'Overbought';

    // 2. 24h Dominant Market Momentum
    const totalCoins = coins.length || 1;
    const advancingCoins = coins.filter(c => c.change24h > 0);
    const decliningCoins = coins.filter(c => c.change24h < 0);
    const advancingCount = advancingCoins.length;
    const decliningCount = decliningCoins.length;
    const advancingPercent = Math.round((advancingCount / totalCoins) * 100);

    const sumChange = coins.reduce((acc, c) => acc + (c.change24h || 0), 0);
    const averageChange24h = Number((sumChange / totalCoins).toFixed(2));

    const breadthScore = advancingPercent;
    const changeScore = Math.max(0, Math.min(100, 50 + (averageChange24h * 5)));
    const momentumValue = Math.round(breadthScore * 0.6 + changeScore * 0.4);

    const momentumStatus = momentumValue < 30
      ? 'Strong Bearish Breadth'
      : momentumValue < 45
      ? 'Bearish Tilt'
      : momentumValue <= 55
      ? 'Balanced Breadth'
      : momentumValue <= 70
      ? 'Bullish Tilt'
      : 'Strong Bullish Breadth';

    // 3. Composite Sentiment Index
    const compositeIndex = Math.round(
      (fng.value * 0.40) +
      (avgRsi * 0.35) +
      (momentumValue * 0.25)
    );

    const clampedIndex = Math.max(0, Math.min(100, compositeIndex));

    let tier: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed' = 'Neutral';
    let color = '#eab308';

    if (clampedIndex < 25) {
      tier = 'Extreme Fear';
      color = '#f43f5e';
    } else if (clampedIndex < 45) {
      tier = 'Fear';
      color = '#f97316';
    } else if (clampedIndex <= 55) {
      tier = 'Neutral';
      color = '#eab308';
    } else if (clampedIndex <= 75) {
      tier = 'Greed';
      color = '#10b981';
    } else {
      tier = 'Extreme Greed';
      color = '#06b6d4';
    }

    return {
      index: clampedIndex,
      tier,
      color,
      globalRsi: {
        value: Number(avgRsi.toFixed(1)),
        oversoldPercent: Math.round((oversoldCount / totalCount) * 100),
        overboughtPercent: Math.round((overboughtCount / totalCount) * 100),
        neutralPercent: Math.round((neutralCount / totalCount) * 100),
        oversoldCount,
        overboughtCount,
        neutralCount,
        status: rsiStatus,
        weight: 0.35
      },
      fearAndGreed: {
        value: fng.value,
        classification: fng.classification,
        source: fng.source,
        timestamp: fng.timestamp,
        weight: 0.40
      },
      marketMomentum24h: {
        value: momentumValue,
        advancingCount,
        decliningCount,
        totalCount: totalCoins,
        advancingPercent,
        averageChange24h,
        status: momentumStatus,
        weight: 0.25
      },
      lastCalculatedAt: Date.now()
    };
  }

  public async getMarketOverview(exchangeQuery: string = 'BINANCE'): Promise<MarketOverview> {
    const exchange = exchangeQuery.toUpperCase();
    const isAll = exchange === 'ALL' || exchange === 'ALL EXCHANGES';

    const [coins, statsResult] = await Promise.all([
      this.scanMarket(exchange),
      isAll
        ? binanceAdapter.getMarketStats()
        : this.getAdapter(exchange as ExchangeId).getExchangeStatus()
    ]);

    const btc = coins.find(c => c.rawSymbol.includes('BTC') || c.baseAsset === 'BTC') || coins[0];
    const eth = coins.find(c => c.rawSymbol.includes('ETH') || c.baseAsset === 'ETH') || coins[1];

    const btcCondition: BtcMarketCondition = {
      price: btc ? btc.price : 86200,
      change24h: btc ? btc.change24h : 2.5,
      rsi14: btc ? btc.indicators.rsi14 : 58,
      ma20: btc ? btc.indicators.ma20 : 85500,
      ma50: btc ? btc.indicators.ma50 : 84000,
      ma200: btc ? btc.indicators.ma200 : 72000,
      priceVsMa20: btc ? btc.indicators.priceVsMa20 : 'above',
      priceVsMa50: btc ? btc.indicators.priceVsMa50 : 'above',
      priceVsMa200: btc ? btc.indicators.priceVsMa200 : 'above',
      bullScore: btc ? btc.scores.bullScore : 74,
      downsideRiskScore: btc ? btc.scores.downsideRiskScore : 32,
      signal: btc ? btc.scores.signal : 'Bullish conditions',
      freshnessSeconds: btc ? btc.freshnessSeconds : 2,
      dataStatus: btc && btc.freshnessSeconds > 45 ? 'DATA DELAYED' : 'LIVE'
    };

    const sentiment = await this.calculateSentiment(coins, btcCondition);

    const topBullCoins = [...coins]
      .sort((a, b) => b.scores.bullScore - a.scores.bullScore)
      .slice(0, 6);

    const topRiskCoins = [...coins]
      .sort((a, b) => b.scores.downsideRiskScore - a.scores.downsideRiskScore)
      .slice(0, 6);

    const volumeSpikeCoins = [...coins]
      .filter(c => c.indicators.volumeAnalysis.isSpike)
      .sort((a, b) => b.indicators.volumeAnalysis.ratio - a.indicators.volumeAnalysis.ratio)
      .slice(0, 6);

    const momentumCoins = [...coins]
      .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
      .slice(0, 6);

    return {
      btcCondition,
      ethPrice: eth ? eth.price : 3150,
      ethChange24h: eth ? eth.change24h : 1.8,
      totalPairsScanned: coins.length,
      activeExchange: (isAll ? 'ALL' : exchange) as any,
      sentiment,
      systemHealth: {
        isHealthy: statsResult.isHealthy,
        latencyMs: statsResult.latencyMs,
        lastCheckedAt: statsResult.lastCheckedAt,
        statusText: statsResult.isHealthy
          ? `${isAll ? 'Multi-Exchange Unified Universe' : exchange} market streams operational`
          : `${exchange} data stream experiencing delay`
      },
      topBullCoins,
      topRiskCoins,
      volumeSpikeCoins,
      momentumCoins
    };
  }

  /**
   * COIN DETAIL IMPLEMENTATION:
   * Uses the EXACT specified exchange data, NOT Binance data!
   * All indicators, candles, and scores come directly from that exchange adapter.
   */
  public async getCoinDetail(
    symbolOrRaw: string,
    timeframe: Timeframe = '1h',
    exchange: ExchangeId = 'BINANCE'
  ): Promise<{
    coin: NormalizedCoinData | null;
    candles: Candle[];
    history7d: PriceHistoryPoint[];
    timeframe: Timeframe;
    exchange: ExchangeId;
  }> {
    const normExchange = exchange.toUpperCase() as ExchangeId;
    const adapter = this.getAdapter(normExchange);

    const cleanRaw = symbolOrRaw.toUpperCase();
    const cleanFormatted = symbolOrRaw.includes('/')
      ? symbolOrRaw.toUpperCase()
      : `${cleanRaw.replace(/[\/\-_]/g, '').replace('USDT', '')}/USDT`;

    const baseAsset = cleanRaw.replace(/[\/\-_]/g, '').replace('USDT', '');
    const hasDerivatives = exchangeCapabilityRegistry.supports(normExchange, 'openInterest') ||
                           exchangeCapabilityRegistry.supports(normExchange, 'funding');

    const [ticker, candlesResult, dailyCandles, oiSnap, fundingSnap, lsSnap, liqSnap, orderBookSnap] = await Promise.all([
      adapter.getTicker(cleanRaw),
      MarketDataPipeline.getNormalizedCandles(cleanRaw, normExchange, timeframe, 80),
      adapter.getOHLCV(cleanRaw, '1D', 10),
      hasDerivatives && typeof adapter.getOpenInterest === 'function' ? adapter.getOpenInterest(cleanRaw) : Promise.resolve(null),
      hasDerivatives && typeof adapter.getFundingRate === 'function' ? adapter.getFundingRate(cleanRaw) : Promise.resolve(null),
      hasDerivatives && typeof adapter.getLongShortRatio === 'function' ? adapter.getLongShortRatio(cleanRaw) : Promise.resolve(null),
      hasDerivatives && typeof adapter.getLiquidations === 'function' ? adapter.getLiquidations(cleanRaw) : Promise.resolve(null),
      typeof adapter.getOrderBook === 'function' ? adapter.getOrderBook(cleanRaw) : Promise.resolve(null)
    ]);

    const candles = candlesResult.confirmedCandles.length >= 5
      ? candlesResult.confirmedCandles
      : candlesResult.candles.map(c => ({
          time: c.openTime,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume
        }));

    if (!ticker && candles.length === 0) {
      return {
        coin: null,
        candles: [],
        history7d: [],
        timeframe,
        exchange: normExchange
      };
    }

    // Indicators strictly calculated on confirmed candles
    const indicators = computeTechnicalIndicators(candles);
    const structure = analyzeMarketStructure(candles, timeframe, 5);

    // Reconcile live price from WebSocket if available
    const liveTick = realtimeStreamManager.getLiveTicker(normExchange, ticker?.rawSymbol || cleanRaw);
    const price = liveTick?.price || ticker?.price || candles[candles.length - 1]?.close || 100;
    const change24h = ticker?.change24h || 0;
    const high24h = Math.max(ticker?.high24h || price * 1.03, price);
    const low24h = Math.min(ticker?.low24h || price * 0.97, price);
    const volume24h = ticker?.volume24h || 10000;
    const quoteVolume24h = ticker?.quoteVolume24h || volume24h * price;
    const effectiveTimestamp = liveTick?.timestamp || ticker?.timestamp || Date.now();

    const derivatives = hasDerivatives
      ? derivativesEngine.assembleDerivativesData(
          cleanFormatted,
          normExchange,
          price,
          change24h,
          oiSnap,
          fundingSnap,
          lsSnap,
          liqSnap
        )
      : null;

    const scores = scoringEngine.computeScores(
      cleanFormatted,
      indicators,
      price,
      change24h,
      timeframe,
      normExchange,
      structure,
      derivatives
    );

    const freshnessRecord = MarketDataPipeline.calculateFreshness(
      effectiveTimestamp,
      liveTick ? `${normExchange} WebSocket` : `${adapter.name} Market Feed`
    );
    const ageSeconds = Math.max(0, Math.floor((Date.now() - effectiveTimestamp) / 1000));
    const dataStatus: 'LIVE' | 'DATA DELAYED' = freshnessRecord.status === 'LIVE' ? 'LIVE' : 'DATA DELAYED';

    const history7d = (dailyCandles && dailyCandles.length > 0 ? dailyCandles.slice(-7) : []).map((c, idx, arr) => {
      const prevClose = idx > 0 ? arr[idx - 1].close : c.open;
      const changePercent = prevClose > 0 ? Number((((c.close - prevClose) / prevClose) * 100).toFixed(2)) : 0;
      const d = new Date(c.time);
      return {
        time: c.time,
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        shortDate: d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        price: c.close,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        changePercent
      };
    });

    // Check what other exchanges list this baseAsset
    const markets = assetRegistryService.getMarketsForAsset(baseAsset);
    const crossExchangeMarkets = markets
      .filter(m => m.exchange !== normExchange)
      .map(m => ({
        exchange: m.exchange,
        exchangeSymbol: m.exchangeSymbol,
        price: price, // baseline or live
        change24h: change24h,
        marketType: m.marketType
      }));

    const asset = assetRegistryService.getAsset(baseAsset);

    const coin: NormalizedCoinData = {
      id: `${normExchange.toLowerCase()}_${ticker?.rawSymbol || cleanRaw}`,
      symbol: cleanFormatted,
      rawSymbol: ticker?.rawSymbol || cleanRaw,
      marketId: ticker?.marketId || `${normExchange.toLowerCase()}_${cleanRaw}`,
      exchangeSymbol: ticker?.exchangeSymbol || cleanRaw,
      normalizedSymbol: cleanFormatted,
      baseAsset: ticker?.baseAsset || baseAsset,
      quoteAsset: ticker?.quoteAsset || 'USDT',
      price,
      change24h,
      high24h,
      low24h,
      volume24h,
      quoteVolume24h,
      exchange: normExchange,
      marketType: ticker?.marketType || (normExchange === 'BYBIT' ? 'PERPETUAL' : 'SPOT'),
      source: liveTick ? `${normExchange} WebSocket` : `${adapter.name} Market Feed`,
      timestamp: effectiveTimestamp,
      dataStatus,
      freshnessSeconds: ageSeconds,
      isVerifiedIdentity: asset?.isVerifiedIdentity ?? true,
      unverifiedReason: asset?.unverifiedReason,
      indicators,
      scores,
      scoreSnapshot: scores,
      marketStructure: structure,
      derivatives: derivatives || null,
      history7d,
      crossExchangeMarkets
    };

    // Calculate real-time market signal using timeframe candles
    try {
      const sig = signalEngine.evaluateSignal(coin, { [timeframe]: candles }, null, true);
      coin.signal = sig;
      coin.multiTimeframeSummary = sig.multiTimeframeSummary;
    } catch {
      // Keep resilient
    }

    return {
      coin,
      candles,
      history7d,
      timeframe,
      exchange: normExchange
    };
  }

  /**
   * Returns telemetry metrics for Admin Market Data Engine
   */
  public getPipelineMetrics() {
    return {
      streams: realtimeStreamManager.getMetrics(),
      singleFlight: singleFlight.getStats(),
      cache: marketDataCache.getStats(),
      capabilities: exchangeCapabilityRegistry.getAllCapabilities(),
      logs: pipelineLogger.getRecentLogs(25)
    };
  }
}

export const marketDataService = new MarketDataService();
