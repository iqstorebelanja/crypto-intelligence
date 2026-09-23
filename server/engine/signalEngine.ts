import {
  Candle,
  DerivativesData,
  ExchangeId,
  MarketSignal,
  MarketStructure,
  MultiTimeframeConfluenceSummary,
  NormalizedCoinData,
  SignalDirection,
  SignalEngineAdminConfig,
  SignalEvidence,
  SignalLifecycleStatus,
  SignalType,
  TechnicalIndicators,
  Timeframe,
  TimeframeSignalState,
  BreakoutContext,
  DerivativesSignalContext,
  BtcSignalContext
} from '../../src/types';
import { db } from '../db/schema';
import { computeTechnicalIndicators } from './technicalIndicators';
import { MarketStructureEngine } from './marketStructure';
import { scoringEngine } from './scoringEngine';

export class SignalEngine {
  public static readonly MODEL_VERSION = 'v2.0.0';
  public static readonly WHALE_MODEL_VERSION = 'v1.0.0';
  public static readonly ORDER_FLOW_VERSION = 'v1.0.0';
  public static readonly LIQUIDATION_VERSION = 'v1.0.0';
  public static readonly INDICATOR_VERSION = 1;
  public static readonly STRUCTURE_VERSION = 1;

  private msEngine = new MarketStructureEngine(5);

  /**
   * Main evaluation method: generates or updates MarketSignal for a given coin data and timeframe
   */
  public evaluateSignal(
    coin: NormalizedCoinData,
    candlesMap?: Partial<Record<Timeframe, Candle[]>>,
    btcCoin?: NormalizedCoinData | null,
    isCandleConfirmed: boolean = true
  ): MarketSignal {
    const config = db.signalConfig;
    const currentPrice = coin.price;
    const timeframe = (coin.marketStructure?.timeframe || '1h') as Timeframe;

    // 1. Timeframe multi-analysis
    const timeframeStates = this.analyzeMultipleTimeframes(coin, candlesMap, config);

    // 2. Multi-Timeframe Confluence summary
    const mtfSummary = this.calculateMtfConfluence(timeframeStates, config);

    // 3. Breakout & Structure Analysis
    const breakoutCtx = this.analyzeBreakoutContext(coin, candlesMap?.[timeframe], isCandleConfirmed);

    // 4. Derivatives Context (handles missing OI gracefully)
    const derivCtx = this.analyzeDerivativesContext(coin.derivatives, coin.change24h);

    // 5. BTC Context (altcoins evaluate BTC, BTC evaluates itself)
    const btcCtx = this.analyzeBtcContext(coin.symbol, btcCoin);

    // 6. Evidence Building
    const { evidence, supportingFactors, conflictingFactors, neutralFactors } = this.buildSignalEvidence(
      coin,
      timeframeStates,
      mtfSummary,
      breakoutCtx,
      derivCtx,
      btcCtx,
      timeframe
    );

    // 7. Signal Classification & Direction
    const { signalType, direction, isConflicted } = this.classifySignal(
      coin,
      timeframeStates,
      mtfSummary,
      breakoutCtx,
      derivCtx,
      btcCtx,
      conflictingFactors
    );

    // 8. Signal Strength & Downside Risk calculation
    const strength = this.calculateSignalStrength(
      coin,
      timeframeStates,
      mtfSummary,
      breakoutCtx,
      derivCtx,
      btcCtx,
      direction,
      isConflicted,
      config
    );

    const downsideRiskStrength = this.calculateDownsideStrength(
      coin,
      timeframeStates,
      mtfSummary,
      breakoutCtx,
      derivCtx,
      btcCtx,
      config
    );

    // 9. Analytical Confidence (0-100) — Analytical model robustness, NOT probability of profit
    const confidence = this.calculateAnalyticalConfidence(
      evidence,
      supportingFactors.length,
      conflictingFactors.length,
      isCandleConfirmed,
      derivCtx.openInterestAvailable
    );

    // 10. Invalidation & Trigger Prices
    const { triggerPrice, confirmationPrice, invalidationPrice, invalidationReason } = this.calculateSignalLevels(
      coin,
      direction,
      signalType,
      breakoutCtx
    );

    // 11. Lifecycle Status
    let status: SignalLifecycleStatus = 'ACTIVE';
    if (!isCandleConfirmed) {
      status = 'FORMING';
    } else if (signalType.includes('BREAKOUT') && breakoutCtx.state === 'BREAKOUT FORMING') {
      status = 'FORMING';
    } else if (invalidationPrice && direction === 'BULLISH' && currentPrice < invalidationPrice) {
      status = 'INVALIDATED';
    } else if (invalidationPrice && direction === 'BEARISH' && currentPrice > invalidationPrice) {
      status = 'INVALIDATED';
    } else {
      status = 'CONFIRMED';
    }

    const signalId = `sig_${coin.exchange}_${coin.symbol.replace(/[\/\-_]/g, '')}_${timeframe}_${Date.now()}`;

    const marketSignal: MarketSignal = {
      id: signalId,
      exchange: coin.exchange,
      marketId: coin.marketId || `${coin.exchange.toLowerCase()}_${coin.symbol}`,
      marketType: coin.marketType,
      symbol: coin.symbol,
      timeframe,
      signalType,
      direction,
      status,
      strength,
      confidence,
      timestamp: coin.timestamp || Date.now(),
      triggerPrice,
      confirmationPrice,
      invalidationPrice,
      invalidationReason,
      targetLevels: this.calculateTargetLevels(currentPrice, direction, coin.marketStructure),
      evidence,
      supportingFactors,
      conflictingFactors,
      neutralFactors,
      timeframeAnalysis: timeframeStates,
      multiTimeframeSummary: mtfSummary,
      breakoutContext: breakoutCtx,
      derivativesContext: derivCtx,
      btcContext: btcCtx,
      downsideRiskStrength,
      whaleContext: {
        score: coin.whaleTransfers && coin.whaleTransfers.length > 0 ? 55 : null,
        context: coin.whaleTransfers && coin.whaleTransfers.length > 0
          ? (coin.whaleTransfers.filter(t => t.eventType === 'EXCHANGE_WITHDRAWAL').length >= 2 ? 'POSSIBLE_ACCUMULATION_CONTEXT' : 'NEUTRAL')
          : 'UNKNOWN',
        transfersCount: coin.whaleTransfers?.length ?? 0,
        dataQuality: coin.whaleTransfers?.length ? 'HIGH' : 'UNAVAILABLE'
      },
      orderFlowContext: {
        score: coin.orderFlow?.orderFlowScore ?? 0,
        pressure: coin.orderFlow?.pressureState ?? 'UNKNOWN',
        cvdState: coin.orderFlow?.cvd?.isAvailable ? (coin.orderFlow.cvd.currentDelta > 0 ? 'POSITIVE' : 'NEGATIVE') : 'UNAVAILABLE',
        divergence: coin.orderFlow?.divergence?.type ?? 'NONE',
        dataQuality: coin.orderFlow?.dataQuality ?? 'UNAVAILABLE'
      },
      liquidationContext: {
        score: coin.liquidationIntel?.liquidationActivityScore ?? 0,
        isSpike: coin.liquidationIntel?.isSpike ?? false,
        status: coin.liquidationIntel?.spikeStatus ?? 'NORMAL',
        context: coin.liquidationIntel?.context?.relation ?? 'BALANCED_LIQUIDATIONS',
        dataQuality: coin.liquidationIntel?.dataQuality ?? 'UNAVAILABLE'
      },
      signalModelVersion: SignalEngine.MODEL_VERSION,
      whaleModelVersion: SignalEngine.WHALE_MODEL_VERSION,
      orderFlowVersion: SignalEngine.ORDER_FLOW_VERSION,
      liquidationVersion: SignalEngine.LIQUIDATION_VERSION,
      modelVersion: SignalEngine.MODEL_VERSION,
      indicatorVersion: SignalEngine.INDICATOR_VERSION,
      structureVersion: SignalEngine.STRUCTURE_VERSION,
      weightConfigVersion: config.version,
      expiresAt: Date.now() + 20 * 60 * 60 * 1000 // default 20 hours
    };

    // Store in database
    db.saveSignal(marketSignal);

    return marketSignal;
  }

  /**
   * Evaluates individual timeframe states using existing indicator and market structure engines
   */
  public analyzeMultipleTimeframes(
    coin: NormalizedCoinData,
    candlesMap?: Partial<Record<Timeframe, Candle[]>>,
    config: SignalEngineAdminConfig = db.signalConfig
  ): Record<Timeframe, TimeframeSignalState> {
    const timeframes: Timeframe[] = ['5m', '15m', '1h', '4h', '1D'];
    const result: Record<Timeframe, TimeframeSignalState> = {} as any;

    for (const tf of timeframes) {
      const candles = candlesMap?.[tf];
      let indicators: TechnicalIndicators = coin.indicators;
      let structure: MarketStructure = coin.marketStructure;

      if (candles && candles.length >= 20) {
        indicators = computeTechnicalIndicators(candles);
        structure = this.msEngine.analyze(candles, tf, 5);
      }

      // Evaluate trend based on MA ordering & slopes
      const isBullTrend =
        (indicators.ma20 >= indicators.ma50 && indicators.priceVsMa20 === 'above') ||
        (indicators.priceVsMa20 === 'above' && indicators.priceVsMa50 === 'above');
      const isBearTrend =
        (indicators.ma20 <= indicators.ma50 && indicators.priceVsMa20 === 'below') ||
        (indicators.priceVsMa20 === 'below' && indicators.priceVsMa50 === 'below');
      const trendStr = isBullTrend
        ? 'MA20 > MA50 (Bullish Alignment)'
        : isBearTrend
        ? 'MA20 < MA50 (Bearish Alignment)'
        : 'MA Mixed (Neutral / Consolidation)';

      // RSI evaluation
      let rsiState = 'Neutral Momentum';
      if (indicators.rsi14 >= config.thresholds.rsiOverbought) rsiState = 'Overbought Zone';
      else if (indicators.rsi14 <= config.thresholds.rsiOversold) rsiState = 'Oversold Zone';
      else if (indicators.rsi14 >= 55) rsiState = 'Bullish Expansion';
      else if (indicators.rsi14 <= 45) rsiState = 'Bearish Deterioration';

      // Volume evaluation
      const vRatio = indicators.volumeAnalysis.ratio;
      let vState: 'normal' | 'elevated' | 'high' | 'extreme' = 'normal';
      if (vRatio >= config.thresholds.volumeRatioExtreme) vState = 'extreme';
      else if (vRatio >= config.thresholds.volumeRatioHigh) vState = 'high';
      else if (vRatio >= config.thresholds.volumeRatioElevated) vState = 'elevated';

      // Bollinger Bands evaluation
      let bbState = 'Normal Volatility';
      if (indicators.bb.percentB > 1.0) bbState = 'Above Upper Band (Volatility Expansion)';
      else if (indicators.bb.percentB < 0.0) bbState = 'Below Lower Band (Downside Expansion)';
      else if (indicators.bb.width < 0.05) bbState = 'Band Squeeze (Volatility Compression)';
      else if (indicators.bb.percentB >= 0.7) bbState = 'Upper Band Proximity';
      else if (indicators.bb.percentB <= 0.3) bbState = 'Lower Band Proximity';

      // Direction & Bias
      let tfScore = 50;
      if (isBullTrend) tfScore += 20;
      if (isBearTrend) tfScore -= 20;
      if (indicators.rsi14 > 50) tfScore += 10;
      if (indicators.rsi14 < 50) tfScore -= 10;
      if (structure.state.includes('Higher High') || structure.state.includes('Higher Low')) tfScore += 15;
      if (structure.state.includes('Lower Low') || structure.state.includes('Lower High')) tfScore -= 15;
      if (vRatio > 1.2 && isBullTrend) tfScore += 5;
      tfScore = Math.max(0, Math.min(100, tfScore));

      let direction: SignalDirection = 'NEUTRAL';
      let bias: 'Bullish' | 'Bearish' | 'Neutral' | 'Conflicted' = 'Neutral';

      if (tfScore >= 65) {
        direction = 'BULLISH';
        bias = 'Bullish';
      } else if (tfScore <= 35) {
        direction = 'BEARISH';
        bias = 'Bearish';
      } else {
        direction = 'NEUTRAL';
        bias = Math.abs(indicators.rsi14 - 50) > 15 ? 'Conflicted' : 'Neutral';
      }

      result[tf] = {
        timeframe: tf,
        direction,
        bias,
        score: tfScore,
        trend: trendStr,
        structure: structure.state,
        rsi: indicators.rsi14,
        rsiState,
        volumeRatio: indicators.volumeAnalysis.ratio,
        volumeState: vState,
        bollingerState: bbState,
        weight: config.timeframeWeights[tf] ?? 20
      };
    }

    return result;
  }

  /**
   * Confluence calculation across timeframes
   */
  public calculateMtfConfluence(
    timeframeStates: Record<Timeframe, TimeframeSignalState>,
    config: SignalEngineAdminConfig = db.signalConfig
  ): MultiTimeframeConfluenceSummary {
    const timeframes: Timeframe[] = ['5m', '15m', '1h', '4h', '1D'];
    const bullishTimeframes: Timeframe[] = [];
    const bearishTimeframes: Timeframe[] = [];
    const neutralTimeframes: Timeframe[] = [];

    let weightedScore = 0;
    let totalWeight = 0;

    for (const tf of timeframes) {
      const state = timeframeStates[tf];
      if (!state) continue;
      const weight = config.timeframeWeights[tf] ?? 20;
      totalWeight += weight;

      if (state.direction === 'BULLISH') bullishTimeframes.push(tf);
      else if (state.direction === 'BEARISH') bearishTimeframes.push(tf);
      else neutralTimeframes.push(tf);

      weightedScore += state.score * weight;
    }

    const alignmentScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;

    const hasStrongBull = bullishTimeframes.length >= 3;
    const hasStrongBear = bearishTimeframes.length >= 3;
    const isConflicted =
      (bullishTimeframes.includes('5m') || bullishTimeframes.includes('15m')) &&
      (bearishTimeframes.includes('4h') || bearishTimeframes.includes('1D'));

    let alignedDirection: SignalDirection = 'NEUTRAL';
    if (!isConflicted && alignmentScore >= 62 && hasStrongBull) {
      alignedDirection = 'BULLISH';
    } else if (!isConflicted && alignmentScore <= 38 && hasStrongBear) {
      alignedDirection = 'BEARISH';
    }

    let summaryText = 'Neutral multi-timeframe conditions';
    if (isConflicted) {
      summaryText = 'Conflicted: Short-term momentum opposes higher-timeframe structure';
    } else if (alignedDirection === 'BULLISH') {
      summaryText = `Multi-Timeframe Bullish Confluence (${bullishTimeframes.join(', ')} aligned)`;
    } else if (alignedDirection === 'BEARISH') {
      summaryText = `Multi-Timeframe Bearish Confluence (${bearishTimeframes.join(', ')} aligned)`;
    }

    return {
      alignedDirection,
      alignmentScore,
      bullishTimeframes,
      bearishTimeframes,
      neutralTimeframes,
      isConfluent: (hasStrongBull || hasStrongBear) && !isConflicted,
      isConflicted,
      summaryText
    };
  }

  /**
   * Breakout & False Breakout Engine
   */
  public analyzeBreakoutContext(
    coin: NormalizedCoinData,
    candles?: Candle[],
    isCandleConfirmed: boolean = true
  ): BreakoutContext {
    const struct = coin.marketStructure;
    const price = coin.price;
    const lastHigh = struct.lastSwingHigh;
    const lastLow = struct.lastSwingLow;

    if (!candles || candles.length < 2) {
      const isAboveResistance = price > lastHigh && lastHigh > 0;
      const isBelowSupport = price < lastLow && lastLow > 0;

      return {
        state: isAboveResistance
          ? isCandleConfirmed
            ? 'BREAKOUT CONFIRMED'
            : 'BREAKOUT FORMING'
          : isBelowSupport
          ? isCandleConfirmed
            ? 'BREAKOUT CONFIRMED'
            : 'BREAKOUT FORMING'
          : 'NONE',
        breakoutLevel: isAboveResistance ? lastHigh : isBelowSupport ? lastLow : 0,
        direction: isAboveResistance ? 'UP' : isBelowSupport ? 'DOWN' : 'NONE',
        candleCloseBeyond: isCandleConfirmed && (isAboveResistance || isBelowSupport),
        volumeConfirmed: coin.indicators.volumeAnalysis.ratio >= 1.2,
        candleBodyStrength: 0.6,
        retestZone: struct.retestZone
          ? { min: struct.retestZone.min, max: struct.retestZone.max, level: struct.retestZone.brokenLevel }
          : null,
        description: isAboveResistance
          ? `Price trading above resistance ($${lastHigh.toLocaleString()})`
          : isBelowSupport
          ? `Price trading below support ($${lastLow.toLocaleString()})`
          : 'Price within structural range'
      };
    }

    const latestCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];

    const range = latestCandle.high - latestCandle.low;
    const body = Math.abs(latestCandle.close - latestCandle.open);
    const bodyStrength = range > 0 ? parseFloat((body / range).toFixed(2)) : 0.5;

    // 1. Check confirmed resistance breakout
    if (latestCandle.close > lastHigh && lastHigh > 0) {
      const volConfirmed = coin.indicators.volumeAnalysis.ratio >= 1.2;
      return {
        state: isCandleConfirmed ? 'BREAKOUT CONFIRMED' : 'BREAKOUT FORMING',
        breakoutLevel: lastHigh,
        direction: 'UP',
        candleCloseBeyond: true,
        volumeConfirmed: volConfirmed,
        candleBodyStrength: bodyStrength,
        description: `Confirmed resistance breakout above $${lastHigh.toLocaleString()} with ${volConfirmed ? 'volume confirmation' : 'moderate volume'}`
      };
    }

    // 2. Check confirmed support breakdown
    if (latestCandle.close < lastLow && lastLow > 0) {
      const volConfirmed = coin.indicators.volumeAnalysis.ratio >= 1.2;
      return {
        state: isCandleConfirmed ? 'BREAKOUT CONFIRMED' : 'BREAKOUT FORMING',
        breakoutLevel: lastLow,
        direction: 'DOWN',
        candleCloseBeyond: true,
        volumeConfirmed: volConfirmed,
        candleBodyStrength: bodyStrength,
        description: `Confirmed support breakdown below $${lastLow.toLocaleString()} with ${volConfirmed ? 'volume confirmation' : 'moderate volume'}`
      };
    }

    // 3. Check false breakout: Wick spiked above resistance, but candle closed below resistance
    if (latestCandle.high > lastHigh && latestCandle.close <= lastHigh) {
      return {
        state: 'POSSIBLE_FALSE_BREAKOUT',
        breakoutLevel: lastHigh,
        direction: 'UP',
        candleCloseBeyond: false,
        volumeConfirmed: false,
        candleBodyStrength: bodyStrength,
        retestZone: null,
        description: `Possible false breakout: Wick spiked to $${latestCandle.high.toLocaleString()} but candle closed back below resistance ($${lastHigh.toLocaleString()})`
      };
    }

    // 4. Check false breakdown: Wick spiked below support, but candle closed above support
    if (latestCandle.low < lastLow && latestCandle.close >= lastLow) {
      return {
        state: 'POSSIBLE_FALSE_BREAKOUT',
        breakoutLevel: lastLow,
        direction: 'DOWN',
        candleCloseBeyond: false,
        volumeConfirmed: false,
        candleBodyStrength: bodyStrength,
        retestZone: null,
        description: `Possible false breakdown: Wick spiked to $${latestCandle.low.toLocaleString()} but candle closed back above support ($${lastLow.toLocaleString()})`
      };
    }

    // Check Retest Zone
    if (struct.retestZone) {
      const inZone = price >= struct.retestZone.min && price <= struct.retestZone.max;
      if (inZone) {
        return {
          state: 'BREAKOUT RETEST',
          breakoutLevel: struct.retestZone.brokenLevel,
          direction: struct.retestZone.type === 'support' ? 'UP' : 'DOWN',
          candleCloseBeyond: true,
          volumeConfirmed: true,
          candleBodyStrength: bodyStrength,
          retestZone: { min: struct.retestZone.min, max: struct.retestZone.max, level: struct.retestZone.brokenLevel },
          description: `Price currently retesting broken level ($${struct.retestZone.brokenLevel.toLocaleString()}) inside zone [$${struct.retestZone.min.toLocaleString()} - $${struct.retestZone.max.toLocaleString()}]`
        };
      }
    }

    return {
      state: 'NONE',
      breakoutLevel: 0,
      direction: 'NONE',
      candleCloseBeyond: false,
      volumeConfirmed: false,
      candleBodyStrength: bodyStrength,
      retestZone: null,
      description: 'Price oscillating within regular structural boundaries'
    };
  }

  /**
   * Derivatives Context Analysis (gracefully handles null / N/A derivatives on Spot)
   */
  public analyzeDerivativesContext(
    derivatives: DerivativesData | null,
    priceChange24h: number
  ): DerivativesSignalContext {
    if (!derivatives || derivatives.openInterest === null || derivatives.openInterest === undefined) {
      return {
        oiPriceContext: 'NEUTRAL_OR_NA',
        fundingContext: 'N/A',
        liquidationContext: 'N/A',
        openInterestAvailable: false,
        fundingRate: null,
        openInterestChangePct: null
      };
    }

    const oiChange = derivatives.openInterestChange24h ?? derivatives.openInterestChange1h ?? 0;
    const priceUp = priceChange24h > 0;
    const oiUp = oiChange > 0;

    let oiPriceContext: any = 'NEUTRAL_OR_NA';
    if (priceUp && oiUp) oiPriceContext = 'LONG_BUILDUP_CONTEXT';
    else if (priceUp && !oiUp) oiPriceContext = 'SHORT_COVERING_CONTEXT';
    else if (!priceUp && oiUp) oiPriceContext = 'SHORT_BUILDUP_CONTEXT';
    else if (!priceUp && !oiUp) oiPriceContext = 'LONG_UNWINDING_CONTEXT';

    // Funding analysis
    let fundingContext: any = 'neutral funding';
    const fr = derivatives.fundingRate ?? 0;
    if (Math.abs(fr) > 0.0005) {
      fundingContext = 'extreme funding';
    } else if (fr > 0.00025) {
      fundingContext = 'bullish crowding risk';
    } else if (fr < -0.0001) {
      fundingContext = 'bearish crowding risk';
    }

    // Liquidation context
    let liquidationContext: any = 'normal liquidation';
    if (derivatives.liquidations) {
      const longLiq = derivatives.liquidations.long24h ?? 0;
      const shortLiq = derivatives.liquidations.short24h ?? 0;
      if (longLiq > 1000000 && longLiq > shortLiq * 2.5) {
        liquidationContext = 'long squeeze context';
      } else if (shortLiq > 1000000 && shortLiq > longLiq * 2.5) {
        liquidationContext = 'short squeeze context';
      } else if (longLiq + shortLiq > 5000000) {
        liquidationContext = 'liquidation spike';
      }
    }

    return {
      oiPriceContext,
      fundingContext,
      liquidationContext,
      openInterestAvailable: true,
      fundingRate: derivatives.fundingRate,
      openInterestChangePct: oiChange
    };
  }

  /**
   * BTC Context Analysis
   */
  public analyzeBtcContext(symbol: string, btcCoin?: NormalizedCoinData | null): BtcSignalContext {
    const isBtc = symbol.toUpperCase().includes('BTC');

    if (isBtc || !btcCoin) {
      return {
        trend: 'Neutral',
        momentum: 'Moderate',
        bullScore: btcCoin?.scores?.bullScore ?? 50,
        downsideRisk: btcCoin?.scores?.downsideRiskScore ?? 35,
        contextEffect: 'NEUTRAL',
        description: 'Asset is Bitcoin or reference BTC benchmark is neutral'
      };
    }

    const btcBullScore = btcCoin.scores?.bullScore ?? 50;
    const btcRisk = btcCoin.scores?.downsideRiskScore ?? 35;
    const btcTrend = btcCoin.indicators?.priceVsMa20 === 'above' && btcBullScore >= 55 ? 'Bullish' : btcRisk >= 60 ? 'Bearish' : 'Neutral';

    let contextEffect: 'SUPPORTIVE' | 'HEADWIND' | 'NEUTRAL' = 'NEUTRAL';
    let description = 'BTC trading in neutral consolidation';

    if (btcBullScore >= 60 && btcRisk <= 40) {
      contextEffect = 'SUPPORTIVE';
      description = `BTC market context is supportive (Bull Score: ${btcBullScore}/100, Low downside risk: ${btcRisk})`;
    } else if (btcRisk >= 60 || btcBullScore <= 35) {
      contextEffect = 'HEADWIND';
      description = `BTC market context presents headwind (Downside Risk: ${btcRisk}/100, Bull Score: ${btcBullScore})`;
    }

    return {
      trend: btcTrend,
      momentum: btcCoin.indicators?.rsi14 >= 55 ? 'Strong' : btcCoin.indicators?.rsi14 <= 45 ? 'Weak' : 'Moderate',
      bullScore: btcBullScore,
      downsideRisk: btcRisk,
      contextEffect,
      description
    };
  }

  /**
   * Builds explainable Signal Evidence: Supporting, Conflicting, Neutral
   */
  public buildSignalEvidence(
    coin: NormalizedCoinData,
    timeframes: Record<Timeframe, TimeframeSignalState>,
    mtfSummary: MultiTimeframeConfluenceSummary,
    breakout: BreakoutContext,
    deriv: DerivativesSignalContext,
    btc: BtcSignalContext,
    activeTf: Timeframe
  ): {
    evidence: SignalEvidence[];
    supportingFactors: string[];
    conflictingFactors: string[];
    neutralFactors: string[];
  } {
    const evidence: SignalEvidence[] = [];
    const supportingFactors: string[] = [];
    const conflictingFactors: string[] = [];
    const neutralFactors: string[] = [];

    const tfState = timeframes[activeTf] || timeframes['1h'];
    const ind = coin.indicators;
    const struct = coin.marketStructure;

    // 1. Trend Alignment
    if (ind.ma20 > ind.ma50 && ind.priceVsMa20 === 'above') {
      const desc = 'Price above MA20 with MA20 > MA50 bullish alignment';
      evidence.push({
        category: 'TREND',
        factor: 'MA Bullish Alignment',
        type: 'SUPPORTING',
        description: desc,
        importance: 'HIGH'
      });
      supportingFactors.push(desc);
    } else if (ind.ma20 < ind.ma50 && ind.priceVsMa20 === 'below') {
      const desc = 'Price below MA20 with MA20 < MA50 bearish alignment';
      evidence.push({
        category: 'TREND',
        factor: 'MA Bearish Alignment',
        type: 'CONFLICTING',
        description: desc,
        importance: 'HIGH'
      });
      conflictingFactors.push(desc);
    } else {
      const desc = 'Moving averages converging in neutral consolidation';
      evidence.push({
        category: 'TREND',
        factor: 'MA Neutral Alignment',
        type: 'NEUTRAL',
        description: desc,
        importance: 'LOW'
      });
      neutralFactors.push(desc);
    }

    // 2. Momentum (RSI)
    if (ind.rsi14 >= 55 && ind.rsi14 <= 70) {
      const desc = `RSI14 at ${ind.rsi14} indicates healthy bullish momentum expansion`;
      evidence.push({
        category: 'MOMENTUM',
        factor: 'RSI Bullish Expansion',
        type: 'SUPPORTING',
        description: desc,
        value: ind.rsi14,
        importance: 'MEDIUM'
      });
      supportingFactors.push(desc);
    } else if (ind.rsi14 > 70) {
      const desc = `RSI14 at ${ind.rsi14} in overbought zone (exhaustion risk)`;
      evidence.push({
        category: 'MOMENTUM',
        factor: 'RSI Overbought Risk',
        type: 'CONFLICTING',
        description: desc,
        value: ind.rsi14,
        importance: 'MEDIUM'
      });
      conflictingFactors.push(desc);
    } else if (ind.rsi14 < 40) {
      const desc = `RSI14 at ${ind.rsi14} reflects weak momentum`;
      evidence.push({
        category: 'MOMENTUM',
        factor: 'RSI Weak Momentum',
        type: 'CONFLICTING',
        description: desc,
        value: ind.rsi14,
        importance: 'MEDIUM'
      });
      conflictingFactors.push(desc);
    }

    // 3. Volume Confirmation
    if (ind.volumeAnalysis.ratio >= 1.5) {
      const desc = `Volume is ${ind.volumeAnalysis.ratio.toFixed(2)}x 20-period average (Elevated volume)`;
      evidence.push({
        category: 'VOLUME',
        factor: 'Volume Ratio Surge',
        type: 'SUPPORTING',
        description: desc,
        value: ind.volumeAnalysis.ratio,
        importance: 'HIGH'
      });
      supportingFactors.push(desc);
    } else if (ind.volumeAnalysis.ratio < 0.8) {
      const desc = `Volume is below average (${ind.volumeAnalysis.ratio.toFixed(2)}x 20-period average)`;
      evidence.push({
        category: 'VOLUME',
        factor: 'Volume Weakness',
        type: 'CONFLICTING',
        description: desc,
        value: ind.volumeAnalysis.ratio,
        importance: 'MEDIUM'
      });
      conflictingFactors.push(desc);
    }

    // 4. Market Structure
    if (struct.state.includes('Higher High') || struct.state.includes('Higher Low')) {
      const desc = `Market structure is bullish: ${struct.state}`;
      evidence.push({
        category: 'STRUCTURE',
        factor: 'Bullish Market Structure',
        type: 'SUPPORTING',
        description: desc,
        importance: 'HIGH'
      });
      supportingFactors.push(desc);
    } else if (struct.state.includes('Lower Low') || struct.state.includes('Lower High')) {
      const desc = `Market structure is bearish: ${struct.state}`;
      evidence.push({
        category: 'STRUCTURE',
        factor: 'Bearish Market Structure',
        type: 'CONFLICTING',
        description: desc,
        importance: 'HIGH'
      });
      conflictingFactors.push(desc);
    }

    // Breakout context
    if (breakout.state === 'BREAKOUT CONFIRMED' && breakout.direction === 'UP') {
      const desc = breakout.description;
      evidence.push({
        category: 'STRUCTURE',
        factor: 'Resistance Breakout Confirmed',
        type: 'SUPPORTING',
        description: desc,
        importance: 'HIGH'
      });
      supportingFactors.push(desc);
    } else if (breakout.state === 'POSSIBLE_FALSE_BREAKOUT') {
      const desc = breakout.description;
      evidence.push({
        category: 'STRUCTURE',
        factor: 'Possible False Breakout',
        type: 'CONFLICTING',
        description: desc,
        importance: 'HIGH'
      });
      conflictingFactors.push(desc);
    }

    // 5. Derivatives
    if (deriv.openInterestAvailable) {
      if (deriv.oiPriceContext === 'LONG_BUILDUP_CONTEXT') {
        const desc = `Derivatives: Long buildup context (Price ↑ with OI +${deriv.openInterestChangePct?.toFixed(1)}%)`;
        evidence.push({
          category: 'DERIVATIVES',
          factor: 'OI Long Buildup',
          type: 'SUPPORTING',
          description: desc,
          importance: 'MEDIUM'
        });
        supportingFactors.push(desc);
      } else if (deriv.oiPriceContext === 'SHORT_BUILDUP_CONTEXT') {
        const desc = `Derivatives: Short buildup context (Price ↓ with OI +${deriv.openInterestChangePct?.toFixed(1)}%)`;
        evidence.push({
          category: 'DERIVATIVES',
          factor: 'OI Short Buildup',
          type: 'CONFLICTING',
          description: desc,
          importance: 'MEDIUM'
        });
        conflictingFactors.push(desc);
      }

      if (deriv.fundingContext === 'bullish crowding risk') {
        const desc = `Derivatives: High funding rate (${((deriv.fundingRate || 0) * 100).toFixed(4)}%) indicates long crowding risk`;
        evidence.push({
          category: 'DERIVATIVES',
          factor: 'Funding Crowding Risk',
          type: 'CONFLICTING',
          description: desc,
          importance: 'LOW'
        });
        conflictingFactors.push(desc);
      }
    } else {
      neutralFactors.push('Derivatives: OI / Funding not natively supported on this exchange or spot market');
    }

    // 6. Multi-Timeframe Alignment
    if (mtfSummary.alignedDirection === 'BULLISH') {
      const desc = mtfSummary.summaryText;
      evidence.push({
        category: 'MULTI_TIMEFRAME',
        factor: 'MTF Bullish Alignment',
        type: 'SUPPORTING',
        description: desc,
        importance: 'HIGH'
      });
      supportingFactors.push(desc);
    } else if (mtfSummary.isConflicted) {
      const desc = mtfSummary.summaryText;
      evidence.push({
        category: 'MULTI_TIMEFRAME',
        factor: 'MTF Conflict Detected',
        type: 'CONFLICTING',
        description: desc,
        importance: 'HIGH'
      });
      conflictingFactors.push(desc);
    }

    // 7. BTC Context
    if (btc.contextEffect === 'SUPPORTIVE') {
      evidence.push({
        category: 'BTC_CONTEXT',
        factor: 'BTC Market Supportive',
        type: 'SUPPORTING',
        description: btc.description,
        importance: 'LOW'
      });
      supportingFactors.push(btc.description);
    } else if (btc.contextEffect === 'HEADWIND') {
      evidence.push({
        category: 'BTC_CONTEXT',
        factor: 'BTC Market Headwind',
        type: 'CONFLICTING',
        description: btc.description,
        importance: 'MEDIUM'
      });
      conflictingFactors.push(btc.description);
    }

    // 8. Order Flow Evidence
    if (coin.orderFlow) {
      if (coin.orderFlow.pressureState === 'BUYING_PRESSURE') {
        const desc = `Positive aggressive buying pressure (${coin.orderFlow.buySellRatio}x buy/sell ratio)`;
        evidence.push({
          category: 'ORDER_FLOW',
          factor: 'Aggressive Buying Pressure',
          type: 'SUPPORTING',
          description: desc,
          importance: 'HIGH'
        });
        supportingFactors.push(desc);
      } else if (coin.orderFlow.pressureState === 'SELLING_PRESSURE') {
        const desc = `Aggressive selling pressure (${coin.orderFlow.buySellRatio}x buy/sell ratio)`;
        evidence.push({
          category: 'ORDER_FLOW',
          factor: 'Aggressive Selling Pressure',
          type: 'CONFLICTING',
          description: desc,
          importance: 'HIGH'
        });
        conflictingFactors.push(desc);
      }

      if (coin.orderFlow.divergence?.detected) {
        if (coin.orderFlow.divergence.type === 'POSSIBLE_BEARISH_ORDER_FLOW_DIVERGENCE') {
          const desc = `Bearish order-flow divergence: ${coin.orderFlow.divergence.description}`;
          evidence.push({
            category: 'ORDER_FLOW',
            factor: 'Bearish CVD Divergence',
            type: 'CONFLICTING',
            description: desc,
            importance: 'HIGH'
          });
          conflictingFactors.push(desc);
        } else if (coin.orderFlow.divergence.type === 'POSSIBLE_BULLISH_ORDER_FLOW_DIVERGENCE') {
          const desc = `Bullish order-flow divergence: ${coin.orderFlow.divergence.description}`;
          evidence.push({
            category: 'ORDER_FLOW',
            factor: 'Bullish CVD Divergence',
            type: 'SUPPORTING',
            description: desc,
            importance: 'HIGH'
          });
          supportingFactors.push(desc);
        }
      }

      if (coin.orderFlow.orderBookImbalance?.state === 'BUY_SIDE_DEPTH_IMBALANCE') {
        const desc = `Buy-side depth imbalance (+${(coin.orderFlow.orderBookImbalance.imbalanceRatio * 100).toFixed(0)}%) in order book`;
        evidence.push({
          category: 'ORDER_FLOW',
          factor: 'Buy-Side Depth Imbalance',
          type: 'SUPPORTING',
          description: desc,
          importance: 'MEDIUM'
        });
        supportingFactors.push(desc);
      } else if (coin.orderFlow.orderBookImbalance?.state === 'SELL_SIDE_DEPTH_IMBALANCE') {
        const desc = `Sell-side depth imbalance (${(coin.orderFlow.orderBookImbalance.imbalanceRatio * 100).toFixed(0)}%) in order book`;
        evidence.push({
          category: 'ORDER_FLOW',
          factor: 'Sell-Side Depth Imbalance',
          type: 'CONFLICTING',
          description: desc,
          importance: 'MEDIUM'
        });
        conflictingFactors.push(desc);
      }
    }

    // 9. Liquidation Intelligence Evidence
    if (coin.liquidationIntel) {
      if (coin.liquidationIntel.isSpike) {
        const desc = `Elevated liquidation activity: ${coin.liquidationIntel.spikeMultiple}x 20-period baseline volume`;
        if (
          coin.liquidationIntel.context.relation === 'ELEVATED_SHORT_SIDE_LIQUIDATION_CONTEXT' ||
          coin.liquidationIntel.context.relation === 'SHORT_SQUEEZE_CONTEXT'
        ) {
          evidence.push({
            category: 'DERIVATIVES',
            factor: 'Short Liquidation Spike',
            type: 'SUPPORTING',
            description: desc,
            importance: 'HIGH'
          });
          supportingFactors.push(desc);
        } else if (
          coin.liquidationIntel.context.relation === 'ELEVATED_LONG_SIDE_LIQUIDATION_CONTEXT' ||
          coin.liquidationIntel.context.relation === 'LONG_SQUEEZE_DELEVERAGING_CONTEXT'
        ) {
          evidence.push({
            category: 'DERIVATIVES',
            factor: 'Long Liquidation Cascade',
            type: 'CONFLICTING',
            description: desc,
            importance: 'HIGH'
          });
          conflictingFactors.push(desc);
        } else {
          neutralFactors.push(desc);
        }
      }
    }

    // 10. Whale / On-Chain Evidence
    if (coin.whaleTransfers && coin.whaleTransfers.length > 0) {
      const withdrawals = coin.whaleTransfers.filter(t => t.eventType === 'EXCHANGE_WITHDRAWAL');
      const deposits = coin.whaleTransfers.filter(t => t.eventType === 'EXCHANGE_DEPOSIT');

      if (withdrawals.length >= 2 && withdrawals.length > deposits.length) {
        const desc = `Potential accumulation context: ${withdrawals.length} verified exchange withdrawals detected`;
        evidence.push({
          category: 'ON_CHAIN',
          factor: 'Whale Exchange Withdrawals',
          type: 'SUPPORTING',
          description: desc,
          importance: 'MEDIUM'
        });
        supportingFactors.push(desc);
      } else if (deposits.length >= 2 && deposits.length > withdrawals.length) {
        const desc = `Potential distribution context: ${deposits.length} verified exchange deposits detected`;
        evidence.push({
          category: 'ON_CHAIN',
          factor: 'Whale Exchange Deposits',
          type: 'CONFLICTING',
          description: desc,
          importance: 'MEDIUM'
        });
        conflictingFactors.push(desc);
      } else {
        neutralFactors.push('Whale transfers observed without persistent accumulation/distribution bias');
      }
    }

    return {
      evidence,
      supportingFactors,
      conflictingFactors,
      neutralFactors
    };
  }

  /**
   * Signal Classification into standard Bullish/Bearish/Neutral/Conflicted types
   */
  public classifySignal(
    coin: NormalizedCoinData,
    timeframes: Record<Timeframe, TimeframeSignalState>,
    mtfSummary: MultiTimeframeConfluenceSummary,
    breakout: BreakoutContext,
    deriv: DerivativesSignalContext,
    btc: BtcSignalContext,
    conflictingFactors: string[]
  ): { signalType: SignalType; direction: SignalDirection; isConflicted: boolean } {
    const isConflicted = mtfSummary.isConflicted || (mtfSummary.alignedDirection === 'BULLISH' && conflictingFactors.length >= 3);

    if (isConflicted) {
      return {
        signalType: 'CONFLICTED',
        direction: 'NEUTRAL',
        isConflicted: true
      };
    }

    // Breakout States
    if (breakout.state === 'BREAKOUT CONFIRMED' && breakout.direction === 'UP') {
      return { signalType: 'BULLISH_BREAKOUT', direction: 'BULLISH', isConflicted: false };
    }
    if (breakout.state === 'BREAKOUT CONFIRMED' && breakout.direction === 'DOWN') {
      return { signalType: 'BEARISH_BREAKDOWN', direction: 'BEARISH', isConflicted: false };
    }
    if (breakout.state === 'BREAKOUT RETEST') {
      return { signalType: breakout.direction === 'UP' ? 'BULLISH_RETEST' : 'BEARISH_RETEST_FAILURE', direction: breakout.direction === 'UP' ? 'BULLISH' : 'BEARISH', isConflicted: false };
    }
    if (breakout.state === 'POSSIBLE_FALSE_BREAKOUT') {
      return { signalType: 'WATCH_BREAKDOWN', direction: 'NEUTRAL', isConflicted: true };
    }

    const bullScore = coin.scores?.bullScore ?? 50;
    const downsideRisk = coin.scores?.downsideRiskScore ?? 35;

    // Strong Bullish Confluence
    if (mtfSummary.alignedDirection === 'BULLISH' && bullScore >= 65 && downsideRisk < 45) {
      if (coin.indicators.volumeAnalysis.ratio >= 1.5 && coin.indicators.rsi14 >= 58) {
        return { signalType: 'BULLISH_MOMENTUM', direction: 'BULLISH', isConflicted: false };
      }
      return { signalType: 'BULLISH_CONTINUATION', direction: 'BULLISH', isConflicted: false };
    }

    // Strong Bearish Confluence
    if (mtfSummary.alignedDirection === 'BEARISH' && downsideRisk >= 65 && bullScore < 40) {
      if (coin.indicators.rsi14 <= 40 && coin.indicators.volumeAnalysis.ratio >= 1.4) {
        return { signalType: 'BEARISH_MOMENTUM', direction: 'BEARISH', isConflicted: false };
      }
      return { signalType: 'BEARISH_CONTINUATION', direction: 'BEARISH', isConflicted: false };
    }

    // Reversal checks
    if (bullScore >= 55 && coin.indicators.rsi14 <= 38 && coin.indicators.volumeAnalysis.ratio >= 1.3) {
      return { signalType: 'BULLISH_REVERSAL', direction: 'BULLISH', isConflicted: false };
    }
    if (downsideRisk >= 60 && coin.indicators.rsi14 >= 68 && coin.indicators.volumeAnalysis.ratio >= 1.3) {
      return { signalType: 'BEARISH_REVERSAL', direction: 'BEARISH', isConflicted: false };
    }

    // Watch breakout/breakdown
    if (coin.marketStructure.event === 'Potential Breakout') {
      return { signalType: 'WATCH_BREAKOUT', direction: 'NEUTRAL', isConflicted: false };
    }
    if (coin.marketStructure.event === 'Potential Breakdown') {
      return { signalType: 'WATCH_BREAKDOWN', direction: 'NEUTRAL', isConflicted: false };
    }

    return { signalType: 'NEUTRAL', direction: 'NEUTRAL', isConflicted: false };
  }

  /**
   * Signal Strength calculation (0-100) based on configurable component weights
   */
  public calculateSignalStrength(
    coin: NormalizedCoinData,
    timeframes: Record<Timeframe, TimeframeSignalState>,
    mtfSummary: MultiTimeframeConfluenceSummary,
    breakout: BreakoutContext,
    deriv: DerivativesSignalContext,
    btc: BtcSignalContext,
    direction: SignalDirection,
    isConflicted: boolean,
    config: SignalEngineAdminConfig = db.signalConfig
  ): number {
    const weights = config.componentWeights;

    // 1. Trend Alignment (0-100)
    let trendScore = 50;
    if (coin.indicators.ma20 > coin.indicators.ma50 && coin.indicators.priceVsMa20 === 'above') trendScore = 90;
    else if (coin.indicators.ma20 < coin.indicators.ma50 && coin.indicators.priceVsMa20 === 'below') trendScore = 20;

    // 2. Momentum (0-100)
    let momentumScore = Math.max(0, Math.min(100, (coin.indicators.rsi14 - 30) * 2.5));

    // 3. Volume Confirmation (0-100)
    let volumeScore = Math.min(100, Math.round(coin.indicators.volumeAnalysis.ratio * 40));

    // 4. Market Structure (0-100)
    let structScore = 50;
    if (coin.marketStructure.state.includes('Higher High')) structScore = 85;
    else if (coin.marketStructure.state.includes('Higher Low')) structScore = 75;
    else if (coin.marketStructure.state.includes('Lower Low')) structScore = 15;
    else if (coin.marketStructure.state.includes('Lower High')) structScore = 25;
    if (breakout.state === 'BREAKOUT CONFIRMED' && breakout.direction === 'UP') structScore = 95;

    // 5. Derivatives (0-100)
    let derivScore = 50;
    if (deriv.openInterestAvailable) {
      if (deriv.oiPriceContext === 'LONG_BUILDUP_CONTEXT') derivScore = 80;
      else if (deriv.oiPriceContext === 'SHORT_COVERING_CONTEXT') derivScore = 65;
      else if (deriv.oiPriceContext === 'SHORT_BUILDUP_CONTEXT') derivScore = 25;
      else if (deriv.oiPriceContext === 'LONG_UNWINDING_CONTEXT') derivScore = 30;
      if (deriv.fundingContext === 'bullish crowding risk') derivScore -= 15;
    }

    // 6. Volatility (0-100)
    let volScore = 50;
    if (coin.indicators.bb.width > 0.05 && coin.indicators.bb.percentB > 0.5) volScore = 75;

    // 7. Multi-Timeframe Confluence (0-100)
    let mtfScore = mtfSummary.alignmentScore;

    // 8. BTC Context (0-100)
    let btcScore = 50;
    if (btc.contextEffect === 'SUPPORTIVE') btcScore = 80;
    else if (btc.contextEffect === 'HEADWIND') btcScore = 25;

    // Weighted combination
    const totalWeighted =
      (trendScore * weights.trendAlignment +
        momentumScore * weights.momentum +
        volumeScore * weights.volumeConfirmation +
        structScore * weights.marketStructure +
        derivScore * weights.derivatives +
        volScore * weights.volatility +
        mtfScore * weights.multiTimeframe +
        btcScore * weights.btcContext) /
      100;

    let finalStrength = Math.round(totalWeighted);

    // If conflicted, penalize signal strength toward neutral
    if (isConflicted) {
      finalStrength = Math.min(finalStrength, 48);
    }

    return Math.max(0, Math.min(100, finalStrength));
  }

  /**
   * Downside Risk Strength calculation (0-100)
   */
  public calculateDownsideStrength(
    coin: NormalizedCoinData,
    timeframes: Record<Timeframe, TimeframeSignalState>,
    mtfSummary: MultiTimeframeConfluenceSummary,
    breakout: BreakoutContext,
    deriv: DerivativesSignalContext,
    btc: BtcSignalContext,
    config: SignalEngineAdminConfig = db.signalConfig
  ): number {
    let risk = coin.scores?.downsideRiskScore ?? 35;

    if (breakout.state === 'BREAKOUT CONFIRMED' && breakout.direction === 'DOWN') {
      risk = Math.max(risk, 80);
    }
    if (deriv.openInterestAvailable && deriv.oiPriceContext === 'SHORT_BUILDUP_CONTEXT') {
      risk += 10;
    }
    if (btc.contextEffect === 'HEADWIND') {
      risk += 10;
    }
    if (coin.indicators.priceVsMa20 === 'below' && coin.indicators.priceVsMa50 === 'below') {
      risk += 10;
    }

    return Math.max(0, Math.min(100, Math.round(risk)));
  }

  /**
   * Analytical Confidence (0-100)
   * High analytical confidence means comprehensive alignment of models, NOT probability of profit.
   */
  public calculateAnalyticalConfidence(
    evidence: SignalEvidence[],
    supportingCount: number,
    conflictingCount: number,
    isCandleConfirmed: boolean,
    hasDerivatives: boolean
  ): number {
    let conf = 50;

    // More supporting factors increase analytical confidence
    conf += supportingCount * 7;
    // Conflicting factors reduce confidence
    conf -= conflictingCount * 6;
    // Confirmed candle provides higher confidence than forming candle
    if (isCandleConfirmed) conf += 10;
    else conf -= 15;
    // Derivatives data availability improves data completeness
    if (hasDerivatives) conf += 5;

    return Math.max(20, Math.min(95, Math.round(conf)));
  }

  /**
   * Price levels: Trigger, Confirmation, Invalidation
   */
  public calculateSignalLevels(
    coin: NormalizedCoinData,
    direction: SignalDirection,
    signalType: SignalType,
    breakout: BreakoutContext
  ): {
    triggerPrice: number;
    confirmationPrice: number;
    invalidationPrice?: number;
    invalidationReason?: string;
  } {
    const price = coin.price;
    const struct = coin.marketStructure;

    let triggerPrice = price;
    let confirmationPrice = price;
    let invalidationPrice: number | undefined;
    let invalidationReason: string | undefined;

    if (direction === 'BULLISH') {
      triggerPrice = breakout.breakoutLevel > 0 ? breakout.breakoutLevel : price;
      confirmationPrice = price;

      // Invalidation is below broken resistance or nearest swing low
      if (breakout.breakoutLevel > 0) {
        invalidationPrice = parseFloat((breakout.breakoutLevel * 0.985).toFixed(4));
        invalidationReason = `Confirmed candle close back below breakout level ($${breakout.breakoutLevel.toLocaleString()})`;
      } else if (struct.lastSwingLow > 0) {
        invalidationPrice = parseFloat((struct.lastSwingLow * 0.99).toFixed(4));
        invalidationReason = `Confirmed candle close below structural swing low ($${struct.lastSwingLow.toLocaleString()})`;
      } else {
        invalidationPrice = parseFloat((price * 0.965).toFixed(4));
        invalidationReason = 'Loss of key short-term technical support band (-3.5%)';
      }
    } else if (direction === 'BEARISH') {
      triggerPrice = breakout.breakoutLevel > 0 ? breakout.breakoutLevel : price;
      confirmationPrice = price;

      // Invalidation is above broken support or nearest swing high
      if (breakout.breakoutLevel > 0) {
        invalidationPrice = parseFloat((breakout.breakoutLevel * 1.015).toFixed(4));
        invalidationReason = `Confirmed candle close back above breakdown level ($${breakout.breakoutLevel.toLocaleString()})`;
      } else if (struct.lastSwingHigh > 0) {
        invalidationPrice = parseFloat((struct.lastSwingHigh * 1.01).toFixed(4));
        invalidationReason = `Confirmed candle close above structural swing high ($${struct.lastSwingHigh.toLocaleString()})`;
      } else {
        invalidationPrice = parseFloat((price * 1.035).toFixed(4));
        invalidationReason = 'Reclamation of upper resistance boundary (+3.5%)';
      }
    } else {
      triggerPrice = price;
      confirmationPrice = price;
      invalidationPrice = undefined;
      invalidationReason = 'Neutral setup: Invalidation evaluated upon directional breakout';
    }

    return {
      triggerPrice,
      confirmationPrice,
      invalidationPrice,
      invalidationReason
    };
  }

  /**
   * Target technical levels (resistance levels for bullish, support levels for bearish)
   */
  public calculateTargetLevels(
    price: number,
    direction: SignalDirection,
    struct: MarketStructure
  ): number[] {
    if (direction === 'BULLISH') {
      const targets = struct.resistanceLevels.filter(r => r > price).slice(0, 3);
      if (targets.length > 0) return targets;
      return [
        parseFloat((price * 1.025).toFixed(4)),
        parseFloat((price * 1.055).toFixed(4)),
        parseFloat((price * 1.095).toFixed(4))
      ];
    } else if (direction === 'BEARISH') {
      const targets = struct.supportLevels.filter(s => s < price).slice(0, 3);
      if (targets.length > 0) return targets;
      return [
        parseFloat((price * 0.975).toFixed(4)),
        parseFloat((price * 0.945).toFixed(4)),
        parseFloat((price * 0.905).toFixed(4))
      ];
    }
    return [];
  }

  /**
   * NO LOOK-AHEAD GUARANTEE:
   * Evaluate historical signal using strictly candles at or before timestamp T.
   */
  public evaluateSignalAtTimestamp(
    candles: Candle[],
    timestamp: number,
    symbol: string = 'BTC/USDT',
    exchange: ExchangeId = 'BINANCE',
    marketType: 'SPOT' | 'PERPETUAL' = 'SPOT'
  ): MarketSignal | null {
    // Filter candles strictly at or before timestamp T
    const validCandles = candles.filter(c => c.time <= timestamp);
    if (validCandles.length < 20) return null;

    const latest = validCandles[validCandles.length - 1];
    const prev = validCandles.length >= 2 ? validCandles[validCandles.length - 2] : latest;
    const change24h = prev.close > 0 ? ((latest.close - prev.close) / prev.close) * 100 : 0;

    const indicators = computeTechnicalIndicators(validCandles);
    const struct = this.msEngine.analyze(validCandles, '1h', 5);
    const scores = scoringEngine.computeScores(symbol, indicators, latest.close, change24h, '1h', exchange, struct, null);

    const coinData: NormalizedCoinData = {
      id: `${exchange}_${symbol}`,
      symbol,
      rawSymbol: symbol.replace('/', ''),
      baseAsset: symbol.split('/')[0] || symbol,
      quoteAsset: symbol.split('/')[1] || 'USDT',
      price: latest.close,
      change24h,
      high24h: Math.max(...validCandles.slice(-24).map(c => c.high)),
      low24h: Math.min(...validCandles.slice(-24).map(c => c.low)),
      volume24h: validCandles.slice(-24).reduce((acc, c) => acc + c.volume, 0),
      quoteVolume24h: validCandles.slice(-24).reduce((acc, c) => acc + c.volume * c.close, 0),
      exchange,
      marketType,
      source: `${exchange} Historical Engine`,
      timestamp: latest.time,
      dataStatus: 'LIVE',
      freshnessSeconds: 0,
      indicators,
      scores,
      marketStructure: struct,
      derivatives: null
    };

    return this.evaluateSignal(coinData, { '1h': validCandles }, null, true);
  }
}

export const signalEngine = new SignalEngine();
