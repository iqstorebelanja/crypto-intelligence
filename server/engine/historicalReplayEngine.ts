import {
  Candle,
  DerivativesData,
  ExchangeId,
  HistoricalPeriod,
  HistoricalSignalSnapshot,
  IndicatorConditionResult,
  MarketStructure,
  MarketStructureValidationResult,
  OiPriceCombinationResult,
  ScoreBucketResult,
  StatisticalSummary,
  Timeframe,
  ValidationHorizon,
  ValidationRunRequest,
  ValidationRunResponse
} from '../../src/types';
import { computeTechnicalIndicators } from './technicalIndicators';
import { MarketStructureEngine } from './marketStructure';
import { scoringEngine } from './scoringEngine';
import { historicalDataService, HistoricalCandleData } from '../services/historicalDataService';
import { outcomeEngine, OutcomeEngine } from './outcomeEngine';

export class HistoricalReplayEngine {
  private msEngine = new MarketStructureEngine(5);
  public static readonly INDICATOR_CONFIG_VERSION = 1;
  public static readonly MARKET_STRUCTURE_CONFIG_VERSION = 1;

  /**
   * Primary execution method for historical validation run
   */
  public async runValidation(request: ValidationRunRequest): Promise<ValidationRunResponse> {
    const startTime = Date.now();
    const {
      symbol,
      exchange = 'BINANCE',
      timeframe = '1h',
      period = '30d',
      selectedHorizon = '24h',
      modelVersion,
      customFilters
    } = request;

    // 1. Fetch historical OHLCV data from the real exchange adapter
    let historicalData: HistoricalCandleData;
    try {
      historicalData = await historicalDataService.getHistoricalData(
        symbol,
        exchange,
        timeframe,
        period
      );
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Historical data unavailable for the selected period.',
        metadata: {
          symbol,
          exchange,
          timeframe,
          period,
          selectedHorizon,
          totalCandles: 0,
          totalSignalsEvaluated: 0,
          dateRange: { start: 0, end: 0 },
          scoringConfigVersion: scoringEngine.getBullConfig().version,
          indicatorConfigVersion: HistoricalReplayEngine.INDICATOR_CONFIG_VERSION,
          marketStructureConfigVersion: HistoricalReplayEngine.MARKET_STRUCTURE_CONFIG_VERSION,
          modelVersionLabel: modelVersion || `Bull Score Model v${scoringEngine.getBullConfig().version}.0`,
          derivativesDataStatus: 'N/A',
          executionTimeMs: Date.now() - startTime
        },
        overallStats: outcomeEngine.calculateStatistics([]),
        bullScoreBuckets: [],
        downsideRiskBuckets: [],
        indicatorConditions: [],
        oiPriceDynamics: [],
        marketStructureResults: [],
        recentSnapshots: []
      };
    }

    const { candles, derivativesHistorical } = historicalData;

    // Need at least 35 candles to build baseline indicators (MA, RSI, BB)
    const MIN_START_INDEX = 35;
    if (candles.length < MIN_START_INDEX + 5) {
      return {
        success: false,
        error: 'Historical data unavailable for the selected period.',
        metadata: {
          symbol,
          exchange,
          timeframe,
          period,
          selectedHorizon,
          totalCandles: candles.length,
          totalSignalsEvaluated: 0,
          dateRange: { start: 0, end: 0 },
          scoringConfigVersion: scoringEngine.getBullConfig().version,
          indicatorConfigVersion: HistoricalReplayEngine.INDICATOR_CONFIG_VERSION,
          marketStructureConfigVersion: HistoricalReplayEngine.MARKET_STRUCTURE_CONFIG_VERSION,
          modelVersionLabel: modelVersion || `Bull Score Model v${scoringEngine.getBullConfig().version}.0`,
          derivativesDataStatus: 'N/A',
          executionTimeMs: Date.now() - startTime
        },
        overallStats: outcomeEngine.calculateStatistics([]),
        bullScoreBuckets: [],
        downsideRiskBuckets: [],
        indicatorConditions: [],
        oiPriceDynamics: [],
        marketStructureResults: [],
        recentSnapshots: []
      };
    }

    // 2. Replay loop: Calculate Point-in-Time signals for each candle
    const snapshots: HistoricalSignalSnapshot[] = [];
    const currentScoringVersion = scoringEngine.getBullConfig().version;
    let derivativesAvailable = false;

    for (let i = MIN_START_INDEX; i < candles.length; i++) {
      const currentCandle = candles[i];
      const prevCandle = candles[i - 1];

      // Point-in-Time slice: strictly candles 0 to i
      // We take up to 250 past candles for MA200 and swing detection to prevent memory bloat
      const windowStart = Math.max(0, i - 250);
      const pointInTimeCandles = candles.slice(windowStart, i + 1);

      // Compute production indicators (RSI, MA20, MA50, MA200, BB, Volume Ratio)
      const indicators = computeTechnicalIndicators(pointInTimeCandles);

      // Compute production market structure with look-ahead protection
      const structure = this.msEngine.analyze(pointInTimeCandles, timeframe, 5);

      // Point-in-Time 24h change estimate from candles
      const tfMs = OutcomeEngine.HORIZON_MS['1h'];
      const candles24h = Math.max(1, Math.round((24 * tfMs) / (candles[1].time - candles[0].time || tfMs)));
      const refCandle24h = candles[Math.max(0, i - candles24h)];
      const change24h = refCandle24h && refCandle24h.close > 0
        ? ((currentCandle.close - refCandle24h.close) / refCandle24h.close) * 100
        : 0;

      // Extract real historical derivatives if present
      let derivData: DerivativesData | null = null;
      let oiVal: number | null = null;
      let oiChangeVal: number | null = null;
      let fundingVal: number | null = null;

      if (derivativesHistorical) {
        const histDeriv = derivativesHistorical.get(currentCandle.time);
        if (histDeriv) {
          derivativesAvailable = true;
          oiVal = histDeriv.openInterest;
          fundingVal = histDeriv.fundingRate;

          // Find earlier OI for change rate
          const prevDeriv = derivativesHistorical.get(candles[Math.max(0, i - 1)].time);
          if (oiVal !== null && prevDeriv && prevDeriv.openInterest !== null && prevDeriv.openInterest > 0) {
            oiChangeVal = ((oiVal - prevDeriv.openInterest) / prevDeriv.openInterest) * 100;
          }

          derivData = {
            symbol: historicalData.symbol,
            exchange,
            marketType: 'PERPETUAL',
            source: 'Exchange Historical Feed',
            timestamp: currentCandle.time,
            openInterest: oiVal,
            openInterestUsd: oiVal,
            openInterestChange1h: null,
            openInterestChange4h: null,
            openInterestChange24h: oiChangeVal,
            openInterestChange1hAbs: null,
            openInterestChange4hAbs: null,
            openInterestChange24hAbs: null,
            fundingRate: fundingVal,
            fundingTimestamp: currentCandle.time,
            fundingTrend: (fundingVal || 0) > 0 ? 'Positive' : 'Negative',
            nextFundingTime: null,
            longShortRatio: null,
            liquidations: null,
            priceOiRelation: 'Neutral',
            priceOiInterpretation: 'Historical OI calculation',
            freshnessSeconds: 0,
            dataStatus: 'LIVE'
          };
        }
      }

      // Compute production Bull Score & Downside Risk Score
      const bullRes = scoringEngine.calculateBullScore(
        indicators,
        currentCandle.close,
        change24h,
        structure,
        derivData
      );

      const riskRes = scoringEngine.calculateDownsideRiskScore(
        indicators,
        currentCandle.close,
        change24h,
        structure,
        derivData
      );

      // Measure Forward Outcomes across all standard horizons
      const outcomes = outcomeEngine.measureAllHorizons(candles, i);

      // Classify signal description
      let signalDesc = 'Neutral conditions';
      if (bullRes.score >= 70) signalDesc = 'Bullish condition';
      else if (riskRes.score >= 65) signalDesc = 'Elevated downside pressure';
      else if (bullRes.score <= 35) signalDesc = 'Weak bullish condition';

      const snapshot: HistoricalSignalSnapshot = {
        id: `hss_${symbol}_${currentCandle.time}`,
        symbol,
        exchange,
        marketType: exchange === 'BYBIT' ? 'PERPETUAL' : 'SPOT',
        timeframe,
        timestamp: currentCandle.time,
        price: currentCandle.close,
        RSI6: Math.round(indicators.rsi6 * 10) / 10,
        RSI14: Math.round(indicators.rsi14 * 10) / 10,
        MA20: Math.round(indicators.ma20 * 100) / 100,
        MA50: Math.round(indicators.ma50 * 100) / 100,
        MA200: Math.round(indicators.ma200 * 100) / 100,
        BBUpper: Math.round(indicators.bb.upper * 100) / 100,
        BBMiddle: Math.round(indicators.bb.middle * 100) / 100,
        BBLower: Math.round(indicators.bb.lower * 100) / 100,
        volume: currentCandle.volume,
        averageVolume: Math.round(indicators.volumeAnalysis.average20 * 100) / 100,
        volumeRatio: Math.round(indicators.volumeAnalysis.ratio * 100) / 100,
        openInterest: oiVal,
        openInterestChange: oiChangeVal !== null ? Math.round(oiChangeVal * 100) / 100 : null,
        fundingRate: fundingVal,
        liquidations: null, // N/A if unavailable
        marketStructure: structure.state,
        support: structure.nearestSupport?.price || 0,
        resistance: structure.nearestResistance?.price || 0,
        bullScore: bullRes.score,
        downsideRisk: riskRes.score,
        signal: signalDesc,
        scoringConfigVersion: currentScoringVersion,
        indicatorConfigVersion: HistoricalReplayEngine.INDICATOR_CONFIG_VERSION,
        marketStructureConfigVersion: HistoricalReplayEngine.MARKET_STRUCTURE_CONFIG_VERSION,
        outcomes
      };

      snapshots.push(snapshot);
    }

    // 3. Aggregate Outcomes for Selected Horizon
    // Only include snapshots where the forward outcome for selectedHorizon is available
    const evaluatedSnapshots = snapshots.filter(s => s.outcomes[selectedHorizon] !== null);
    const returnsForSelectedHorizon = evaluatedSnapshots.map(s => s.outcomes[selectedHorizon]!.percentageReturn);
    const mfes = evaluatedSnapshots.map(s => s.outcomes[selectedHorizon]!.mfe);
    const maes = evaluatedSnapshots.map(s => s.outcomes[selectedHorizon]!.mae);

    const overallStats = outcomeEngine.calculateStatistics(returnsForSelectedHorizon, mfes, maes);

    // 4. Score Bucket Analysis (Bull Score & Downside Risk)
    // Bull Score Buckets: 0–30, 31–50, 51–70, 71–85, 86–100
    const bullBucketsDefs = [
      { range: '0–30', min: 0, max: 30 },
      { range: '31–50', min: 31, max: 50 },
      { range: '51–70', min: 51, max: 70 },
      { range: '71–85', min: 71, max: 85 },
      { range: '86–100', min: 86, max: 100 }
    ];

    const bullScoreBuckets: ScoreBucketResult[] = bullBucketsDefs.map(b => {
      const matched = evaluatedSnapshots.filter(s => s.bullScore >= b.min && s.bullScore <= b.max);
      const rets = matched.map(s => s.outcomes[selectedHorizon]!.percentageReturn);
      const bMfes = matched.map(s => s.outcomes[selectedHorizon]!.mfe);
      const bMaes = matched.map(s => s.outcomes[selectedHorizon]!.mae);
      return {
        bucketRange: b.range,
        minScore: b.min,
        maxScore: b.max,
        stats: outcomeEngine.calculateStatistics(rets, bMfes, bMaes)
      };
    });

    // Downside Risk Buckets: 0–30, 31–50, 51–70, 71–85, 86–100
    const downsideRiskBuckets: ScoreBucketResult[] = bullBucketsDefs.map(b => {
      const matched = evaluatedSnapshots.filter(s => s.downsideRisk >= b.min && s.downsideRisk <= b.max);
      const rets = matched.map(s => s.outcomes[selectedHorizon]!.percentageReturn);
      const bMfes = matched.map(s => s.outcomes[selectedHorizon]!.mfe);
      const bMaes = matched.map(s => s.outcomes[selectedHorizon]!.mae);
      return {
        bucketRange: b.range,
        minScore: b.min,
        maxScore: b.max,
        stats: outcomeEngine.calculateStatistics(rets, bMfes, bMaes)
      };
    });

    // 5. Indicator Validation Conditions
    const indicatorConditionsDefs = [
      {
        name: 'RSI14 < 30',
        desc: 'Oversold condition on 14-period RSI',
        filter: (s: HistoricalSignalSnapshot) => s.RSI14 < 30
      },
      {
        name: 'RSI14 > 70',
        desc: 'Overbought condition on 14-period RSI',
        filter: (s: HistoricalSignalSnapshot) => s.RSI14 > 70
      },
      {
        name: 'Price > MA20',
        desc: 'Price trading above 20-period Moving Average',
        filter: (s: HistoricalSignalSnapshot) => s.price > s.MA20 && s.MA20 > 0
      },
      {
        name: 'Price > MA50',
        desc: 'Price trading above 50-period Moving Average',
        filter: (s: HistoricalSignalSnapshot) => s.price > s.MA50 && s.MA50 > 0
      },
      {
        name: 'Price > MA200',
        desc: 'Price trading above 200-period Moving Average',
        filter: (s: HistoricalSignalSnapshot) => s.price > s.MA200 && s.MA200 > 0
      },
      {
        name: 'Volume Ratio > 2.0',
        desc: 'Volume exceeding twice the 20-period average volume',
        filter: (s: HistoricalSignalSnapshot) => s.volumeRatio > 2.0
      },
      {
        name: 'Volume Ratio > 3.0',
        desc: 'Severe volume expansion (> 3x average)',
        filter: (s: HistoricalSignalSnapshot) => s.volumeRatio > 3.0
      },
      {
        name: 'Price above MA20 + MA50',
        desc: 'Confluence of price holding above both short and mid trend baselines',
        filter: (s: HistoricalSignalSnapshot) => s.price > s.MA20 && s.price > s.MA50 && s.MA20 > 0 && s.MA50 > 0
      },
      {
        name: 'RSI < 65 + Volume Ratio > 2.0',
        desc: 'High volume surge without reaching overbought threshold',
        filter: (s: HistoricalSignalSnapshot) => s.RSI14 < 65 && s.volumeRatio > 2.0
      }
    ];

    const indicatorConditions: IndicatorConditionResult[] = indicatorConditionsDefs.map(c => {
      const matched = evaluatedSnapshots.filter(c.filter);
      const rets = matched.map(s => s.outcomes[selectedHorizon]!.percentageReturn);
      const cMfes = matched.map(s => s.outcomes[selectedHorizon]!.mfe);
      const cMaes = matched.map(s => s.outcomes[selectedHorizon]!.mae);
      return {
        conditionName: c.name,
        description: c.desc,
        stats: outcomeEngine.calculateStatistics(rets, cMfes, cMaes)
      };
    });

    // 6. OI + Price Validation (Derivatives Dynamics)
    // Combinations:
    // Price ↑ + OI ↑
    // Price ↓ + OI ↑
    // Price ↑ + OI ↓
    // Price ↓ + OI ↓
    const oiPriceDynamics: OiPriceCombinationResult[] = [
      {
        combination: 'Price ↑ + OI ↑',
        description: 'New capital inflow driving upward price expansion',
        stats: this.evalOiPriceCombo(evaluatedSnapshots, selectedHorizon, true, true)
      },
      {
        combination: 'Price ↓ + OI ↑',
        description: 'Aggressive short positioning building into price drop',
        stats: this.evalOiPriceCombo(evaluatedSnapshots, selectedHorizon, false, true)
      },
      {
        combination: 'Price ↑ + OI ↓',
        description: 'Short covering / position liquidation fueling price bounce',
        stats: this.evalOiPriceCombo(evaluatedSnapshots, selectedHorizon, true, false)
      },
      {
        combination: 'Price ↓ + OI ↓',
        description: 'Long liquidation and deleveraging pressure',
        stats: this.evalOiPriceCombo(evaluatedSnapshots, selectedHorizon, false, false)
      }
    ];

    // 7. Market Structure Validation
    const msCategories = [
      'Higher High (HH)',
      'Higher Low (HL)',
      'Lower High (LH)',
      'Lower Low (LL)',
      'Range-Bound / Consolidation'
    ];

    const marketStructureResults: MarketStructureValidationResult[] = msCategories.map(cat => {
      const matched = evaluatedSnapshots.filter(s => s.marketStructure.includes(cat) || s.marketStructure === cat);
      const rets = matched.map(s => s.outcomes[selectedHorizon]!.percentageReturn);
      const msMfes = matched.map(s => s.outcomes[selectedHorizon]!.mfe);
      const msMaes = matched.map(s => s.outcomes[selectedHorizon]!.mae);
      return {
        structureType: cat,
        stats: outcomeEngine.calculateStatistics(rets, msMfes, msMaes)
      };
    });

    // 8. Custom Filter Execution (if supplied)
    let customFilterStats: StatisticalSummary | null = null;
    if (customFilters) {
      const customMatched = evaluatedSnapshots.filter(s => {
        if (customFilters.minBullScore !== null && customFilters.minBullScore !== undefined && s.bullScore < customFilters.minBullScore) return false;
        if (customFilters.maxBullScore !== null && customFilters.maxBullScore !== undefined && s.bullScore > customFilters.maxBullScore) return false;
        if (customFilters.minDownsideRisk !== null && customFilters.minDownsideRisk !== undefined && s.downsideRisk < customFilters.minDownsideRisk) return false;
        if (customFilters.maxDownsideRisk !== null && customFilters.maxDownsideRisk !== undefined && s.downsideRisk > customFilters.maxDownsideRisk) return false;
        if (customFilters.minVolumeRatio !== null && customFilters.minVolumeRatio !== undefined && s.volumeRatio < customFilters.minVolumeRatio) return false;
        if (customFilters.maxRsi14 !== null && customFilters.maxRsi14 !== undefined && s.RSI14 > customFilters.maxRsi14) return false;
        if (customFilters.minRsi14 !== null && customFilters.minRsi14 !== undefined && s.RSI14 < customFilters.minRsi14) return false;
        if (customFilters.marketStructure && s.marketStructure !== customFilters.marketStructure) return false;
        if (customFilters.aboveMa20 === true && s.price <= s.MA20) return false;
        if (customFilters.aboveMa50 === true && s.price <= s.MA50) return false;
        if (customFilters.aboveMa200 === true && s.price <= s.MA200) return false;
        return true;
      });

      const cRets = customMatched.map(s => s.outcomes[selectedHorizon]!.percentageReturn);
      const cMfes = customMatched.map(s => s.outcomes[selectedHorizon]!.mfe);
      const cMaes = customMatched.map(s => s.outcomes[selectedHorizon]!.mae);
      customFilterStats = outcomeEngine.calculateStatistics(cRets, cMfes, cMaes);
    }

    // 9. Take a sample of snapshots (up to 50 recent) for detailed table inspection
    const recentSnapshots = snapshots.slice(-50).reverse();

    return {
      success: true,
      metadata: {
        symbol,
        exchange,
        timeframe,
        period,
        selectedHorizon,
        totalCandles: candles.length,
        totalSignalsEvaluated: evaluatedSnapshots.length,
        dateRange: {
          start: candles[0].time,
          end: candles[candles.length - 1].time
        },
        scoringConfigVersion: currentScoringVersion,
        indicatorConfigVersion: HistoricalReplayEngine.INDICATOR_CONFIG_VERSION,
        marketStructureConfigVersion: HistoricalReplayEngine.MARKET_STRUCTURE_CONFIG_VERSION,
        modelVersionLabel: modelVersion || `Bull Score Model v${currentScoringVersion}.0`,
        derivativesDataStatus: derivativesAvailable ? 'AVAILABLE' : 'N/A',
        executionTimeMs: Date.now() - startTime
      },
      overallStats,
      bullScoreBuckets,
      downsideRiskBuckets,
      indicatorConditions,
      oiPriceDynamics,
      marketStructureResults,
      recentSnapshots,
      customFilterStats
    };
  }

  /**
   * Helper to evaluate OI + Price combination outcomes
   */
  private evalOiPriceCombo(
    snapshots: HistoricalSignalSnapshot[],
    horizon: ValidationHorizon,
    priceUp: boolean,
    oiUp: boolean
  ): StatisticalSummary {
    const matched = snapshots.filter(s => {
      // Must have OI change data available
      if (s.openInterestChange === null) return false;
      const isPriceUp = s.price > s.MA20; // or short-term momentum
      const isOiUp = s.openInterestChange > 0;
      return isPriceUp === priceUp && isOiUp === oiUp;
    });

    const rets = matched.map(s => s.outcomes[horizon]!.percentageReturn);
    const mfes = matched.map(s => s.outcomes[horizon]!.mfe);
    const maes = matched.map(s => s.outcomes[horizon]!.mae);
    return outcomeEngine.calculateStatistics(rets, mfes, maes);
  }
}

export const historicalReplayEngine = new HistoricalReplayEngine();
