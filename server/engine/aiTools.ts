import { onChainProviderManager } from '../adapters/onChainProvider';
import { marketDataService } from '../services/marketDataService';
import { assetRegistryService } from '../services/assetRegistryService';
import { marketQueryParser } from './marketQueryParser';
import {
  ExchangeId,
  NormalizedCoinData,
  Timeframe,
  WhaleActivitySummary
} from '../../src/types';

export class AIToolLayer {
  private async resolveCoin(symbol: string, requestedExchange?: ExchangeId, timeframe: Timeframe = '1h') {
    let exchange = requestedExchange || 'BINANCE';
    let detail = await marketDataService.getCoinDetail(symbol, timeframe, exchange);

    if (!detail.coin) {
      const baseAsset = symbol.replace(/[\/\-_]/g, '').replace('USDT', '').toUpperCase();
      const markets = assetRegistryService.getMarketsForAsset(baseAsset);
      if (markets.length > 0) {
        exchange = markets[0].exchange;
        detail = await marketDataService.getCoinDetail(symbol, timeframe, exchange);
      }
    }

    return { detail, exchange };
  }

  /**
   * Tool 1: getMarketData
   */
  public async getMarketData(params: {
    symbol: string;
    exchange?: ExchangeId;
    marketType?: 'SPOT' | 'FUTURES';
    timeframe?: Timeframe;
  }) {
    const timeframe = params.timeframe || '1h';
    const { detail, exchange } = await this.resolveCoin(params.symbol, params.exchange, timeframe);

    if (!detail.coin) {
      throw new Error(`Market data for ${params.symbol} is currently unavailable on ${exchange}.`);
    }

    const c = detail.coin;
    return {
      symbol: c.symbol,
      exchange: c.exchange,
      marketType: c.marketType,
      price: c.price,
      change24h: c.change24h,
      high24h: c.high24h,
      low24h: c.low24h,
      volume: c.volume24h,
      quoteVolume: c.quoteVolume24h,
      timestamp: c.timestamp,
      dataFreshness: c.freshnessSeconds <= 45 ? 'LIVE' : 'DATA DELAYED',
      freshnessSeconds: c.freshnessSeconds
    };
  }

  /**
   * Tool 2: getTechnicalIndicators
   */
  public async getTechnicalIndicators(params: {
    symbol: string;
    exchange?: ExchangeId;
    timeframe?: Timeframe;
  }) {
    const timeframe = params.timeframe || '1h';
    const { detail, exchange } = await this.resolveCoin(params.symbol, params.exchange, timeframe);

    if (!detail.coin || !detail.coin.indicators) {
      throw new Error(`Technical indicators unavailable for ${params.symbol} on ${exchange}.`);
    }

    const ind = detail.coin.indicators;
    return {
      symbol: detail.coin.symbol,
      exchange: detail.coin.exchange,
      timeframe,
      rsi6: ind.rsi6,
      rsi14: ind.rsi14,
      ma20: ind.ma20,
      ma50: ind.ma50,
      ma200: ind.ma200,
      priceVsMA20: ind.priceVsMa20,
      priceVsMA50: ind.priceVsMa50,
      priceVsMA200: ind.priceVsMa200,
      maTrend: ind.maTrend,
      maCross: ind.maCross,
      bollingerUpper: ind.bb.upper,
      bollingerMiddle: ind.bb.middle,
      bollingerLower: ind.bb.lower,
      bollingerWidth: ind.bb.width,
      bollingerPosition: ind.bb.percentB > 0.8 ? 'Near Upper Band' : ind.bb.percentB < 0.2 ? 'Near Lower Band' : 'Near Middle Band',
      percentB: ind.bb.percentB,
      volume: ind.volumeAnalysis.current,
      averageVolume: ind.volumeAnalysis.average20,
      volumeRatio: ind.volumeAnalysis.ratio,
      volumeStatus: ind.volumeAnalysis.isSpike ? 'Volume Spike' : ind.volumeAnalysis.ratio > 1.2 ? 'Expanding' : 'Normal'
    };
  }

  /**
   * Tool 3: getDerivatives
   */
  public async getDerivatives(params: {
    symbol: string;
    exchange?: ExchangeId;
  }) {
    const { detail, exchange } = await this.resolveCoin(params.symbol, params.exchange, '1h');

    if (!detail.coin || !detail.coin.derivatives) {
      return {
        available: false,
        symbol: params.symbol,
        exchange,
        openInterest: null,
        openInterestChange: null,
        fundingRate: null,
        longShortRatio: null,
        longPercentage: null,
        shortPercentage: null,
        longLiquidations: null,
        shortLiquidations: null,
        totalLiquidations: null,
        reason: `${exchange} spot feed does not provide perpetual derivatives metrics (OI, Funding, Liquidations). Display as N/A.`
      };
    }

    const d = detail.coin.derivatives;
    return {
      available: true,
      symbol: d.symbol,
      exchange: d.exchange,
      timestamp: d.timestamp,
      source: d.source,
      openInterest: d.openInterest,
      openInterestChange: d.openInterestChange24h,
      fundingRate: d.fundingRate,
      fundingIntervalHours: 8,
      nextFundingTime: d.nextFundingTime,
      predictedFundingRate: null,
      longShortRatio: d.longShortRatio?.ratio ?? null,
      longPercentage: d.longShortRatio?.longRatio ?? null,
      shortPercentage: d.longShortRatio?.shortRatio ?? null,
      longLiquidations: d.liquidations?.long24h ?? null,
      shortLiquidations: d.liquidations?.short24h ?? null,
      totalLiquidations: d.liquidations?.total24h ?? null
    };
  }

  /**
   * Tool 4: getMarketStructure
   */
  public async getMarketStructure(params: {
    symbol: string;
    exchange?: ExchangeId;
    timeframe?: Timeframe;
  }) {
    const timeframe = params.timeframe || '1h';
    const { detail, exchange } = await this.resolveCoin(params.symbol, params.exchange, timeframe);

    if (!detail.coin || !detail.coin.marketStructure) {
      throw new Error(`Market structure unavailable for ${params.symbol} on ${exchange}.`);
    }

    const s = detail.coin.marketStructure;
    return {
      symbol: detail.coin.symbol,
      exchange: detail.coin.exchange,
      timeframe: s.timeframe || timeframe,
      timestamp: Date.now(),
      structure: s.state,
      higherHigh: s.state === 'Higher High (HH)',
      higherLow: s.state === 'Higher Low (HL)',
      lowerHigh: s.state === 'Lower High (LH)',
      lowerLow: s.state === 'Lower Low (LL)',
      support: s.nearestSupport?.price ?? s.lastSwingLow,
      resistance: s.nearestResistance?.price ?? s.lastSwingHigh,
      breakout: s.event === 'Potential Breakout',
      breakdown: s.event === 'Potential Breakdown',
      retest: s.event === 'Potential Retest Zone' || s.event === 'Support Retest' || s.event === 'Resistance Retest',
      lastSwingHigh: s.lastSwingHigh,
      lastSwingLow: s.lastSwingLow
    };
  }

  /**
   * Tool 5: getScores
   */
  public async getScores(params: {
    symbol: string;
    exchange?: ExchangeId;
    timeframe?: Timeframe;
  }) {
    const timeframe = params.timeframe || '1h';
    const { detail, exchange } = await this.resolveCoin(params.symbol, params.exchange, timeframe);

    if (!detail.coin || !detail.coin.scores) {
      throw new Error(`Scores unavailable for ${params.symbol} on ${exchange}.`);
    }

    const s = detail.coin.scores;
    const b = s.bullBreakdown;
    const d = s.downsideRiskBreakdown;

    return {
      symbol: detail.coin.symbol,
      exchange: detail.coin.exchange,
      bullScore: s.bullScore,
      bullClassification: s.bullClassification,
      downsideRisk: s.downsideRiskScore,
      downsideRiskClassification: s.downsideRiskClassification,
      signal: s.signal,
      componentBreakdown: {
        trend: b?.trendMA?.score ?? 50,
        rsi: b?.rsi?.score ?? 50,
        volume: b?.volume?.score ?? 50,
        bollinger: b?.bollingerBands?.score ?? 50,
        momentum: b?.priceMomentum?.score ?? 50,
        structure: b?.marketStructure?.score ?? 50,
        openInterest: b?.openInterest?.score ?? 50,
        funding: b?.funding?.score ?? 50
      },
      downsideFactors: {
        rsiExtreme: d?.rsiExtreme?.score ?? 20,
        maBreakdown: d?.maBreakdown?.score ?? 20,
        volumeWeakness: d?.volumeWeakness?.score ?? 20,
        momentumLoss: d?.momentumLoss?.score ?? 20,
        supportLossProxy: d?.supportLossProxy?.score ?? 20,
        bearishStructure: d?.bearishStructure?.score ?? 20,
        derivativesRisk: d?.derivativesRisk?.score ?? 20,
        liquidationPressure: d?.liquidationPressure?.score ?? 20
      },
      summaryNotes: [
        `Bull classification: ${s.bullClassification}`,
        `Downside risk classification: ${s.downsideRiskClassification}`,
        `Analytical signal: ${s.signal}`
      ]
    };
  }

  /**
   * Tool 6: getBTCContext
   */
  public async getBTCContext(exchange: ExchangeId = 'BINANCE') {
    const detail = await marketDataService.getCoinDetail('BTC/USDT', '1h', exchange);
    const c = detail.coin;
    const ind = c?.indicators;
    const scores = c?.scores;
    const structure = c?.marketStructure;

    return {
      symbol: 'BTC/USDT',
      price: c?.price ?? 0,
      change24h: c?.change24h ?? 0,
      rsi14: ind?.rsi14 ?? 50,
      ma20: ind?.ma20 ?? 0,
      ma50: ind?.ma50 ?? 0,
      ma200: ind?.ma200 ?? 0,
      bullScore: scores?.bullScore ?? 50,
      downsideRisk: scores?.downsideRiskScore ?? 50,
      signal: scores?.signal ?? 'NEUTRAL',
      structure: structure?.state ?? 'Range-Bound / Consolidation',
      support: structure?.nearestSupport?.price ?? structure?.lastSwingLow ?? 0,
      resistance: structure?.nearestResistance?.price ?? structure?.lastSwingHigh ?? 0,
      timestamp: Date.now(),
      note: 'Macro Bitcoin context. Altcoins may decouple during rotation or high-beta phases.'
    };
  }

  /**
   * Tool 7: getWhaleActivity
   */
  public async getWhaleActivity(params: {
    symbol?: string;
    minUsd?: number;
    limit?: number;
  }): Promise<WhaleActivitySummary> {
    return onChainProviderManager.getWhaleActivity(params);
  }

  /**
   * Tool 8: scanMarket
   */
  public async scanMarket(params: {
    query?: string;
    exchange?: ExchangeId;
    bullMin?: number;
    riskMin?: number;
    volRatioMin?: number;
    rsiMax?: number;
    rsiMin?: number;
  }) {
    const exchange = params.exchange || 'BINANCE';
    const allCoins = await marketDataService.scanMarket(exchange);

    if (params.query) {
      const parsed = marketQueryParser.parseQuery(params.query);
      const filtered = marketQueryParser.filterCoins(allCoins, parsed);
      return {
        query: params.query,
        parsedFilters: parsed.filters,
        totalEvaluated: allCoins.length,
        matchCount: filtered.length,
        coins: filtered.map(c => this.summarizeCoin(c))
      };
    }

    const filtered = allCoins.filter(c => {
      if (params.bullMin !== undefined && c.scores.bullScore < params.bullMin) return false;
      if (params.riskMin !== undefined && c.scores.downsideRiskScore < params.riskMin) return false;
      if (params.volRatioMin !== undefined && c.indicators.volumeAnalysis.ratio < params.volRatioMin) return false;
      if (params.rsiMax !== undefined && c.indicators.rsi14 > params.rsiMax) return false;
      if (params.rsiMin !== undefined && c.indicators.rsi14 < params.rsiMin) return false;
      return true;
    });

    return {
      totalEvaluated: allCoins.length,
      matchCount: filtered.length,
      coins: filtered.map(c => this.summarizeCoin(c))
    };
  }

  /**
   * Tool 9: compareCoins
   */
  public async compareCoins(params: {
    symbolA: string;
    symbolB: string;
    exchange?: ExchangeId;
    timeframe?: Timeframe;
  }) {
    const exchange = params.exchange || 'BINANCE';
    const timeframe = params.timeframe || '1h';

    const [detA, detB] = await Promise.all([
      marketDataService.getCoinDetail(params.symbolA, timeframe, exchange),
      marketDataService.getCoinDetail(params.symbolB, timeframe, exchange)
    ]);

    if (!detA.coin || !detB.coin) {
      throw new Error(`Comparison failed: one or both pairs (${params.symbolA}, ${params.symbolB}) unavailable.`);
    }

    const cA = detA.coin;
    const cB = detB.coin;

    // Determine relative strength
    let relativeStrength = `${cA.symbol} and ${cB.symbol} exhibit comparable technical momentum.`;
    if (cA.scores.bullScore > cB.scores.bullScore + 10) {
      relativeStrength = `${cA.symbol} demonstrates stronger bullish posture (Bull Score ${cA.scores.bullScore} vs ${cB.scores.bullScore}).`;
    } else if (cB.scores.bullScore > cA.scores.bullScore + 10) {
      relativeStrength = `${cB.symbol} demonstrates stronger bullish posture (Bull Score ${cB.scores.bullScore} vs ${cA.scores.bullScore}).`;
    }

    const keyDivergences: string[] = [];
    if (cA.indicators.priceVsMa50 !== cB.indicators.priceVsMa50) {
      keyDivergences.push(`Moving Average Divergence: ${cA.symbol} is ${cA.indicators.priceVsMa50} MA50 while ${cB.symbol} is ${cB.indicators.priceVsMa50} MA50.`);
    }
    if (Math.abs(cA.indicators.rsi14 - cB.indicators.rsi14) > 15) {
      keyDivergences.push(`RSI Divergence: ${cA.symbol} RSI14 at ${cA.indicators.rsi14} vs ${cB.symbol} at ${cB.indicators.rsi14}.`);
    }
    if (cA.marketStructure?.state !== cB.marketStructure?.state) {
      keyDivergences.push(`Structural Divergence: ${cA.symbol} is ${cA.marketStructure?.state || 'N/A'} vs ${cB.symbol} (${cB.marketStructure?.state || 'N/A'}).`);
    }

    return {
      symbolA: cA.symbol,
      symbolB: cB.symbol,
      coinA: this.summarizeCoin(cA),
      coinB: this.summarizeCoin(cB),
      relativeStrength,
      keyDivergences,
      derivativesComparison: `OI Change: ${cA.symbol} (${cA.derivatives?.openInterestChange24h?.toFixed(2) ?? 'N/A'}%) vs ${cB.symbol} (${cB.derivatives?.openInterestChange24h?.toFixed(2) ?? 'N/A'}%). Funding: ${cA.symbol} (${((cA.derivatives?.fundingRate ?? 0) * 100).toFixed(4)}%) vs ${cB.symbol} (${((cB.derivatives?.fundingRate ?? 0) * 100).toFixed(4)}%).`
    };
  }

  /**
   * Tool 10: getHistoricalChanges
   */
  public async getHistoricalChanges(params: {
    symbol: string;
    exchange?: ExchangeId;
    hours?: number;
  }) {
    const exchange = params.exchange || 'BINANCE';
    const hours = params.hours || 24;
    const detail = await marketDataService.getCoinDetail(params.symbol, '1h', exchange);

    if (!detail.coin) {
      throw new Error(`Historical data unavailable for ${params.symbol}.`);
    }

    const c = detail.coin;
    const candles = detail.candles || [];
    const len = candles.length;
    const lookback = Math.min(len - 1, hours);

    const oldCandle = len > lookback ? candles[len - 1 - lookback] : candles[0];
    const currentCandle = candles[len - 1] || oldCandle;

    const priceChange = oldCandle && oldCandle.close > 0 ? ((currentCandle.close - oldCandle.close) / oldCandle.close) * 100 : 0;
    const volumeTrend = c.indicators.volumeAnalysis.ratio > 1.2 ? 'Expanding' : c.indicators.volumeAnalysis.ratio < 0.8 ? 'Contracting' : 'Normal';

    return {
      symbol: c.symbol,
      periodHours: hours,
      currentPrice: currentCandle.close,
      historicalPrice: oldCandle?.close ?? 0,
      pricePercentChange: Number(priceChange.toFixed(2)),
      volumeTrend,
      currentRsi14: c.indicators.rsi14,
      openInterestChange: c.derivatives?.openInterestChange24h ?? null,
      marketStructure: c.marketStructure?.state ?? 'N/A',
      recentBreakout: c.marketStructure?.event === 'Potential Breakout',
      recentBreakdown: c.marketStructure?.event === 'Potential Breakdown'
    };
  }

  /**
   * Tool 11: getIndicatorConflicts
   */
  public async getIndicatorConflicts(params: {
    symbol: string;
    exchange?: ExchangeId;
    timeframe?: Timeframe;
  }) {
    const exchange = params.exchange || 'BINANCE';
    const timeframe = params.timeframe || '1h';
    const detail = await marketDataService.getCoinDetail(params.symbol, timeframe, exchange);

    if (!detail.coin) {
      throw new Error(`Data unavailable for conflict audit on ${params.symbol}.`);
    }

    const c = detail.coin;
    const ind = c.indicators;
    const deriv = c.derivatives;
    const struct = c.marketStructure;
    const conflicts: string[] = [];

    // Conflict 1: Price Above MAs vs Overbought RSI
    if (ind.priceVsMa20 === 'above' && ind.priceVsMa50 === 'above' && ind.rsi14 >= 72) {
      conflicts.push(`Bullish Trend vs Overbought Momentum: Price is trending cleanly above MA20 and MA50, but RSI14 is elevated at ${ind.rsi14.toFixed(1)}, creating vulnerability to mean-reversion pullbacks.`);
    }

    // Conflict 2: Price Rising vs Volume Declining (Bearish Volume Divergence)
    if (c.change24h > 3 && ind.volumeAnalysis.ratio < 0.75) {
      conflicts.push(`Bullish Price vs Contracting Volume Divergence: Price gained +${c.change24h.toFixed(2)}% over 24h, yet current trading volume is only ${ind.volumeAnalysis.ratio.toFixed(2)}x average. Rally lacks strong aggressive buyer expansion.`);
    }

    // Conflict 3: Price Rising vs Open Interest Declining (Short Covering Rally)
    if (c.change24h > 2 && deriv && (deriv.openInterestChange24h ?? 0) < -3) {
      conflicts.push(`Price Gain vs Declining Open Interest (Short Covering): Price is up +${c.change24h.toFixed(2)}%, but Open Interest dropped by ${(deriv.openInterestChange24h ?? 0).toFixed(2)}%. This suggests the move is fueled by short liquidations/covering rather than genuine new capital entry.`);
    }

    // Conflict 4: High Bull Score vs Bearish Market Structure
    if (c.scores.bullScore > 70 && struct && (struct.state === 'Lower Low (LL)' || struct.state === 'Lower High (LH)')) {
      conflicts.push(`Scoring Model vs Market Structure: Bull Score is elevated (${c.scores.bullScore}), but price structure remains defined by Lower Highs / Lower Lows. Watch for rejection at structural resistance.`);
    }

    // Conflict 5: High Positive Funding vs Elevated Downside Risk (Long Squeeze Vulnerability)
    if (deriv && (deriv.fundingRate ?? 0) > 0.00018 && c.scores.downsideRiskScore > 60) {
      conflicts.push(`Crowded Long Positioning vs High Downside Risk: Funding rate is high (${((deriv.fundingRate ?? 0) * 100).toFixed(4)}%), indicating over-leveraged longs while Downside Risk is elevated (${c.scores.downsideRiskScore}). Risk of cascading liquidation flush.`);
    }

    if (conflicts.length === 0) {
      conflicts.push('No acute indicator divergences detected. Indicators and derivatives display coherent directional alignment.');
    }

    return {
      symbol: c.symbol,
      conflictsCount: conflicts.length,
      conflicts,
      indicatorsSummary: {
        rsi14: ind.rsi14,
        trend: ind.maTrend,
        volumeRatio: ind.volumeAnalysis.ratio,
        structure: struct?.state ?? 'N/A',
        fundingRate: deriv?.fundingRate ?? 'N/A'
      }
    };
  }

  private summarizeCoin(c: NormalizedCoinData) {
    return {
      symbol: c.symbol,
      price: c.price,
      change24h: c.change24h,
      volume24h: c.volume24h,
      bullScore: c.scores.bullScore,
      downsideRisk: c.scores.downsideRiskScore,
      signal: c.scores.signal,
      rsi14: c.indicators.rsi14,
      volumeRatio: c.indicators.volumeAnalysis.ratio,
      structure: c.marketStructure?.state ?? 'N/A',
      openInterestChange: c.derivatives?.openInterestChange24h ?? 'N/A',
      fundingRate: c.derivatives && c.derivatives.fundingRate !== null ? `${(c.derivatives.fundingRate * 100).toFixed(4)}%` : 'N/A'
    };
  }
}

export const aiToolLayer = new AIToolLayer();
