import {
  DexActivityMetrics,
  DexPair,
  DexRiskFlag,
  ExternalEvidence,
  ExternalEvidenceCategory,
  ExternalEvidenceDirection,
  ExternalIntelligenceStatus,
  ExternalIntelligenceSummary,
  ExternalSourceQuality,
  WhaleAggregationMetrics,
  WhaleAggregationWindow,
  WhaleEvent
} from '../../src/types';
import { db } from '../db/schema';
import { externalIntelligenceRegistry } from '../providers/externalIntelligenceProvider';

export class ExternalIntelligenceNormalizer {
  private evidenceBuffer: Map<string, ExternalEvidence[]> = new Map(); // asset -> ExternalEvidence[]
  private summaryCache: Map<string, { summary: ExternalIntelligenceSummary; expiresAt: number }> = new Map();

  /**
   * Generates or retrieves the complete External Intelligence Summary for an asset & symbol
   */
  public async getIntelligenceSummary(
    asset: string = 'BTC',
    symbol?: string
  ): Promise<ExternalIntelligenceSummary> {
    const cleanAsset = asset.toUpperCase();
    const cleanSymbol = symbol || `${cleanAsset}/USDT`;
    const cacheKey = `${cleanAsset}:${cleanSymbol}`;

    const now = Date.now();
    const cached = this.summaryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.summary;
    }

    const whaleProvider = externalIntelligenceRegistry.getWhaleProvider();
    const dexProvider = externalIntelligenceRegistry.getDexProvider();

    // 1. Fetch Multi-Window Whale Aggregations
    const whaleAggregations: Record<WhaleAggregationWindow, WhaleAggregationMetrics | null> = {
      '5m': null,
      '15m': null,
      '1h': null,
      '4h': null,
      '24h': null
    };

    if (whaleProvider && whaleProvider.enabled) {
      const windows: WhaleAggregationWindow[] = ['5m', '15m', '1h', '4h', '24h'];
      await Promise.all(
        windows.map(async w => {
          whaleAggregations[w] = await whaleProvider.getExchangeFlows(cleanAsset, w);
        })
      );
    }

    // 2. Fetch DEX Pairs & Metrics
    let dexPairs: DexPair[] = [];
    let dexMetrics: DexActivityMetrics | null = null;
    if (dexProvider && dexProvider.enabled) {
      dexPairs = await dexProvider.getDexPairs(cleanAsset);
      dexMetrics = await dexProvider.getDexActivityMetrics(cleanAsset);
    }

    // 3. Build Normalized External Evidence
    const allEvidence: ExternalEvidence[] = [];

    // Whale / On-chain Evidence
    if (whaleProvider && whaleProvider.enabled) {
      const onchainEv = await whaleProvider.getOnchainActivity(cleanAsset);
      allEvidence.push(...onchainEv);

      const stableEv = await whaleProvider.getStablecoinFlows();
      allEvidence.push(...stableEv);
    }

    // DEX Evidence
    if (dexMetrics && dexMetrics.dexActivityScore > 0) {
      const dexDirection: ExternalEvidenceDirection =
        dexMetrics.buyPressureScore > 60
          ? 'POSITIVE'
          : dexMetrics.sellPressureScore > 60
          ? 'NEGATIVE'
          : 'NEUTRAL';

      allEvidence.push({
        id: `ev_dex_${cleanAsset}_${now}`,
        asset: cleanAsset,
        symbol: cleanSymbol,
        source: 'Decentralized Automated Market Maker (AMM) Pools',
        provider: 'generic_dex_direct',
        category: 'DEX',
        timestamp: dexMetrics.timestamp,
        observedAt: now,
        value: `${dexMetrics.buyPressureScore}% Buy Pressure`,
        unit: '%',
        direction: dexDirection,
        confidence: 78,
        freshness: dexMetrics.freshness,
        sourceQuality: dexMetrics.sourceQuality,
        description: `DEX Volume Ratio ${dexMetrics.volumeSpikeRatio}x with ${dexMetrics.buyPressureScore}% buy pressure and ${(dexMetrics.txnsImbalanceRatio * 100).toFixed(0)}% buy transaction proportion.`,
        reference: dexPairs[0]?.pairAddress ? `https://etherscan.io/address/${dexPairs[0].pairAddress}` : null
      });

      if (dexMetrics.hasNewLiquidity) {
        allEvidence.push({
          id: `ev_dex_liq_${cleanAsset}_${now}`,
          asset: cleanAsset,
          symbol: cleanSymbol,
          source: 'DEX Liquidity Watcher',
          provider: 'generic_dex_direct',
          category: 'LIQUIDITY',
          timestamp: dexMetrics.timestamp,
          observedAt: now,
          value: `+${dexMetrics.liquidityChange24hPct}%`,
          unit: '%',
          direction: 'POSITIVE',
          confidence: 82,
          freshness: dexMetrics.freshness,
          sourceQuality: 'HIGH',
          description: `Net DEX liquidity expanded by +${dexMetrics.liquidityChange24hPct}% across monitored v3 pool contracts.`,
          reference: null
        });
      }
    }

    // 4. Calculate Scores
    // Whale Activity Score (0 - 100)
    const primaryWhale = whaleAggregations['1h'] || whaleAggregations['24h'];
    let whaleActivityScore = 50;
    let flowRegime = 'BALANCED';

    if (primaryWhale) {
      flowRegime = primaryWhale.flowRegime;
      if (primaryWhale.flowRegime === 'ACCUMULATION_LEAN') {
        whaleActivityScore = Math.min(95, 60 + Math.round(primaryWhale.regimeConfidence * 0.35));
      } else if (primaryWhale.flowRegime === 'DISTRIBUTION_LEAN') {
        whaleActivityScore = Math.max(10, 40 - Math.round(primaryWhale.regimeConfidence * 0.35));
      } else {
        whaleActivityScore = 50;
      }
    }

    // DEX Activity Score (0 - 100)
    const dexActivityScore = dexMetrics ? dexMetrics.dexActivityScore : 50;

    // External Evidence Score (-100 to +100)
    const { externalScore, dominantDirection, supporting, conflicting, neutral } =
      this.evaluateEvidenceConfluence(allEvidence);

    // Save to ring buffer
    this.evidenceBuffer.set(cleanAsset, allEvidence);

    const summary: ExternalIntelligenceSummary = {
      asset: cleanAsset,
      symbol: cleanSymbol,
      whaleActivityScore,
      dexActivityScore,
      externalEvidenceScore: externalScore,
      flowRegime,
      dominantDirection,
      evidenceCount: allEvidence.length,
      supportingEvidence: supporting,
      conflictingEvidence: conflicting,
      neutralEvidence: neutral,
      whaleAggregations,
      dexMetrics,
      freshness: allEvidence.some(e => e.freshness === 'LIVE') ? 'LIVE' : 'DELAYED',
      sourceQuality: allEvidence.every(e => e.sourceQuality === 'HIGH') ? 'HIGH' : 'MEDIUM',
      lastUpdated: now
    };

    // Cache for 15 seconds to prevent runaway queries
    this.summaryCache.set(cacheKey, {
      summary,
      expiresAt: now + 15000
    });

    return summary;
  }

  /**
   * Confluence calculation of external evidence with source quality & confidence weighting
   */
  public evaluateEvidenceConfluence(evidences: ExternalEvidence[]): {
    externalScore: number; // -100 to +100
    dominantDirection: ExternalEvidenceDirection;
    supporting: ExternalEvidence[];
    conflicting: ExternalEvidence[];
    neutral: ExternalEvidence[];
  } {
    const supporting: ExternalEvidence[] = [];
    const conflicting: ExternalEvidence[] = [];
    const neutral: ExternalEvidence[] = [];

    let totalWeight = 0;
    let netScore = 0;

    for (const ev of evidences) {
      // Quality multiplier: HIGH=1.0, MEDIUM=0.6, LOW=0.2, UNKNOWN=0.1
      const qMult = {
        HIGH: 1.0,
        MEDIUM: 0.6,
        LOW: 0.2,
        UNKNOWN: 0.1
      }[ev.sourceQuality];

      // Confidence scalar (0.3 to 1.0)
      const confScalar = Math.max(0.3, ev.confidence / 100);
      const effectiveWeight = qMult * confScalar;
      totalWeight += effectiveWeight;

      if (ev.direction === 'POSITIVE') {
        supporting.push(ev);
        netScore += 100 * effectiveWeight;
      } else if (ev.direction === 'NEGATIVE') {
        conflicting.push(ev);
        netScore -= 100 * effectiveWeight;
      } else {
        neutral.push(ev);
      }
    }

    const normalizedScore = totalWeight > 0 ? Math.round(netScore / totalWeight) : 0;
    const clampedScore = Math.min(100, Math.max(-100, normalizedScore));

    const dominantDirection: ExternalEvidenceDirection =
      clampedScore > 20 ? 'POSITIVE' : clampedScore < -20 ? 'NEGATIVE' : 'NEUTRAL';

    return {
      externalScore: clampedScore,
      dominantDirection,
      supporting,
      conflicting,
      neutral
    };
  }

  /**
   * Audit safety flags for DEX token pairs
   */
  public auditDexSafety(pair: DexPair): DexRiskFlag[] {
    const flags: DexRiskFlag[] = [];

    if (pair.liquidityUsd < 50_000) {
      flags.push('LOW_LIQUIDITY');
    }
    if (pair.volume24h > pair.liquidityUsd * 8) {
      flags.push('EXTREME_PRICE_IMPACT');
    }
    if (pair.buys24h > 0 && pair.sells24h === 0) {
      flags.push('EXTREME_BUY_SELL_IMBALANCE');
    }
    if (Date.now() - pair.timestamp > 120_000) {
      flags.push('STALE_DATA');
    }

    return flags;
  }
}

export const externalIntelligenceNormalizer = new ExternalIntelligenceNormalizer();
