import {
  AnalyticalSignal,
  BullBreakdown,
  BullClassification,
  Candle,
  DerivativesData,
  DownsideRiskBreakdown,
  DownsideRiskClassification,
  ExchangeId,
  MarketStructure,
  ScoreComponent,
  ScoreConfigVersion,
  ScoreSnapshot,
  TechnicalIndicators,
  Timeframe
} from '../../src/types';

export interface ScoringEngineConfig {
  trendWeight: number;      // default: 20
  rsiWeight: number;        // default: 10
  volumeWeight: number;     // default: 15
  bollingerWeight: number;  // default: 10
  momentumWeight: number;   // default: 10
  structureWeight: number;  // default: 20
  oiWeight: number;         // default: 10
  fundingWeight: number;    // default: 5
}

export interface RiskScoringConfig {
  rsiExtremeWeight: number;       // default: 20
  maBreakdownWeight: number;      // default: 20
  volumeWeaknessWeight: number;   // default: 15
  momentumLossWeight: number;     // default: 15
  supportLossWeight: number;      // default: 15
  bearishStructureWeight: number; // default: 15
  derivativesRiskWeight: number;  // default: 0
}

export const DEFAULT_PHASE2_SCORING_CONFIG: ScoringEngineConfig = {
  trendWeight: 20,
  rsiWeight: 10,
  volumeWeight: 15,
  bollingerWeight: 10,
  momentumWeight: 10,
  structureWeight: 20,
  oiWeight: 10,
  fundingWeight: 5
};

export const DEFAULT_RISK_SCORING_CONFIG: RiskScoringConfig = {
  rsiExtremeWeight: 20,
  maBreakdownWeight: 20,
  volumeWeaknessWeight: 15,
  momentumLossWeight: 15,
  supportLossWeight: 15,
  bearishStructureWeight: 15,
  derivativesRiskWeight: 0
};

export class ScoringEngine {
  private config: ScoringEngineConfig = { ...DEFAULT_PHASE2_SCORING_CONFIG };
  private riskConfig: RiskScoringConfig = { ...DEFAULT_RISK_SCORING_CONFIG };
  private bullVersion = 1;
  private riskVersion = 1;
  private history: ScoreConfigVersion[] = [
    {
      id: 'scv_init_bull',
      version: 1,
      type: 'BULL',
      changedBy: 'system',
      timestamp: Date.now() - 86400000 * 7,
      previousConfiguration: {},
      newConfiguration: { ...DEFAULT_PHASE2_SCORING_CONFIG } as unknown as Record<string, number>,
      totalWeight: 100,
      notes: 'Initial production baseline configuration'
    },
    {
      id: 'scv_init_risk',
      version: 1,
      type: 'RISK',
      changedBy: 'system',
      timestamp: Date.now() - 86400000 * 7,
      previousConfiguration: {},
      newConfiguration: { ...DEFAULT_RISK_SCORING_CONFIG } as unknown as Record<string, number>,
      totalWeight: 100,
      notes: 'Initial downside risk baseline configuration'
    }
  ];

  constructor(customConfig?: Partial<ScoringEngineConfig>, customRiskConfig?: Partial<RiskScoringConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
    if (customRiskConfig) {
      this.riskConfig = { ...this.riskConfig, ...customRiskConfig };
    }
  }

  public getConfig(): ScoringEngineConfig {
    return { ...this.config };
  }

  public getBullConfig(): ScoringEngineConfig & { version: number; totalWeight: number } {
    const total = Object.values(this.config).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
    return { ...this.config, version: this.bullVersion, totalWeight: total };
  }

  public getRiskConfig(): RiskScoringConfig & { version: number; totalWeight: number } {
    const total = Object.values(this.riskConfig).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
    return { ...this.riskConfig, version: this.riskVersion, totalWeight: total };
  }

  public getVersionHistory(): ScoreConfigVersion[] {
    return [...this.history];
  }

  public updateConfig(newConfig: Partial<ScoringEngineConfig>, changedBy = 'admin', notes?: string): ScoringEngineConfig & { version: number } {
    return this.updateBullConfig(newConfig, changedBy, notes);
  }

  public updateBullConfig(newConfig: Partial<ScoringEngineConfig>, changedBy = 'admin', notes?: string): ScoringEngineConfig & { version: number } {
    const merged = { ...this.config, ...newConfig };
    const total =
      (Number(merged.trendWeight) || 0) +
      (Number(merged.rsiWeight) || 0) +
      (Number(merged.volumeWeight) || 0) +
      (Number(merged.bollingerWeight) || 0) +
      (Number(merged.momentumWeight) || 0) +
      (Number(merged.structureWeight) || 0) +
      (Number(merged.oiWeight) || 0) +
      (Number(merged.fundingWeight) || 0);

    if (total !== 100) {
      throw new Error(`Total Bull Score weights must equal exactly 100%. Current sum: ${total}%`);
    }

    const prev = { ...this.config };
    this.bullVersion += 1;
    this.config = merged;

    const versionEntry: ScoreConfigVersion = {
      id: `scv_bull_v${this.bullVersion}_${Date.now()}`,
      version: this.bullVersion,
      type: 'BULL',
      changedBy,
      timestamp: Date.now(),
      previousConfiguration: prev as unknown as Record<string, number>,
      newConfiguration: merged as unknown as Record<string, number>,
      totalWeight: total,
      notes: notes || `Admin updated Bull Score weights (version ${this.bullVersion})`
    };
    this.history.unshift(versionEntry);

    return { ...this.config, version: this.bullVersion };
  }

  public updateRiskConfig(newConfig: Partial<RiskScoringConfig>, changedBy = 'admin', notes?: string): RiskScoringConfig & { version: number } {
    const merged = { ...this.riskConfig, ...newConfig };
    const total =
      (Number(merged.rsiExtremeWeight) || 0) +
      (Number(merged.maBreakdownWeight) || 0) +
      (Number(merged.volumeWeaknessWeight) || 0) +
      (Number(merged.momentumLossWeight) || 0) +
      (Number(merged.supportLossWeight) || 0) +
      (Number(merged.bearishStructureWeight) || 0) +
      (Number(merged.derivativesRiskWeight) || 0);

    if (total !== 100) {
      throw new Error(`Total Downside Risk weights must equal exactly 100%. Current sum: ${total}%`);
    }

    const prev = { ...this.riskConfig };
    this.riskVersion += 1;
    this.riskConfig = merged;

    const versionEntry: ScoreConfigVersion = {
      id: `scv_risk_v${this.riskVersion}_${Date.now()}`,
      version: this.riskVersion,
      type: 'RISK',
      changedBy,
      timestamp: Date.now(),
      previousConfiguration: prev as unknown as Record<string, number>,
      newConfiguration: merged as unknown as Record<string, number>,
      totalWeight: total,
      notes: notes || `Admin updated Downside Risk weights (version ${this.riskVersion})`
    };
    this.history.unshift(versionEntry);

    return { ...this.riskConfig, version: this.riskVersion };
  }

  public calculateBullScore(
    indicators: TechnicalIndicators,
    price: number,
    change24h: number,
    structure?: MarketStructure | null,
    derivatives?: DerivativesData | null
  ): {
    score: number;
    classification: BullClassification;
    breakdown: BullBreakdown;
  } {
    const {
      trendWeight,
      rsiWeight,
      volumeWeight,
      bollingerWeight,
      momentumWeight,
      structureWeight,
      oiWeight,
      fundingWeight
    } = this.config;

    // 1. Trend / Moving Averages (20%)
    let trendScore = 50;
    if (indicators.priceVsMa20 === 'above') trendScore += 15;
    if (indicators.priceVsMa50 === 'above') trendScore += 15;
    if (indicators.priceVsMa200 === 'above') trendScore += 20;
    if (indicators.maCross === 'bullish_alignment') trendScore = Math.min(100, trendScore + 10);
    if (indicators.maCross === 'golden_cross') trendScore = 100;
    if (indicators.maCross === 'bearish_alignment') trendScore = Math.max(10, trendScore - 30);
    trendScore = Math.max(0, Math.min(100, trendScore));

    const trendComponent: ScoreComponent = {
      weight: trendWeight,
      score: trendScore,
      note: `Price is ${indicators.priceVsMa20} MA20, ${indicators.priceVsMa50} MA50 (${indicators.maTrend} alignment)`
    };

    // 2. RSI (10%)
    let rsiScore = 50;
    const rsi = indicators.rsi14;
    if (rsi >= 52 && rsi <= 68) {
      rsiScore = 80 + (rsi - 50); // optimal bullish momentum zone
    } else if (rsi > 68 && rsi <= 76) {
      rsiScore = 70; // extended bullish conditions
    } else if (rsi > 76) {
      rsiScore = 40; // extreme overbought caution
    } else if (rsi >= 40 && rsi < 52) {
      rsiScore = 45;
    } else if (rsi < 35) {
      rsiScore = 25; // weak momentum
    }
    rsiScore = Math.max(0, Math.min(100, rsiScore));

    const rsiComponent: ScoreComponent = {
      weight: rsiWeight,
      score: rsiScore,
      note: `RSI14 at ${rsi} (RSI6: ${indicators.rsi6})`
    };

    // 3. Volume (15%)
    let volScore = 50;
    const volRatio = indicators.volumeAnalysis.ratio;
    if (volRatio >= 2.5) volScore = 95;
    else if (volRatio >= 1.8) volScore = 85;
    else if (volRatio >= 1.2) volScore = 70;
    else if (volRatio < 0.6) volScore = 30;
    volScore = Math.max(0, Math.min(100, volScore));

    const volumeComponent: ScoreComponent = {
      weight: volumeWeight,
      score: volScore,
      note: `Volume is ${volRatio}x the 20-period average volume`
    };

    // 4. Bollinger Bands (10%)
    let bbScore = 50;
    const pctB = indicators.bb.percentB;
    if (pctB >= 0.55 && pctB <= 0.85) bbScore = 85;
    else if (pctB > 0.85 && pctB <= 1.0) bbScore = 70;
    else if (pctB > 1.0) bbScore = 50;
    else if (pctB < 0.3) bbScore = 25;
    bbScore = Math.max(0, Math.min(100, bbScore));

    const bbComponent: ScoreComponent = {
      weight: bollingerWeight,
      score: bbScore,
      note: `Price at ${Math.round(pctB * 100)}% of Bollinger Band width`
    };

    // 5. Price Momentum (10%)
    let momentumScore = 50;
    if (change24h > 8) momentumScore = 95;
    else if (change24h > 4) momentumScore = 85;
    else if (change24h > 1.5) momentumScore = 70;
    else if (change24h < -5) momentumScore = 20;
    else if (change24h < -2) momentumScore = 35;
    momentumScore = Math.max(0, Math.min(100, momentumScore));

    const momentumComponent: ScoreComponent = {
      weight: momentumWeight,
      score: momentumScore,
      note: `24h momentum change ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%`
    };

    // 6. Market Structure (20%)
    let structScore = 50;
    let structNote = 'Baseline structure';
    if (structure) {
      if (structure.state === 'Higher High (HH)') {
        structScore = structure.event === 'Potential Breakout' ? 95 : 85;
        structNote = 'Bullish Higher High structure with upward expansion';
      } else if (structure.state === 'Higher Low (HL)') {
        structScore = 75;
        structNote = 'Higher Low established; buyer defense';
      } else if (structure.state === 'Range-Bound / Consolidation') {
        structScore = structure.event === 'Potential Retest Zone' ? 65 : 50;
        structNote = 'Consolidating within defined range';
      } else if (structure.state === 'Lower High (LH)') {
        structScore = 35;
        structNote = 'Lower High formed; selling pressure above';
      } else if (structure.state === 'Lower Low (LL)') {
        structScore = 15;
        structNote = 'Bearish Lower Low breakdown structure';
      }
    } else {
      structScore = change24h > 0 ? 60 : 40;
      structNote = 'Market structure baseline';
    }

    const structureComponent: ScoreComponent = {
      weight: structureWeight,
      score: structScore,
      note: structNote
    };

    // 7. Open Interest (10%)
    let oiScore = 50;
    let oiNote = 'Open interest neutral';
    if (derivatives && derivatives.openInterestChange24h !== null) {
      const oiChg = derivatives.openInterestChange24h;
      if (change24h > 0 && oiChg > 3) {
        oiScore = 85;
        oiNote = `Price up with +${oiChg.toFixed(1)}% OI expansion (new capital inflow)`;
      } else if (change24h > 0 && oiChg < -3) {
        oiScore = 60;
        oiNote = `Price up but OI declining (${oiChg.toFixed(1)}%), short covering dynamic`;
      } else if (change24h < 0 && oiChg > 3) {
        oiScore = 30;
        oiNote = `Price down while OI expanding (+${oiChg.toFixed(1)}%), aggressive short building`;
      } else if (change24h < 0 && oiChg < -3) {
        oiScore = 40;
        oiNote = `Deleveraging / liquidation reduction (${oiChg.toFixed(1)}%)`;
      }
    }

    const oiComponent: ScoreComponent = {
      weight: oiWeight,
      score: oiScore,
      note: oiNote
    };

    // 8. Funding Rate (5%)
    let fundingScore = 50;
    let fundingNote = 'Funding rate balanced';
    if (derivatives && derivatives.fundingRate !== null) {
      const fr = derivatives.fundingRate;
      if (fr >= 0 && fr <= 0.00015) {
        fundingScore = 80; // Healthy positive funding
        fundingNote = `Normal funding (${(fr * 100).toFixed(4)}%), sustainable positioning`;
      } else if (fr < 0) {
        fundingScore = 70; // Negative funding (short heavy, potential squeeze cushion)
        fundingNote = `Negative funding (${(fr * 100).toFixed(4)}%), shorts paying longs`;
      } else if (fr > 0.0004) {
        fundingScore = 35; // Overcrowded long positioning
        fundingNote = `Elevated funding (${(fr * 100).toFixed(4)}%), crowded longs vulnerability`;
      }
    }

    const fundingComponent: ScoreComponent = {
      weight: fundingWeight,
      score: fundingScore,
      note: fundingNote
    };

    // Total weighted aggregation
    const totalWeight =
      trendWeight +
      rsiWeight +
      volumeWeight +
      bollingerWeight +
      momentumWeight +
      structureWeight +
      oiWeight +
      fundingWeight;

    const weightedSum =
      trendScore * trendWeight +
      rsiScore * rsiWeight +
      volScore * volumeWeight +
      bbScore * bollingerWeight +
      momentumScore * momentumWeight +
      structScore * structureWeight +
      oiScore * oiWeight +
      fundingScore * fundingWeight;

    const finalScore = Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)));

    let classification: BullClassification = 'Neutral conditions';
    if (finalScore <= 30) classification = 'Weak bullish conditions';
    else if (finalScore <= 50) classification = 'Neutral conditions';
    else if (finalScore <= 70) classification = 'Positive conditions';
    else if (finalScore <= 85) classification = 'Strong bullish conditions';
    else classification = 'Very strong bullish conditions';

    return {
      score: finalScore,
      classification,
      breakdown: {
        trendMA: trendComponent,
        rsi: rsiComponent,
        volume: volumeComponent,
        bollingerBands: bbComponent,
        priceMomentum: momentumComponent,
        marketStructure: structureComponent,
        openInterest: oiComponent,
        funding: fundingComponent
      }
    };
  }

  public calculateDownsideRiskScore(
    indicators: TechnicalIndicators,
    price: number,
    change24h: number,
    structure?: MarketStructure | null,
    derivatives?: DerivativesData | null
  ): {
    score: number;
    classification: DownsideRiskClassification;
    breakdown: DownsideRiskBreakdown;
  } {
    // 1. RSI Extreme (20% weight)
    let rsiRisk = 20;
    const rsi = indicators.rsi14;
    if (rsi >= 80) rsiRisk = 90; // extreme overbought downside vulnerability
    else if (rsi >= 72) rsiRisk = 70;
    else if (rsi <= 25) rsiRisk = 75; // freefall momentum breakdown
    else if (rsi <= 35) rsiRisk = 55;
    else rsiRisk = 20;

    const rsiExtremeComp: ScoreComponent = {
      weight: 20,
      score: rsiRisk,
      note: `RSI14 at ${rsi}`
    };

    // 2. MA Breakdown (20% weight)
    let maRisk = 20;
    if (indicators.priceVsMa20 === 'below') maRisk += 25;
    if (indicators.priceVsMa50 === 'below') maRisk += 25;
    if (indicators.priceVsMa200 === 'below') maRisk += 25;
    if (indicators.maCross === 'bearish_alignment' || indicators.maCross === 'death_cross') {
      maRisk = Math.min(100, maRisk + 20);
    }
    maRisk = Math.max(0, Math.min(100, maRisk));

    const maBreakdownComp: ScoreComponent = {
      weight: 20,
      score: maRisk,
      note: `Price is below moving averages (${indicators.maTrend})`
    };

    // 3. Volume Selling Weakness (15% weight)
    let volWeaknessRisk = 25;
    if (change24h < -3 && indicators.volumeAnalysis.ratio > 1.5) {
      volWeaknessRisk = 85; // heavy distribution volume
    } else if (change24h < 0 && indicators.volumeAnalysis.ratio < 0.6) {
      volWeaknessRisk = 60; // low bid liquidity
    } else if (change24h > 2 && indicators.volumeAnalysis.ratio > 1.2) {
      volWeaknessRisk = 15;
    }

    const volumeWeaknessComp: ScoreComponent = {
      weight: 15,
      score: volWeaknessRisk,
      note: `Volume ratio is ${indicators.volumeAnalysis.ratio}x on ${change24h.toFixed(2)}% price change`
    };

    // 4. Momentum Loss (15% weight)
    let momentumLossRisk = 20;
    if (change24h < -7) momentumLossRisk = 90;
    else if (change24h < -3.5) momentumLossRisk = 70;
    else if (change24h < -1) momentumLossRisk = 45;
    else if (change24h > 3) momentumLossRisk = 10;

    const momentumLossComp: ScoreComponent = {
      weight: 15,
      score: momentumLossRisk,
      note: `24h change ${change24h.toFixed(2)}%`
    };

    // 5. Support Loss Proxy (15% weight)
    let supportRisk = 20;
    if (indicators.bb.percentB < 0.15) supportRisk = 85;
    else if (indicators.bb.percentB < 0.3) supportRisk = 65;
    else if (indicators.bb.percentB > 0.6) supportRisk = 20;

    const supportLossComp: ScoreComponent = {
      weight: 15,
      score: supportRisk,
      note: `Bollinger Band %B at ${(indicators.bb.percentB * 100).toFixed(1)}%`
    };

    // 6. Bearish Structure (15% weight)
    let structureRisk = 20;
    let structNote = 'Range structure';
    if (structure) {
      if (structure.state === 'Lower Low (LL)' || structure.event === 'Potential Breakdown') {
        structureRisk = 85;
        structNote = 'Lower Low breakdown structure detected';
      } else if (structure.state === 'Lower High (LH)') {
        structureRisk = 65;
        structNote = 'Lower High ceiling limiting upside recovery';
      } else if (structure.state === 'Higher High (HH)') {
        structureRisk = 15;
        structNote = 'Bullish structural higher highs reducing downside vulnerability';
      }
    }

    const bearishStructureComp: ScoreComponent = {
      weight: 15,
      score: structureRisk,
      note: structNote
    };

    // 7. Derivatives Risk (optional/contextual)
    let derivRisk = 20;
    let derivNote = 'Derivatives leverage neutral';
    if (derivatives) {
      if (change24h < 0 && derivatives.openInterestChange24h !== null && derivatives.openInterestChange24h > 4) {
        derivRisk = 80;
        derivNote = 'Rising open interest during price decline indicates aggressive short positioning';
      } else if (derivatives.fundingRate !== null && derivatives.fundingRate > 0.0005) {
        derivRisk = 70;
        derivNote = 'Excessively positive funding rate indicates overleveraged longs prone to squeeze';
      }
    }

    const {
      rsiExtremeWeight,
      maBreakdownWeight,
      volumeWeaknessWeight,
      momentumLossWeight,
      supportLossWeight,
      bearishStructureWeight,
      derivativesRiskWeight
    } = this.riskConfig;

    const derivativesRiskComp: ScoreComponent = {
      weight: derivativesRiskWeight,
      score: derivRisk,
      note: derivNote
    };

    // Weighted average using configured risk weights
    const totalRiskWeight =
      rsiExtremeWeight +
      maBreakdownWeight +
      volumeWeaknessWeight +
      momentumLossWeight +
      supportLossWeight +
      bearishStructureWeight +
      derivativesRiskWeight;

    const weightedSum =
      rsiRisk * rsiExtremeWeight +
      maRisk * maBreakdownWeight +
      volWeaknessRisk * volumeWeaknessWeight +
      momentumLossRisk * momentumLossWeight +
      supportRisk * supportLossWeight +
      structureRisk * bearishStructureWeight +
      derivRisk * derivativesRiskWeight;

    const finalRisk = Math.max(0, Math.min(100, Math.round(weightedSum / (totalRiskWeight || 1))));

    let classification: DownsideRiskClassification = 'Low downside pressure';
    if (finalRisk <= 30) classification = 'Low downside pressure';
    else if (finalRisk <= 50) classification = 'Moderate downside pressure';
    else if (finalRisk <= 70) classification = 'Elevated downside pressure';
    else if (finalRisk <= 85) classification = 'High downside pressure';
    else classification = 'Very high downside pressure';

    return {
      score: finalRisk,
      classification,
      breakdown: {
        rsiExtreme: rsiExtremeComp,
        maBreakdown: maBreakdownComp,
        volumeWeakness: volumeWeaknessComp,
        momentumLoss: momentumLossComp,
        supportLossProxy: supportLossComp,
        bearishStructure: bearishStructureComp,
        derivativesRisk: derivativesRiskComp
      }
    };
  }

  public deriveSignal(bullScore: number, downsideRiskScore: number): AnalyticalSignal {
    if (bullScore >= 60 && downsideRiskScore <= 45) {
      return 'Bullish conditions';
    }
    if (downsideRiskScore >= 65 || (downsideRiskScore > bullScore && downsideRiskScore >= 50)) {
      return 'Bearish conditions';
    }
    return 'Neutral conditions';
  }

  public computeScores(
    symbol: string,
    indicators: TechnicalIndicators,
    price: number,
    change24h: number,
    timeframe: Timeframe = '1h',
    exchange: ExchangeId = 'BINANCE',
    structure?: MarketStructure | null,
    derivatives?: DerivativesData | null
  ): ScoreSnapshot {
    const bull = this.calculateBullScore(indicators, price, change24h, structure, derivatives);
    const risk = this.calculateDownsideRiskScore(indicators, price, change24h, structure, derivatives);
    const signal = this.deriveSignal(bull.score, risk.score);

    return {
      id: `score_${symbol}_${Date.now()}`,
      symbol,
      exchange,
      timeframe,
      bullScore: bull.score,
      bullClassification: bull.classification,
      bullBreakdown: bull.breakdown,
      downsideRiskScore: risk.score,
      downsideRiskClassification: risk.classification,
      downsideRiskBreakdown: risk.breakdown,
      signal,
      timestamp: Date.now()
    };
  }
}

export const scoringEngine = new ScoringEngine();
