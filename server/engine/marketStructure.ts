import { Candle, MarketStructure, RetestZone, SupportResistanceLevel, SwingPoint, Timeframe } from '../../src/types';

export class MarketStructureEngine {
  constructor(public defaultLookback: number = 5) {}

  public detectSwingPoints(candles: Candle[], lookback: number = this.defaultLookback): { highs: SwingPoint[]; lows: SwingPoint[] } {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];
    if (!candles || candles.length < lookback * 2 + 1) {
      return { highs, lows };
    }

    for (let i = lookback; i < candles.length - lookback; i++) {
      const current = candles[i];
      let isHigh = true;
      let isLow = true;

      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        if (candles[j].high >= current.high) isHigh = false;
        if (candles[j].low <= current.low) isLow = false;
      }

      if (isHigh) {
        highs.push({ index: i, price: current.high, time: current.time, type: 'high' });
      }
      if (isLow) {
        lows.push({ index: i, price: current.low, time: current.time, type: 'low' });
      }
    }

    return { highs, lows };
  }

  public analyze(candles: Candle[], timeframe: Timeframe = '1h', lookback: number = this.defaultLookback): MarketStructure {
    if (!candles || candles.length < 15) {
      const fallbackPrice = candles?.[candles.length - 1]?.close || 100;
      return {
        timeframe,
        lookback,
        state: 'Range-Bound / Consolidation',
        lastSwingHigh: Math.round(fallbackPrice * 1.03 * 100) / 100,
        lastSwingLow: Math.round(fallbackPrice * 0.97 * 100) / 100,
        swingHighs: [],
        swingLows: [],
        nearestSupport: {
          price: Math.round(fallbackPrice * 0.97 * 100) / 100,
          type: 'support',
          distancePercent: -3.0,
          touches: 1,
          label: 'Baseline Support'
        },
        nearestResistance: {
          price: Math.round(fallbackPrice * 1.03 * 100) / 100,
          type: 'resistance',
          distancePercent: 3.0,
          touches: 1,
          label: 'Baseline Resistance'
        },
        supportLevels: [Math.round(fallbackPrice * 0.97 * 100) / 100],
        resistanceLevels: [Math.round(fallbackPrice * 1.03 * 100) / 100],
        event: 'Consolidating',
        retestZone: null,
        volumeConfirmed: false,
        description: 'Historical candles building initial swing pivot baseline.'
      };
    }

    const { highs, lows } = this.detectSwingPoints(candles, lookback);
    const currentPrice = candles[candles.length - 1].close;

    // Calculate volume baseline (20-period average)
    const recentCandles = candles.slice(-20);
    const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / Math.max(1, recentCandles.length);
    const currentVolume = candles[candles.length - 1].volume;
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    const volumeConfirmed = volumeRatio >= 1.25;

    const recentHighs = highs.slice(-4);
    const recentLows = lows.slice(-4);

    const lastHigh = recentHighs[recentHighs.length - 1]?.price || currentPrice * 1.03;
    const prevHigh = recentHighs[recentHighs.length - 2]?.price || lastHigh;

    const lastLow = recentLows[recentLows.length - 1]?.price || currentPrice * 0.97;
    const prevLow = recentLows[recentLows.length - 2]?.price || lastLow;

    // Cluster support & resistance levels
    const rawSupports = lows.slice(-6).map(l => l.price);
    const rawResistances = highs.slice(-6).map(h => h.price);

    const supportLevels = Array.from(new Set(rawSupports.map(p => Math.round(p * 100) / 100)))
      .filter(p => p < currentPrice)
      .sort((a, b) => b - a)
      .slice(0, 4);

    const resistanceLevels = Array.from(new Set(rawResistances.map(p => Math.round(p * 100) / 100)))
      .filter(p => p > currentPrice)
      .sort((a, b) => a - b)
      .slice(0, 4);

    if (supportLevels.length === 0) supportLevels.push(Math.round(lastLow * 100) / 100);
    if (resistanceLevels.length === 0) resistanceLevels.push(Math.round(lastHigh * 100) / 100);

    const nearestSuppPrice = supportLevels[0];
    const nearestResPrice = resistanceLevels[0];

    const nearestSupport: SupportResistanceLevel = {
      price: nearestSuppPrice,
      type: 'support',
      distancePercent: Math.round(((nearestSuppPrice - currentPrice) / currentPrice) * 1000) / 10,
      touches: lows.filter(l => Math.abs(l.price - nearestSuppPrice) / nearestSuppPrice < 0.015).length || 1,
      label: 'Nearest Support'
    };

    const nearestResistance: SupportResistanceLevel = {
      price: nearestResPrice,
      type: 'resistance',
      distancePercent: Math.round(((nearestResPrice - currentPrice) / currentPrice) * 1000) / 10,
      touches: highs.filter(h => Math.abs(h.price - nearestResPrice) / nearestResPrice < 0.015).length || 1,
      label: 'Nearest Resistance'
    };

    const isHH = lastHigh > prevHigh * 1.002;
    const isHL = lastLow > prevLow * 1.002;
    const isLH = lastHigh < prevHigh * 0.998;
    const isLL = lastLow < prevLow * 0.998;

    let state: MarketStructure['state'] = 'Range-Bound / Consolidation';
    let event: MarketStructure['event'] = 'Consolidating';
    let retestZone: RetestZone | null = null;
    let description = '';

    // Breakout / Breakdown / Retest detection
    const isBreakout = currentPrice > lastHigh || (resistanceLevels[0] && currentPrice > resistanceLevels[0] * 1.002);
    const isBreakdown = currentPrice < lastLow || (supportLevels[0] && currentPrice < supportLevels[0] * 0.998);

    // Retest detection: price within 0.4% - 1.5% of recently breached level
    const distToLastHigh = Math.abs(currentPrice - lastHigh) / lastHigh;
    const distToLastLow = Math.abs(currentPrice - lastLow) / lastLow;

    if (isBreakout) {
      state = 'Higher High (HH)';
      event = 'Potential Breakout';
      description = `Potential breakout detected: Current price ($${currentPrice.toLocaleString()}) exceeded swing high/resistance ($${lastHigh.toLocaleString()})${volumeConfirmed ? ' with confirmed volume expansion' : ', awaiting volume confirmation'}.`;
    } else if (isBreakdown) {
      state = 'Lower Low (LL)';
      event = 'Potential Breakdown';
      description = `Potential breakdown detected: Current price ($${currentPrice.toLocaleString()}) slipped below swing low/support ($${lastLow.toLocaleString()})${volumeConfirmed ? ' with confirmed selling volume' : ', monitoring support stabilization'}.`;
    } else if (currentPrice > lastHigh * 0.995 && currentPrice <= lastHigh * 1.018 && distToLastHigh < 0.018) {
      state = isHH ? 'Higher High (HH)' : 'Range-Bound / Consolidation';
      event = 'Potential Retest Zone';
      retestZone = {
        min: Math.round(lastHigh * 0.992 * 100) / 100,
        max: Math.round(lastHigh * 1.008 * 100) / 100,
        brokenLevel: Math.round(lastHigh * 100) / 100,
        type: 'support',
        description: `Potential Retest Zone: Testing breakout level at $${lastHigh.toLocaleString()} as new potential support.`
      };
      description = retestZone.description;
    } else if (currentPrice < lastLow * 1.005 && currentPrice >= lastLow * 0.982 && distToLastLow < 0.018) {
      state = isLL ? 'Lower Low (LL)' : 'Range-Bound / Consolidation';
      event = 'Potential Retest Zone';
      retestZone = {
        min: Math.round(lastLow * 0.992 * 100) / 100,
        max: Math.round(lastLow * 1.008 * 100) / 100,
        brokenLevel: Math.round(lastLow * 100) / 100,
        type: 'resistance',
        description: `Potential Retest Zone: Testing breakdown level at $${lastLow.toLocaleString()} as resistance.`
      };
      description = retestZone.description;
    } else if (isHH && isHL) {
      state = 'Higher High (HH)';
      event = distToLastLow < 0.015 ? 'Support Retest' : 'Consolidating';
      description = `Bullish market structure confirmed with Higher Highs and Higher Lows. Immediate support buffered at $${lastLow.toLocaleString()}.`;
    } else if (isLH && isLL) {
      state = 'Lower Low (LL)';
      event = distToLastHigh < 0.015 ? 'Resistance Retest' : 'Consolidating';
      description = `Bearish market structure confirmed with Lower Highs and Lower Lows. Resistance ceiling at $${lastHigh.toLocaleString()}.`;
    } else if (isHL) {
      state = 'Higher Low (HL)';
      event = 'Consolidating';
      description = `Higher Low established at $${lastLow.toLocaleString()}. Buyers stepping in at elevated levels.`;
    } else if (isLH) {
      state = 'Lower High (LH)';
      event = 'Consolidating';
      description = `Lower High formed at $${lastHigh.toLocaleString()}. Sellers resisting upward continuation.`;
    } else {
      state = 'Range-Bound / Consolidation';
      event = 'Consolidating';
      description = `Consolidating in range between support ($${nearestSuppPrice.toLocaleString()}) and resistance ($${nearestResPrice.toLocaleString()}).`;
    }

    return {
      timeframe,
      lookback,
      state,
      lastSwingHigh: Math.round(lastHigh * 100) / 100,
      lastSwingLow: Math.round(lastLow * 100) / 100,
      swingHighs: highs.slice(-5),
      swingLows: lows.slice(-5),
      nearestSupport,
      nearestResistance,
      supportLevels,
      resistanceLevels,
      event,
      retestZone,
      volumeConfirmed,
      description
    };
  }
}

export const marketStructureEngine = new MarketStructureEngine(5);

export function analyzeMarketStructure(candles: Candle[], timeframe: Timeframe = '1h', lookback: number = 5): MarketStructure {
  return marketStructureEngine.analyze(candles, timeframe, lookback);
}

export function detectSwingPoints(candles: Candle[], lookback: number = 5): { highs: SwingPoint[]; lows: SwingPoint[] } {
  return marketStructureEngine.detectSwingPoints(candles, lookback);
}

