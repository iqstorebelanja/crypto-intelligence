import { Candle, ExchangeId, Timeframe } from '../../src/types';
import { NormalizedEngineCandle, CandleState } from '../types/marketDataEngine';
import { pipelineLogger } from '../services/pipelineLogger';

export class DataValidator {
  /**
   * Expected duration for a standard timeframe candle in ms.
   */
  public static getTimeframeDurationMs(timeframe: Timeframe): number {
    switch (timeframe) {
      case '5m':
        return 5 * 60 * 1000;
      case '15m':
        return 15 * 60 * 1000;
      case '1h':
        return 60 * 60 * 1000;
      case '4h':
        return 4 * 60 * 60 * 1000;
      case '1D':
        return 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000;
    }
  }

  /**
   * Validates a single price.
   */
  public static isValidPrice(price: any): boolean {
    return typeof price === 'number' && Number.isFinite(price) && price > 0;
  }

  /**
   * Validates a single volume.
   */
  public static isValidVolume(volume: any): boolean {
    return typeof volume === 'number' && Number.isFinite(volume) && volume >= 0;
  }

  /**
   * Validates, cleans, deduplicates, and chronologically sorts candles.
   * Identifies FORMING vs CONFIRMED bars.
   */
  public static validateAndNormalizeCandles(
    rawCandles: Candle[],
    exchange: ExchangeId,
    market: string,
    timeframe: Timeframe
  ): NormalizedEngineCandle[] {
    if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
      return [];
    }

    const now = Date.now();
    const durationMs = this.getTimeframeDurationMs(timeframe);
    const seenOpenTimes = new Set<number>();
    const validCandles: NormalizedEngineCandle[] = [];

    // 1. Filter and sanitize
    for (const c of rawCandles) {
      if (!c || typeof c.time !== 'number' || isNaN(c.time)) {
        continue;
      }

      // Reject future timestamps (> now + 2 minutes clock skew)
      if (c.time > now + 120000) {
        pipelineLogger.log(exchange, 'validateAndNormalizeCandles', `Rejected future candle timestamp ${c.time}`, {
          market,
          errorCode: 'INVALID_CANDLE'
        });
        continue;
      }

      // Reject negative or non-finite numbers
      if (
        !this.isValidPrice(c.open) ||
        !this.isValidPrice(c.high) ||
        !this.isValidPrice(c.low) ||
        !this.isValidPrice(c.close) ||
        !this.isValidVolume(c.volume)
      ) {
        pipelineLogger.log(exchange, 'validateAndNormalizeCandles', `Rejected non-numeric OHLC values in candle at ${c.time}`, {
          market,
          errorCode: 'INVALID_CANDLE'
        });
        continue;
      }

      // OHLC sanity bounds: high must be >= max(open, close, low), low must be <= min(open, close, high)
      const maxOCL = Math.max(c.open, c.close, c.low);
      const minOCH = Math.min(c.open, c.close, c.high);

      const high = Math.max(c.high, maxOCL);
      const low = Math.min(c.low, minOCH);

      // Deduplication using openTime
      if (seenOpenTimes.has(c.time)) {
        continue;
      }
      seenOpenTimes.add(c.time);

      const openTime = c.time;
      const closeTime = openTime + durationMs;
      // If candle close time is beyond current time, it is still forming
      const isClosed = closeTime <= now;
      const candleState: CandleState = isClosed ? 'CONFIRMED' : 'FORMING';

      validCandles.push({
        openTime,
        closeTime,
        open: c.open,
        high,
        low,
        close: c.close,
        volume: c.volume,
        isClosed,
        candleState,
        exchange,
        market,
        timeframe
      });
    }

    // 2. Sort chronologically (oldest to newest)
    validCandles.sort((a, b) => a.openTime - b.openTime);

    // 3. Detect abnormal candle gaps (> 3 missing intervals)
    for (let i = 1; i < validCandles.length; i++) {
      const diff = validCandles[i].openTime - validCandles[i - 1].openTime;
      if (diff > durationMs * 3.5) {
        const missingBars = Math.round(diff / durationMs) - 1;
        pipelineLogger.log(exchange, 'validateAndNormalizeCandles', `Detected gap of ~${missingBars} bars between ${validCandles[i - 1].openTime} and ${validCandles[i].openTime}`, {
          market
        });
      }
    }

    return validCandles;
  }

  /**
   * Filters to strictly CONFIRMED (closed) candles for indicator calculation.
   * If there's an ongoing forming candle, it's separated to ensure no lookahead bias.
   */
  public static extractConfirmedCandles(candles: NormalizedEngineCandle[]): Candle[] {
    return candles
      .filter(c => c.isClosed || c.candleState === 'CONFIRMED')
      .map(c => ({
        time: c.openTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      }));
  }
}
