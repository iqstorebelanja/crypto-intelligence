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
  | 'derivatives'
  | 'signals';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  lastAccessed: number;
  estimatedBytes: number;
}

export class MarketDataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries = 2500;
  private pruneTimer: NodeJS.Timeout | null = null;
  private totalEvictions = 0;

  // Configured default TTLs (in milliseconds)
  private ttlConfig: Record<CacheDataType, number> = {
    ticker: 3500,        // 3.5s very short TTL
    orderbook: 3000,     // 3s very short TTL
    ohlcv: 20000,        // 20s short TTL
    indicators: 25000,   // derived from OHLCV
    structure: 25000,    // derived from candles
    scores: 25000,       // derived from indicators + derivatives + structure
    derivatives: 20000,  // derived from derivatives endpoints
    signals: 25000       // derived from signals engine
  };

  constructor() {
    // Background eviction timer: prune expired keys every 30 seconds
    this.pruneTimer = setInterval(() => {
      this.pruneExpired();
    }, 30000);
  }

  /**
   * Generates strict, collision-proof keys with complete dimensional isolation:
   * e.g. "BINANCE:BTCUSDT:BTC/USDT:SPOT:1h:ohlcv"
   * e.g. "OKX:BTC-USDT-SWAP:BTC/USDT:PERPETUAL:1h:ohlcv"
   */
  public static buildKey(
    exchange: ExchangeId,
    market: string,
    marketType: NormalizedMarketType,
    timeframe: Timeframe | 'none',
    dataType: CacheDataType,
    symbol?: string
  ): string {
    const cleanEx = (exchange || 'UNKNOWN').toUpperCase();
    const cleanMkt = (market || 'UNKNOWN').toUpperCase().replace(/\s+/g, '');
    const cleanSym = (symbol || market || 'UNKNOWN').toUpperCase().replace(/\s+/g, '');
    const cleanType = (marketType || 'SPOT').toUpperCase();
    const cleanTf = (timeframe || 'none').toLowerCase();
    return `${cleanEx}:${cleanMkt}:${cleanSym}:${cleanType}:${cleanTf}:${dataType}`;
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

    entry.lastAccessed = now;
    db.recordCacheHit();
    return entry.data as T;
  }

  public set<T>(key: string, dataType: CacheDataType, data: T, customTtlMs?: number): void {
    const ttl = customTtlMs ?? this.ttlConfig[dataType] ?? 10000;
    const now = Date.now();

    // Enforce cache bound if maxEntries reached: evict oldest accessed
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest(Math.max(20, Math.floor(this.maxEntries * 0.05)));
    }

    // Estimate memory footprint
    let estimatedBytes = 128;
    try {
      if (typeof data === 'string') estimatedBytes = data.length * 2;
      else if (Array.isArray(data)) estimatedBytes = data.length * 96;
      else if (typeof data === 'object' && data !== null) estimatedBytes = 256;
    } catch {
      estimatedBytes = 128;
    }

    this.cache.set(key, {
      data,
      cachedAt: now,
      expiresAt: now + ttl,
      lastAccessed: now,
      estimatedBytes
    });

    db.cacheMetrics.keysCount = this.cache.size;
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  public delete(key: string): void {
    this.cache.delete(key);
    db.cacheMetrics.keysCount = this.cache.size;
  }

  public clear(): void {
    this.cache.clear();
    db.cacheMetrics.keysCount = 0;
    db.cacheMetrics.lastPurge = Date.now();
  }

  /**
   * Periodic pruning of expired cache keys
   */
  public pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    db.cacheMetrics.keysCount = this.cache.size;
    return pruned;
  }

  /**
   * Evicts least recently accessed entries to protect heap memory
   */
  private evictOldest(count: number): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toRemove = entries.slice(0, count);
    for (const [k] of toRemove) {
      this.cache.delete(k);
      this.totalEvictions++;
    }
    db.cacheMetrics.keysCount = this.cache.size;
  }

  public getStats() {
    let totalEstimatedBytes = 0;
    for (const entry of this.cache.values()) {
      totalEstimatedBytes += entry.estimatedBytes;
    }

    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      estimatedMemoryKb: Math.round(totalEstimatedBytes / 1024),
      totalEvictions: this.totalEvictions,
      hitRatio: db.cacheMetrics.hitRatioPercent,
      hits: db.cacheMetrics.hits,
      misses: db.cacheMetrics.misses
    };
  }

  public destroy(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    this.cache.clear();
  }
}

export const marketDataCache = new MarketDataCache();
