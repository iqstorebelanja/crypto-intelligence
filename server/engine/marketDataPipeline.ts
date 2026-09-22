import { Candle, ExchangeId, Timeframe } from '../../src/types';
import { db } from '../db/schema';
import { IExchangeAdapter } from '../adapters/exchangeAdapter';
import { assetRegistryService } from '../services/assetRegistryService';
import { exchangeCapabilityRegistry } from '../services/capabilityRegistry';
import { marketDataCache, MarketDataCache } from '../services/marketDataCache';
import { pipelineLogger } from '../services/pipelineLogger';
import { realtimeStreamManager } from '../services/realtimeStreamManager';
import { singleFlight } from '../services/singleFlight';
import { DataValidator } from './dataValidator';
import {
  DataFreshnessRecord,
  DataFreshnessStatus,
  MarketObservation,
  NormalizedEngineCandle,
  NormalizedMarketType
} from '../types/marketDataEngine';

export class MarketDataPipeline {
  /**
   * Determine data freshness based on Admin-configured thresholds
   */
  public static calculateFreshness(
    dataTimestamp: number,
    source: string,
    latencyMs: number = 30
  ): DataFreshnessRecord {
    const now = Date.now();
    const thresholds = db.freshnessThresholds || {
      liveMaxSec: 15,
      delayedMaxSec: 60,
      staleMinSec: 60
    };

    const ageSec = Math.max(0, Math.floor((now - dataTimestamp) / 1000));
    let status: DataFreshnessStatus = 'LIVE';

    if (dataTimestamp === 0 || !dataTimestamp) {
      status = 'UNAVAILABLE';
    } else if (ageSec > thresholds.staleMinSec) {
      status = 'STALE';
    } else if (ageSec > thresholds.liveMaxSec) {
      status = 'DELAYED';
    } else {
      status = 'LIVE';
    }

    return {
      timestamp: dataTimestamp,
      receivedAt: now,
      source,
      latencyMs,
      status
    };
  }

  /**
   * Resolves the proper adapter for the exchange
   */
  public static getAdapter(exchange: ExchangeId): IExchangeAdapter {
    return assetRegistryService.getAdapter(exchange);
  }

  /**
   * Fetches, validates, and normalizes a single market observation.
   * STRICT EXCHANGE ISOLATION: Data is fetched only from the given adapter.
   */
  public static async getNormalizedMarketObservation(
    symbol: string,
    exchange: ExchangeId,
    marketType: NormalizedMarketType = 'SPOT'
  ): Promise<MarketObservation | null> {
    const normEx = (exchange || 'BINANCE').toUpperCase() as ExchangeId;
    const cacheKey = MarketDataCache.buildKey(normEx, symbol, marketType, 'none', 'ticker');

    // 1. Check Isolated Cache
    const cached = marketDataCache.get<MarketObservation>(cacheKey);
    if (cached) {
      // Re-evaluate freshness dynamically based on current time
      const fresh = this.calculateFreshness(cached.timestamp, cached.source, cached.freshness.latencyMs);
      return { ...cached, freshness: fresh };
    }

    // 2. Execute via Single-Flight Queue to prevent duplicate upstream storms
    const singleFlightKey = `obs:${cacheKey}`;
    return singleFlight.execute(singleFlightKey, normEx, async () => {
      const adapter = this.getAdapter(normEx);
      const caps = exchangeCapabilityRegistry.getCapabilities(normEx);
      const start = Date.now();

      try {
        // Query ticker & optional derivatives supported by this adapter
        const ticker = await adapter.getTicker(symbol);
        const latencyMs = Date.now() - start;

        if (!ticker) {
          pipelineLogger.log(normEx, 'getNormalizedMarketObservation', `Ticker not found for ${symbol}`, {
            market: symbol
          });
          return null;
        }

        // Validate price & volume
        if (!DataValidator.isValidPrice(ticker.price)) {
          pipelineLogger.log(normEx, 'getNormalizedMarketObservation', `Invalid price ${ticker.price} for ${symbol}`, {
            market: symbol,
            errorCode: 'INVALID_CANDLE'
          });
          return null;
        }

        // Derivatives queries: ONLY if adapter actually supports them!
        let oiSnap = null;
        let fundingSnap = null;
        let lsSnap = null;
        let liqSnap = null;

        if (caps.openInterest && typeof adapter.getOpenInterest === 'function') {
          oiSnap = await adapter.getOpenInterest(ticker.rawSymbol);
        }
        if (caps.funding && typeof adapter.getFundingRate === 'function') {
          fundingSnap = await adapter.getFundingRate(ticker.rawSymbol);
        }
        if (typeof adapter.getLongShortRatio === 'function') {
          lsSnap = await adapter.getLongShortRatio(ticker.rawSymbol);
        }
        if (caps.liquidations && typeof adapter.getLiquidations === 'function') {
          liqSnap = await adapter.getLiquidations(ticker.rawSymbol);
        }

        // Check live stream for realtime price reconciliation
        const liveWs = realtimeStreamManager.getLiveTicker(normEx, ticker.rawSymbol);
        const effectivePrice = liveWs?.price ?? ticker.price;
        const effectiveTs = liveWs?.timestamp ?? ticker.timestamp;
        const source = liveWs ? `${normEx} WebSocket Stream` : `${adapter.name} REST API`;

        const freshness = this.calculateFreshness(effectiveTs, source, latencyMs);

        const observation: MarketObservation = {
          exchange: normEx,
          marketId: ticker.marketId || `${normEx.toLowerCase()}_${ticker.rawSymbol}`,
          exchangeSymbol: ticker.exchangeSymbol || ticker.rawSymbol,
          normalizedSymbol: ticker.normalizedSymbol || ticker.symbol,
          baseAsset: ticker.baseAsset,
          quoteAsset: ticker.quoteAsset,
          marketType,
          timestamp: effectiveTs,
          source,

          lastPrice: effectivePrice,
          bid: ticker.bid ?? null,
          ask: ticker.ask ?? null,
          bidVolume: null,
          askVolume: null,
          bestBid: ticker.bid ?? null,
          bestAsk: ticker.ask ?? null,

          volume24h: ticker.volume24h,
          quoteVolume24h: ticker.quoteVolume24h,
          priceChange24h: ticker.change24h,
          priceChangePercent24h: ticker.change24h,

          open: ticker.price, // fallback to price
          high: ticker.high24h,
          low: ticker.low24h,
          close: effectivePrice,
          volume: ticker.volume24h,
          tradeCount: null,

          fundingRate: fundingSnap?.fundingRate ?? null,
          openInterest: oiSnap?.openInterest ?? null,
          openInterestValue: oiSnap?.openInterestUsd ?? null,
          longShortRatio: lsSnap?.ratio ?? null,
          liquidations: liqSnap?.total24h ?? null,
          longLiquidations: liqSnap?.long24h ?? null,
          shortLiquidations: liqSnap?.short24h ?? null,
          markPrice: null,
          indexPrice: null,

          freshness
        };

        // Cache the validated observation
        marketDataCache.set(cacheKey, 'ticker', observation);
        return observation;
      } catch (err: any) {
        pipelineLogger.log(normEx, 'getNormalizedMarketObservation', err.message || 'Error fetching observation', {
          market: symbol,
          errorCode: 'TIMEOUT'
        });
        return null;
      }
    });
  }

  /**
   * Fetches, validates, and cleans OHLCV candles.
   * Chronologically sorts and identifies FORMING vs CONFIRMED candles.
   */
  public static async getNormalizedCandles(
    symbol: string,
    exchange: ExchangeId,
    timeframe: Timeframe,
    limit: number = 80,
    marketType: NormalizedMarketType = 'SPOT'
  ): Promise<{
    candles: NormalizedEngineCandle[];
    confirmedCandles: Candle[];
    hasFormingCandle: boolean;
    freshness: DataFreshnessRecord;
  }> {
    const normEx = (exchange || 'BINANCE').toUpperCase() as ExchangeId;
    const cacheKey = MarketDataCache.buildKey(normEx, symbol, marketType, timeframe, 'ohlcv');

    const cached = marketDataCache.get<NormalizedEngineCandle[]>(cacheKey);
    if (cached) {
      const latestTs = cached.length > 0 ? cached[cached.length - 1].openTime : Date.now();
      const freshness = this.calculateFreshness(latestTs, `${normEx} Candle Cache`);
      return {
        candles: cached,
        confirmedCandles: DataValidator.extractConfirmedCandles(cached),
        hasFormingCandle: cached.some(c => c.candleState === 'FORMING'),
        freshness
      };
    }

    const singleFlightKey = `candles:${cacheKey}:${limit}`;
    return singleFlight.execute(singleFlightKey, normEx, async () => {
      const adapter = this.getAdapter(normEx);
      const start = Date.now();

      try {
        const rawCandles = await adapter.getOHLCV(symbol, timeframe, limit);
        const latencyMs = Date.now() - start;

        // Run Data Validation Pipeline
        const validated = DataValidator.validateAndNormalizeCandles(rawCandles, normEx, symbol, timeframe);

        if (validated.length === 0) {
          pipelineLogger.log(normEx, 'getNormalizedCandles', `No valid candles returned for ${symbol} ${timeframe}`, {
            market: symbol,
            errorCode: 'OHLCV_FETCH_FAILED'
          });
        }

        const latestTs = validated.length > 0 ? validated[validated.length - 1].openTime : 0;
        const freshness = this.calculateFreshness(latestTs, `${adapter.name} REST Klines`, latencyMs);

        // Cache validated candles
        marketDataCache.set(cacheKey, 'ohlcv', validated);

        return {
          candles: validated,
          confirmedCandles: DataValidator.extractConfirmedCandles(validated),
          hasFormingCandle: validated.some(c => c.candleState === 'FORMING'),
          freshness
        };
      } catch (err: any) {
        pipelineLogger.log(normEx, 'getNormalizedCandles', err.message || 'Candle fetch failed', {
          market: symbol,
          errorCode: 'OHLCV_FETCH_FAILED'
        });
        return {
          candles: [],
          confirmedCandles: [],
          hasFormingCandle: false,
          freshness: this.calculateFreshness(0, 'ERROR', 0)
        };
      }
    });
  }
}
