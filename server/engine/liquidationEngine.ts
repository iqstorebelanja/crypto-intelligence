import {
  DataQualityScore,
  ExchangeId,
  LiquidationCluster,
  LiquidationEvent,
  LiquidationIntelligenceSnapshot
} from '../../src/types';

export class LiquidationEngine {
  public static readonly VERSION = 'v1.0.0';

  /**
   * Evaluates Liquidation Intelligence snapshot at given timestamp T
   */
  public evaluateLiquidations(
    symbol: string,
    exchange: ExchangeId,
    currentPrice: number,
    priceChange24h: number,
    oiChange24h: number | null,
    events: LiquidationEvent[] | null,
    baseline20PeriodAvgUsd: number = 5_000_000,
    spikeThresholdMultiple: number = 2.5,
    cutoffTimestamp?: number
  ): LiquidationIntelligenceSnapshot {
    const asOfTime = cutoffTimestamp ?? Date.now();

    // 1. Strict No-Lookahead filtering: Discard any event after cutoffTimestamp
    const validEvents = events
      ? events.filter(e => e.timestamp <= asOfTime)
      : [];

    let dataQuality: DataQualityScore = 'HIGH';
    if (!events || events.length === 0) {
      dataQuality = 'MEDIUM';
    }

    // 2. Sum up 24h & Current Period liquidations
    const oneDayAgo = asOfTime - 24 * 60 * 60 * 1000;
    const currentPeriodStart = asOfTime - 60 * 60 * 1000; // 1h period

    let long24h = 0;
    let short24h = 0;
    let currentPeriodTotal = 0;

    for (const ev of validEvents) {
      if (ev.timestamp >= oneDayAgo) {
        if (ev.side === 'LONG_LIQUIDATION') long24h += ev.notionalUsd;
        else if (ev.side === 'SHORT_LIQUIDATION') short24h += ev.notionalUsd;
      }
      if (ev.timestamp >= currentPeriodStart) {
        currentPeriodTotal += ev.notionalUsd;
      }
    }

    const total24h = long24h + short24h;

    // 3. Liquidation Spike Detection
    const baseline = baseline20PeriodAvgUsd > 0 ? baseline20PeriodAvgUsd : 1_000_000;
    const spikeMultiple = Number((currentPeriodTotal / baseline).toFixed(2));
    const isSpike = spikeMultiple >= spikeThresholdMultiple;
    const spikeStatus = isSpike ? 'ELEVATED LIQUIDATION ACTIVITY' : 'NORMAL';

    // 4. Liquidation + Price Context
    const context = this.determineLiquidationContext(
      priceChange24h,
      oiChange24h,
      long24h,
      short24h,
      isSpike
    );

    // 5. Liquidation Clusters detection around current price
    const clusters = this.detectLiquidationClusters(validEvents, currentPrice, exchange);

    // 6. Liquidation Activity Score (0-100)
    let score = Math.min(100, Math.round(
      (isSpike ? 40 : 15) +
      Math.min(35, (spikeMultiple / spikeThresholdMultiple) * 20) +
      Math.min(25, (total24h / (baseline * 10)) * 25)
    ));

    return {
      symbol,
      exchange,
      timestamp: asOfTime,
      dataQuality,
      currentPeriodLiquidationUsd: Math.round(currentPeriodTotal),
      baseline20PeriodAvgUsd: Math.round(baseline),
      spikeMultiple,
      isSpike,
      spikeStatus,
      longLiquidations24h: Math.round(long24h),
      shortLiquidations24h: Math.round(short24h),
      totalLiquidations24h: Math.round(total24h),
      context,
      clusters,
      recentEvents: validEvents.slice(-20),
      liquidationActivityScore: score
    };
  }

  /**
   * Evaluates Price + OI + Liquidation interaction
   */
  public determineLiquidationContext(
    priceChange24h: number,
    oiChange24h: number | null,
    long24h: number,
    short24h: number,
    isSpike: boolean
  ): {
    relation:
      | 'ELEVATED_LONG_SIDE_LIQUIDATION_CONTEXT'
      | 'ELEVATED_SHORT_SIDE_LIQUIDATION_CONTEXT'
      | 'SHORT_SQUEEZE_CONTEXT'
      | 'LONG_SQUEEZE_DELEVERAGING_CONTEXT'
      | 'BALANCED_LIQUIDATIONS'
      | 'INSUFFICIENT_DATA';
    description: string;
  } {
    if (oiChange24h === null) {
      if (long24h > short24h * 2 && isSpike) {
        return {
          relation: 'ELEVATED_LONG_SIDE_LIQUIDATION_CONTEXT',
          description: 'Elevated long-side liquidation activity observed during recent downward market pressure.'
        };
      }
      if (short24h > long24h * 2 && isSpike) {
        return {
          relation: 'ELEVATED_SHORT_SIDE_LIQUIDATION_CONTEXT',
          description: 'Elevated short-side liquidation activity observed during recent upward market pressure.'
        };
      }
      return {
        relation: 'BALANCED_LIQUIDATIONS',
        description: 'Liquidation distribution balanced between longs and shorts.'
      };
    }

    const priceUp = priceChange24h > 1.0;
    const priceDown = priceChange24h < -1.0;
    const oiUp = oiChange24h > 1.5;
    const oiDown = oiChange24h < -1.5;

    // Price Up + OI Up + Short Liquidations Up
    if (priceUp && oiUp && short24h > long24h) {
      return {
        relation: 'ELEVATED_SHORT_SIDE_LIQUIDATION_CONTEXT',
        description: 'Price expansion with rising open interest accompanied by short liquidations, indicating aggressive forced closure.'
      };
    }

    // Price Up + OI Down + Short Liquidations Up -> Short Squeeze
    if (priceUp && oiDown && short24h > long24h) {
      return {
        relation: 'SHORT_SQUEEZE_CONTEXT',
        description: 'Short squeeze context: price advancing while open interest declines sharply amid heavy short liquidations.'
      };
    }

    // Price Down + OI Up + Long Liquidations Up
    if (priceDown && oiUp && long24h > short24h) {
      return {
        relation: 'ELEVATED_LONG_SIDE_LIQUIDATION_CONTEXT',
        description: 'Price retreat with expanding open interest accompanied by long liquidations, indicating short accumulation pushing through long stops.'
      };
    }

    // Price Down + OI Down + Long Liquidations Up -> Long Squeeze / Deleveraging
    if (priceDown && oiDown && long24h > short24h) {
      return {
        relation: 'LONG_SQUEEZE_DELEVERAGING_CONTEXT',
        description: 'Long squeeze / cascade deleveraging: price declining while open interest collapses amid long liquidations.'
      };
    }

    return {
      relation: 'BALANCED_LIQUIDATIONS',
      description: 'Liquidation distribution across long and short positions is balanced with moderate open interest movement.'
    };
  }

  /**
   * Clusters liquidation prices into discrete bands
   */
  public detectLiquidationClusters(
    events: LiquidationEvent[],
    currentPrice: number,
    exchange: ExchangeId
  ): LiquidationCluster[] {
    if (events.length === 0 || currentPrice <= 0) return [];

    // Group into 2.5% price buckets
    const bucketSize = currentPrice * 0.025;
    const buckets: Map<number, { longs: number; shorts: number; count: number }> = new Map();

    for (const ev of events) {
      const bucketIndex = Math.floor(ev.price / bucketSize);
      const b = buckets.get(bucketIndex) || { longs: 0, shorts: 0, count: 0 };
      if (ev.side === 'LONG_LIQUIDATION') b.longs += ev.notionalUsd;
      else if (ev.side === 'SHORT_LIQUIDATION') b.shorts += ev.notionalUsd;
      b.count++;
      buckets.set(bucketIndex, b);
    }

    const clusters: LiquidationCluster[] = [];
    for (const [idx, data] of buckets.entries()) {
      const low = idx * bucketSize;
      const high = low + bucketSize;
      const total = data.longs + data.shorts;
      if (total > 500_000) {
        clusters.push({
          priceRange: [Number(low.toFixed(2)), Number(high.toFixed(2))],
          medianPrice: Number(((low + high) / 2).toFixed(2)),
          longLiquidationEstimate: Math.round(data.longs),
          shortLiquidationEstimate: Math.round(data.shorts),
          totalLiquidation: Math.round(total),
          intensity: total > 5_000_000 ? 'HIGH' : total > 2_000_000 ? 'MEDIUM' : 'LOW',
          timestamp: Date.now(),
          source: `${exchange} Liquidation Feed`
        });
      }
    }

    return clusters.sort((a, b) => b.totalLiquidation - a.totalLiquidation).slice(0, 5);
  }
}

export const liquidationEngine = new LiquidationEngine();
