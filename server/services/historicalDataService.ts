import { Candle, ExchangeId, HistoricalPeriod, Timeframe } from '../../src/types';

export interface HistoricalCandleData {
  candles: Candle[];
  symbol: string;
  exchange: ExchangeId;
  timeframe: Timeframe;
  period: HistoricalPeriod;
  startTime: number;
  endTime: number;
  derivativesHistorical: Map<number, { openInterest: number | null; fundingRate: number | null }> | null;
}

export class HistoricalDataService {
  private cache: Map<string, { data: HistoricalCandleData; timestamp: number }> = new Map();
  private cacheTtlMs = 600000; // 10 minutes cache for historical runs

  /**
   * Convert Period string to milliseconds
   */
  public getPeriodMs(period: HistoricalPeriod): number {
    switch (period) {
      case '7d': return 7 * 86400000;
      case '30d': return 30 * 86400000;
      case '90d': return 90 * 86400000;
      case '180d': return 180 * 86400000;
      case '365d': return 365 * 86400000;
      default: return 30 * 86400000;
    }
  }

  /**
   * Convert timeframe to interval duration in ms
   */
  public getTimeframeMs(timeframe: Timeframe): number {
    switch (timeframe) {
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '4h': return 4 * 60 * 60 * 1000;
      case '1D': return 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  /**
   * Map internal timeframe to exchange interval strings
   */
  private getBinanceInterval(timeframe: Timeframe): string {
    switch (timeframe) {
      case '5m': return '5m';
      case '15m': return '15m';
      case '1h': return '1h';
      case '4h': return '4h';
      case '1D': return '1d';
      default: return '1h';
    }
  }

  private getBybitInterval(timeframe: Timeframe): string {
    switch (timeframe) {
      case '5m': return '5';
      case '15m': return '15';
      case '1h': return '60';
      case '4h': return '240';
      case '1D': return 'D';
      default: return '60';
    }
  }

  /**
   * Primary entry point: Retrieve historical OHLCV data
   */
  public async getHistoricalData(
    symbol: string,
    exchange: ExchangeId = 'BINANCE',
    timeframe: Timeframe = '1h',
    period: HistoricalPeriod = '30d'
  ): Promise<HistoricalCandleData> {
    const cleanRaw = symbol.replace(/[\/\-_]/g, '').toUpperCase();
    const cacheKey = `${exchange}_${cleanRaw}_${timeframe}_${period}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    const now = Date.now();
    const periodMs = this.getPeriodMs(period);
    const targetStartTime = now - periodMs;
    const tfMs = this.getTimeframeMs(timeframe);

    // Approximate expected candle count with 15% grace threshold for exchange maintenance/holidays
    const expectedCount = Math.floor(periodMs / tfMs);
    const minRequiredCount = Math.max(30, Math.floor(expectedCount * 0.75));

    let candles: Candle[] = [];
    let derivativesMap: Map<number, { openInterest: number | null; fundingRate: number | null }> | null = null;

    if (exchange === 'BYBIT') {
      candles = await this.fetchBybitHistorical(cleanRaw, timeframe, targetStartTime, now);
    } else {
      // Default: Binance
      candles = await this.fetchBinanceHistorical(cleanRaw, timeframe, targetStartTime, now);
      // Attempt to retrieve real historical derivatives if available for futures pairs
      derivativesMap = await this.fetchBinanceHistoricalDerivatives(cleanRaw, targetStartTime, now);
    }

    // Check if sufficient historical data was actually returned
    if (!candles || candles.length < 30) {
      throw new Error('Historical data unavailable for the selected period.');
    }

    // Verify that earliest candle is reasonably close to targetStartTime
    // (If the earliest candle is much newer, the pair was not listed or data is truncated)
    const earliestTime = candles[0].time;
    const allowableGap = Math.max(tfMs * 5, 86400000 * 2); // 2 days or 5 candles
    if (earliestTime - targetStartTime > allowableGap && candles.length < minRequiredCount) {
      throw new Error('Historical data unavailable for the selected period.');
    }

    const result: HistoricalCandleData = {
      candles,
      symbol: cleanRaw,
      exchange,
      timeframe,
      period,
      startTime: earliestTime,
      endTime: candles[candles.length - 1].time,
      derivativesHistorical: derivativesMap
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  /**
   * Fetch historical klines from Binance API with pagination
   */
  private async fetchBinanceHistorical(
    symbol: string,
    timeframe: Timeframe,
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    const interval = this.getBinanceInterval(timeframe);
    const allCandles: Candle[] = [];
    let currentStart = startTime;
    const maxIterations = 8; // Max 8 batches of 1000 = 8000 candles
    let iteration = 0;

    try {
      while (currentStart < endTime && iteration < maxIterations) {
        iteration++;
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStart}&endTime=${endTime}&limit=1000`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

        if (!res.ok) {
          // If spot fails, try futures endpoint
          const fUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStart}&endTime=${endTime}&limit=1000`;
          const fRes = await fetch(fUrl, { signal: AbortSignal.timeout(5000) });
          if (!fRes.ok) break;

          const fJson = (await fRes.json()) as any[];
          if (!Array.isArray(fJson) || fJson.length === 0) break;

          for (const k of fJson) {
            allCandles.push({
              time: k[0],
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5])
            });
          }

          if (fJson.length < 1000) break;
          currentStart = fJson[fJson.length - 1][0] + 1;
          continue;
        }

        const json = (await res.json()) as any[];
        if (!Array.isArray(json) || json.length === 0) break;

        for (const k of json) {
          allCandles.push({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
          });
        }

        if (json.length < 1000) break;
        currentStart = json[json.length - 1][0] + 1;
      }
    } catch {
      // Network failure or rate limit
    }

    // Deduplicate by timestamp and sort chronologically
    const seen = new Set<number>();
    const unique: Candle[] = [];
    for (const c of allCandles) {
      if (!seen.has(c.time)) {
        seen.add(c.time);
        unique.push(c);
      }
    }
    unique.sort((a, b) => a.time - b.time);

    return unique;
  }

  /**
   * Fetch historical klines from Bybit API with pagination
   */
  private async fetchBybitHistorical(
    symbol: string,
    timeframe: Timeframe,
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    const interval = this.getBybitInterval(timeframe);
    const allCandles: Candle[] = [];
    let currentStart = startTime;
    let iteration = 0;
    const maxIterations = 8;

    try {
      while (currentStart < endTime && iteration < maxIterations) {
        iteration++;
        const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&start=${currentStart}&end=${endTime}&limit=1000`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

        if (!res.ok) break;
        const json = (await res.json()) as any;
        const list = json?.result?.list as any[];
        if (!list || !Array.isArray(list) || list.length === 0) break;

        // Bybit returns newest first, reverse each page
        const pageCandles: Candle[] = list.slice().reverse().map(k => ({
          time: parseInt(k[0]),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5])
        }));

        allCandles.push(...pageCandles);

        if (pageCandles.length < 1000) break;
        currentStart = pageCandles[pageCandles.length - 1].time + 1;
      }
    } catch {
      // Fail safely
    }

    const seen = new Set<number>();
    const unique: Candle[] = [];
    for (const c of allCandles) {
      if (!seen.has(c.time)) {
        seen.add(c.time);
        unique.push(c);
      }
    }
    unique.sort((a, b) => a.time - b.time);

    return unique;
  }

  /**
   * Retrieve genuine Binance historical derivatives (Open Interest & Funding Rate)
   * If unavailable, returns null (do not fabricate).
   */
  private async fetchBinanceHistoricalDerivatives(
    symbol: string,
    startTime: number,
    endTime: number
  ): Promise<Map<number, { openInterest: number | null; fundingRate: number | null }> | null> {
    try {
      const map = new Map<number, { openInterest: number | null; fundingRate: number | null }>();

      // Funding rate history (max 1000 entries)
      const frRes = await fetch(
        `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&startTime=${startTime}&endTime=${endTime}&limit=1000`,
        { signal: AbortSignal.timeout(3500) }
      );

      if (frRes.ok) {
        const frData = (await frRes.json()) as any[];
        if (Array.isArray(frData)) {
          for (const item of frData) {
            const time = parseInt(item.fundingTime);
            const rate = parseFloat(item.fundingRate);
            map.set(time, { openInterest: null, fundingRate: rate });
          }
        }
      }

      // Open interest stats history (supports up to 30 days)
      const oiRes = await fetch(
        `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=500`,
        { signal: AbortSignal.timeout(3500) }
      );

      if (oiRes.ok) {
        const oiData = (await oiRes.json()) as any[];
        if (Array.isArray(oiData)) {
          for (const item of oiData) {
            const time = parseInt(item.timestamp);
            const oiUsd = parseFloat(item.sumOpenInterestValue);
            const existing = map.get(time) || { openInterest: null, fundingRate: null };
            existing.openInterest = oiUsd;
            map.set(time, existing);
          }
        }
      }

      return map.size > 0 ? map : null;
    } catch {
      return null;
    }
  }

  /**
   * Helper to clear cached historical records
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

export const historicalDataService = new HistoricalDataService();
