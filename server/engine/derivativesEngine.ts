import {
  DerivativesData,
  ExchangeId,
  PriceOiRelation,
  Timeframe
} from '../../src/types';
import {
  FundingRateSnapshot,
  LiquidationSnapshot,
  LongShortRatioSnapshot,
  OpenInterestSnapshot
} from '../adapters/exchangeAdapter';

export class DerivativesEngine {
  public interpretPriceAndOpenInterest(
    priceChange24h: number,
    oiChange24h: number | null
  ): { relation: PriceOiRelation; interpretation: string } {
    if (oiChange24h === null || isNaN(oiChange24h)) {
      return {
        relation: 'Neutral',
        interpretation: 'Open interest historical change data unavailable for structural correlation.'
      };
    }

    const priceUp = priceChange24h > 0.5;
    const priceDown = priceChange24h < -0.5;
    const oiUp = oiChange24h > 0.5;
    const oiDown = oiChange24h < -0.5;

    if (priceUp && oiUp) {
      return {
        relation: 'Price_Up_OI_Up',
        interpretation: 'Price and open interest are both increasing. This indicates increasing derivatives positioning and fresh capital inflow supporting the upward move.'
      };
    }

    if (priceDown && oiUp) {
      return {
        relation: 'Price_Down_OI_Up',
        interpretation: 'Price is falling while open interest is increasing. This indicates increasing derivatives positioning during price weakness, consistent with aggressive short expansion.'
      };
    }

    if (priceUp && oiDown) {
      return {
        relation: 'Price_Up_OI_Down',
        interpretation: 'Price is increasing while open interest is declining. This may be consistent with position closing or short covering rather than aggressive new spot accumulation.'
      };
    }

    if (priceDown && oiDown) {
      return {
        relation: 'Price_Down_OI_Down',
        interpretation: 'Price and open interest are both declining. This may be consistent with position reduction, de-risking, or liquidation.'
      };
    }

    return {
      relation: 'Neutral',
      interpretation: 'Price and open interest fluctuate within balanced neutral thresholds.'
    };
  }

  public assembleDerivativesData(
    symbol: string,
    exchange: ExchangeId,
    price: number,
    priceChange24h: number,
    oiSnapshot: OpenInterestSnapshot | null,
    fundingSnapshot: FundingRateSnapshot | null,
    longShortSnapshot: LongShortRatioSnapshot | null,
    liquidationSnapshot: LiquidationSnapshot | null
  ): DerivativesData | null {
    // If no derivatives data from any source
    if (!oiSnapshot && !fundingSnapshot && !longShortSnapshot && !liquidationSnapshot) {
      return null;
    }

    const now = Date.now();
    const latestTimestamp = Math.max(
      oiSnapshot?.timestamp || 0,
      fundingSnapshot?.timestamp || 0,
      longShortSnapshot?.timestamp || 0,
      liquidationSnapshot?.timestamp || 0,
      now
    );

    const freshnessSeconds = Math.max(0, Math.floor((now - latestTimestamp) / 1000));
    const dataStatus: 'LIVE' | 'DATA DELAYED' | 'UNAVAILABLE' =
      freshnessSeconds > 60 ? 'DATA DELAYED' : 'LIVE';

    const oiChange24h = oiSnapshot?.change24hPercent ?? null;
    const { relation, interpretation } = this.interpretPriceAndOpenInterest(priceChange24h, oiChange24h);

    return {
      symbol,
      exchange,
      marketType: 'PERPETUAL',
      source: `${exchange === 'BINANCE' ? 'Binance Futures API' : 'Bybit Linear v5'}`,
      timestamp: latestTimestamp,
      openInterest: oiSnapshot?.openInterest ?? null,
      openInterestUsd: oiSnapshot?.openInterestUsd ?? null,
      openInterestChange1h: oiSnapshot?.change1hPercent ?? null,
      openInterestChange4h: oiSnapshot?.change4hPercent ?? null,
      openInterestChange24h: oiSnapshot?.change24hPercent ?? null,
      openInterestChange1hAbs: oiSnapshot?.change1hAbs ?? null,
      openInterestChange4hAbs: oiSnapshot?.change4hAbs ?? null,
      openInterestChange24hAbs: oiSnapshot?.change24hAbs ?? null,
      fundingRate: fundingSnapshot?.fundingRate ?? null,
      fundingTimestamp: fundingSnapshot?.timestamp ?? null,
      fundingTrend: fundingSnapshot?.trend ?? 'Neutral',
      nextFundingTime: fundingSnapshot?.nextFundingTime ?? null,
      longShortRatio: longShortSnapshot
        ? {
            longRatio: longShortSnapshot.longRatio,
            shortRatio: longShortSnapshot.shortRatio,
            ratio: longShortSnapshot.ratio,
            timestamp: longShortSnapshot.timestamp
          }
        : null,
      liquidations: liquidationSnapshot
        ? {
            long24h: liquidationSnapshot.long24h,
            short24h: liquidationSnapshot.short24h,
            total24h: liquidationSnapshot.total24h,
            long4h: liquidationSnapshot.long4h,
            short4h: liquidationSnapshot.short4h,
            total4h: liquidationSnapshot.total4h,
            long1h: liquidationSnapshot.long1h,
            short1h: liquidationSnapshot.short1h,
            total1h: liquidationSnapshot.total1h,
            timestamp: liquidationSnapshot.timestamp
          }
        : null,
      priceOiRelation: relation,
      priceOiInterpretation: interpretation,
      freshnessSeconds,
      dataStatus
    };
  }
}

export const derivativesEngine = new DerivativesEngine();
