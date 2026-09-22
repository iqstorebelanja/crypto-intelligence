import { Candle, TechnicalIndicators } from '../../src/types';

export function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

export function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calculateBollingerBands(closes: number[], period: number = 20, multiplier: number = 2): {
  upper: number;
  middle: number;
  lower: number;
  width: number;
  percentB: number;
} {
  const currentPrice = closes[closes.length - 1] || 0;
  if (closes.length < period) {
    return {
      upper: currentPrice * 1.05,
      middle: currentPrice,
      lower: currentPrice * 0.95,
      width: 0.1,
      percentB: 0.5
    };
  }

  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + (stdDev * multiplier);
  const lower = middle - (stdDev * multiplier);
  const width = middle > 0 ? (upper - lower) / middle : 0;
  const bandRange = upper - lower;
  const percentB = bandRange > 0 ? (currentPrice - lower) / bandRange : 0.5;

  return { upper, middle, lower, width, percentB };
}

export function computeTechnicalIndicators(candles: Candle[]): TechnicalIndicators {
  if (!candles || candles.length === 0) {
    return {
      rsi6: 50,
      rsi14: 50,
      ma20: 0,
      ma50: 0,
      ma200: 0,
      priceVsMa20: 'above',
      priceVsMa50: 'above',
      priceVsMa200: 'above',
      maTrend: 'Neutral',
      maCross: 'neutral',
      bb: { upper: 0, middle: 0, lower: 0, width: 0, percentB: 0.5 },
      volumeAnalysis: { current: 0, average20: 0, ratio: 1, isSpike: false }
    };
  }

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const currentPrice = closes[closes.length - 1];

  const rsi6 = calculateRSI(closes, 6);
  const rsi14 = calculateRSI(closes, 14);

  const ma20 = calculateSMA(closes, 20);
  const ma50 = calculateSMA(closes, 50);
  const ma200 = calculateSMA(closes, 200);

  const priceVsMa20 = currentPrice >= ma20 ? 'above' : 'below';
  const priceVsMa50 = currentPrice >= ma50 ? 'above' : 'below';
  const priceVsMa200 = currentPrice >= ma200 ? 'above' : 'below';

  let maTrend: TechnicalIndicators['maTrend'] = 'Neutral';
  let maCross: TechnicalIndicators['maCross'] = 'neutral';

  if (ma20 > ma50 && ma50 > ma200 && priceVsMa20 === 'above') {
    maTrend = 'Strong Bullish';
    maCross = 'bullish_alignment';
  } else if (ma20 > ma50 && priceVsMa20 === 'above') {
    maTrend = 'Bullish';
  } else if (ma20 < ma50 && ma50 < ma200 && priceVsMa20 === 'below') {
    maTrend = 'Strong Bearish';
    maCross = 'bearish_alignment';
  } else if (ma20 < ma50 && priceVsMa20 === 'below') {
    maTrend = 'Bearish';
  }

  if (ma50 > ma200 && closes.length >= 50 && maCross === 'neutral') {
    maCross = 'golden_cross';
  } else if (ma50 < ma200 && closes.length >= 50 && maCross === 'neutral') {
    maCross = 'death_cross';
  }

  const bb = calculateBollingerBands(closes, 20, 2);

  // Volume analysis
  const currentVolume = volumes[volumes.length - 1] || 0;
  const recentVolumes = volumes.slice(-20);
  const average20 = recentVolumes.reduce((acc, v) => acc + v, 0) / Math.max(1, recentVolumes.length);
  const ratio = average20 > 0 ? currentVolume / average20 : 1;
  const isSpike = ratio >= 1.8;

  return {
    rsi6: Math.round(rsi6 * 10) / 10,
    rsi14: Math.round(rsi14 * 10) / 10,
    ma20,
    ma50,
    ma200,
    priceVsMa20,
    priceVsMa50,
    priceVsMa200,
    maTrend,
    maCross,
    bb,
    volumeAnalysis: {
      current: currentVolume,
      average20,
      ratio: Math.round(ratio * 100) / 100,
      isSpike
    }
  };
}
