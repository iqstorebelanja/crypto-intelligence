import { Candle, ForwardOutcome, StatisticalSummary, ValidationHorizon } from '../../src/types';

export class OutcomeEngine {
  /**
   * Horizon duration in milliseconds
   */
  public static readonly HORIZON_MS: Record<ValidationHorizon, number> = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };

  /**
   * Measure forward outcome for a single signal at candle index `signalIndex`
   */
  public measureOutcome(
    candles: Candle[],
    signalIndex: number,
    horizon: ValidationHorizon
  ): ForwardOutcome | null {
    if (!candles || signalIndex < 0 || signalIndex >= candles.length - 1) {
      return null;
    }

    const signalCandle = candles[signalIndex];
    const signalPrice = signalCandle.close;
    if (signalPrice <= 0) return null;

    const signalTime = signalCandle.time;
    const targetTime = signalTime + OutcomeEngine.HORIZON_MS[horizon];

    // Find the candle corresponding to or closest after targetTime
    let targetIndex = -1;
    for (let i = signalIndex + 1; i < candles.length; i++) {
      if (candles[i].time >= targetTime) {
        targetIndex = i;
        break;
      }
    }

    // If future data does not reach this horizon, outcome is not yet complete
    if (targetIndex === -1) {
      return null;
    }

    const futureCandle = candles[targetIndex];
    const futurePrice = futureCandle.close;
    const absoluteReturn = futurePrice - signalPrice;
    const percentageReturn = ((futurePrice - signalPrice) / signalPrice) * 100;

    // Calculate MFE and MAE within the window [signalIndex + 1, targetIndex]
    let maxHigh = signalPrice;
    let minLow = signalPrice;

    for (let i = signalIndex + 1; i <= targetIndex; i++) {
      if (candles[i].high > maxHigh) maxHigh = candles[i].high;
      if (candles[i].low < minLow) minLow = candles[i].low;
    }

    const mfe = ((maxHigh - signalPrice) / signalPrice) * 100;
    const mae = ((minLow - signalPrice) / signalPrice) * 100; // Will be <= 0

    return {
      horizon,
      futureTimestamp: futureCandle.time,
      futurePrice: Math.round(futurePrice * 10000) / 10000,
      absoluteReturn: Math.round(absoluteReturn * 10000) / 10000,
      percentageReturn: Math.round(percentageReturn * 100) / 100,
      mfe: Math.round(mfe * 100) / 100,
      mae: Math.round(mae * 100) / 100
    };
  }

  /**
   * Measure all standard horizons for a given signal index
   */
  public measureAllHorizons(
    candles: Candle[],
    signalIndex: number
  ): Record<ValidationHorizon, ForwardOutcome | null> {
    const horizons: ValidationHorizon[] = ['15m', '1h', '4h', '12h', '24h', '3d', '7d'];
    const record: Record<ValidationHorizon, ForwardOutcome | null> = {
      '15m': null,
      '1h': null,
      '4h': null,
      '12h': null,
      '24h': null,
      '3d': null,
      '7d': null
    };

    for (const h of horizons) {
      record[h] = this.measureOutcome(candles, signalIndex, h);
    }

    return record;
  }

  /**
   * Calculate comprehensive statistical summary for an array of forward returns
   */
  public calculateStatistics(
    returns: number[],
    mfes: number[] = [],
    maes: number[] = []
  ): StatisticalSummary {
    const n = returns.length;

    if (n === 0) {
      return {
        sampleSize: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        positiveOutcomePercent: 0,
        negativeOutcomePercent: 0,
        neutralOutcomePercent: 0,
        p25: 0,
        p75: 0,
        averageMfe: 0,
        averageMae: 0,
        confidenceInterval95Mean: null,
        confidenceInterval95Proportion: null,
        isSmallSample: true
      };
    }

    // Sort returns for median and percentiles
    const sorted = [...returns].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;

    // Median
    const mid = Math.floor(n / 2);
    const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Percentiles (25th and 75th)
    const p25Index = Math.floor(n * 0.25);
    const p75Index = Math.min(n - 1, Math.floor(n * 0.75));
    const p25 = sorted[p25Index];
    const p75 = sorted[p75Index];

    // Standard deviation (sample std dev if n > 1)
    const variance = n > 1
      ? sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1)
      : 0;
    const stdDev = Math.sqrt(variance);

    const min = sorted[0];
    const max = sorted[n - 1];

    // Outcome counts
    const positiveCount = sorted.filter(r => r > 0).length;
    const negativeCount = sorted.filter(r => r < 0).length;
    const neutralCount = sorted.filter(r => r === 0).length;

    const positivePercent = (positiveCount / n) * 100;
    const negativePercent = (negativeCount / n) * 100;
    const neutralPercent = (neutralCount / n) * 100;

    // Average MFE and MAE
    const avgMfe = mfes.length > 0 ? mfes.reduce((a, b) => a + b, 0) / mfes.length : 0;
    const avgMae = maes.length > 0 ? maes.reduce((a, b) => a + b, 0) / maes.length : 0;

    // 95% Confidence interval for Mean
    let ciMean: [number, number] | null = null;
    if (n >= 10 && stdDev > 0) {
      const z = 1.96;
      const marginOfError = z * (stdDev / Math.sqrt(n));
      ciMean = [
        Math.round((mean - marginOfError) * 100) / 100,
        Math.round((mean + marginOfError) * 100) / 100
      ];
    }

    // 95% Confidence interval for Positive Outcome Proportion (Wilson score interval)
    let ciProp: [number, number] | null = null;
    if (n >= 10) {
      const z = 1.96;
      const p = positiveCount / n;
      const denom = 1 + (z * z) / n;
      const center = p + (z * z) / (2 * n);
      const rad = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
      const lower = Math.max(0, (center - rad) / denom);
      const upper = Math.min(1, (center + rad) / denom);
      ciProp = [
        Math.round(lower * 1000) / 10,
        Math.round(upper * 1000) / 10
      ];
    }

    return {
      sampleSize: n,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      positiveOutcomePercent: Math.round(positivePercent * 10) / 10,
      negativeOutcomePercent: Math.round(negativePercent * 10) / 10,
      neutralOutcomePercent: Math.round(neutralPercent * 10) / 10,
      p25: Math.round(p25 * 100) / 100,
      p75: Math.round(p75 * 100) / 100,
      averageMfe: Math.round(avgMfe * 100) / 100,
      averageMae: Math.round(avgMae * 100) / 100,
      confidenceInterval95Mean: ciMean,
      confidenceInterval95Proportion: ciProp,
      isSmallSample: n < 30
    };
  }
}

export const outcomeEngine = new OutcomeEngine();
