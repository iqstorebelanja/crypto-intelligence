import { ExchangeId, Timeframe } from '../../src/types';
import { db } from '../db/schema';
import { NormalizedMarketType } from '../types/marketDataEngine';

export type CacheDataType =
  | 'ticker'
  | 'orderbook'
  | 'ohlcv'
  | 'indicators'
  | 'structure'
  | 'scores'
  | 'derivatives';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

export class MarketDataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  // Configured default TTLs (in milliseconds)
  private ttlConfig: Record<CacheDataType, number> = {
    ticker: 3500,        // 3.5s very short TTL
    orderbook: 3000,     // 3s very short TTL
    ohlcv: 20000,        // 20s short TTL
    indicators: 20000,   // derived from OHLCV
    structure: 20000,    // derived from candles
    scores: 20000,       // derived from indicators + derivatives + structure
    derivatives: 20000   // derived from derivatives endpoints
  };

  /**
   * Generates strict, collision-proof keys:
   * e.g. "binance:BTCUSDT:spot:1h:ohlcv", "okx:BTC-USDT:spot:1h:ohlcv", "okx:BTC-USDT-SWAP:swap:1h:ohlcv"
   */
  public static buildKey(
    exchange: ExchangeId,
    market: string,
    marketType: NormalizedMarketType,
    timeframe: Timeframe | 'none',
    dataType: CacheDataType
  ): string {
    const cleanEx = (exchange || 'UNKNOWN').toUpperCase();
    const cleanMkt = (market || 'UNKNOWN').toUpperCase().replace(/\s+/g, '');
    const cleanType = (marketType || 'SPOT').toUpperCase();
    const cleanTf = (timeframe || 'none').toLowerCase();
    return `${cleanEx}:${cleanMkt}:${cleanType}:${cleanTf}:${dataType}`;
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      db.recordCacheMiss();
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      db.recordCacheMiss();
      return null;
    }

    db.recordCacheHit();
    return entry.data as T;
  }

  public set<T>(key: string, dataType: CacheDataType, data: T, customTtlMs?: number): void {
    const ttl = customTtlMs ?? this.ttlConfig[dataType] ?? 10000;
    const now = Date.now();
    this.cache.set(key, {
      data,
      cachedAt: now,
      expiresAt: now + ttl
    });
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
    db.cacheMetrics.keysCount = 0;
    db.cacheMetrics.lastPurge = Date.now();
  }

  public getStats() {
    return {
      size: this.cache.size,
      hitRatio: db.cacheMetrics.hitRatioPercent,
      hits: db.cacheMetrics.hits,
      misses: db.cacheMetrics.misses
    };
  }
}

export const marketDataCache = new MarketDataCache();
