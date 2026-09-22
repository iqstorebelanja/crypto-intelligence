import { Candle, ExchangeId, ExchangeMarketMetadata } from '../../src/types';
import {
  FundingRateSnapshot,
  IExchangeAdapter,
  LiquidationSnapshot,
  LongShortRatioSnapshot,
  MarketStats,
  OpenInterestSnapshot,
  OrderBook,
  RawTicker
} from './exchangeAdapter';

export { BybitAdapter, bybitAdapter } from './bybitAdapter';
export { OKXAdapter, okxAdapter } from './okxAdapter';
export { PionexAdapter, pionexAdapter } from './pionexAdapter';

abstract class BaseFutureExchangeAdapter implements IExchangeAdapter {
  abstract id: ExchangeId;
  abstract name: string;
  isHealthy = false;
  latencyMs = 0;
  lastUpdated = 0;

  async getMarkets(): Promise<ExchangeMarketMetadata[]> {
    return [];
  }

  async getTicker(symbol: string): Promise<RawTicker | null> {
    return null;
  }

  async getAllTickers(): Promise<RawTicker[]> {
    return [];
  }

  async getOHLCV(symbol: string, timeframe: string, limit?: number): Promise<Candle[]> {
    return [];
  }

  async getOrderBook(symbol: string): Promise<OrderBook | null> {
    return null;
  }

  async getOpenInterest(symbol: string): Promise<OpenInterestSnapshot | null> {
    return null;
  }

  async getFundingRate(symbol: string): Promise<FundingRateSnapshot | null> {
    return null;
  }

  async getLiquidations(symbol: string): Promise<LiquidationSnapshot | null> {
    return null;
  }

  async getLongShortRatio(symbol: string): Promise<LongShortRatioSnapshot | null> {
    return null;
  }

  async getExchangeStatus(): Promise<MarketStats> {
    return this.getMarketStats();
  }

  async getMarketStats(): Promise<MarketStats> {
    return {
      latencyMs: 0,
      isHealthy: false,
      totalMarkets: 0,
      lastCheckedAt: Date.now(),
      status: 'Offline'
    };
  }
}

export class CoinbaseAdapter extends BaseFutureExchangeAdapter {
  id: ExchangeId = 'COINBASE';
  name = 'Coinbase (Future Expansion)';
}

export class KrakenAdapter extends BaseFutureExchangeAdapter {
  id: ExchangeId = 'KRAKEN';
  name = 'Kraken (Future Expansion)';
}

export class BitgetAdapter extends BaseFutureExchangeAdapter {
  id: ExchangeId = 'BITGET';
  name = 'Bitget (Future Expansion)';
}

export class KuCoinAdapter extends BaseFutureExchangeAdapter {
  id: ExchangeId = 'KUCOIN';
  name = 'KuCoin (Future Expansion)';
}
