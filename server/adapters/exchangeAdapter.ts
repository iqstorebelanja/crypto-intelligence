import { Candle, ExchangeId, ExchangeMarketMetadata, TradingPair } from '../../src/types';

export interface RawTicker {
  symbol: string; // e.g. "BTC/USDT"
  rawSymbol: string; // e.g. "BTCUSDT" or "BTC-USDT"
  exchangeSymbol?: string; // original exchange specific symbol, e.g. "BTC-USDT"
  normalizedSymbol?: string; // "BTC/USDT"
  marketId?: string; // e.g. "okx_BTC-USDT"
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  bid: number | null;
  ask: number | null;
  timestamp: number;
  exchange: ExchangeId;
  marketType: 'SPOT' | 'PERPETUAL' | 'FUTURES';
}

export interface MarketStats {
  latencyMs: number;
  isHealthy: boolean;
  totalMarkets: number;
  lastCheckedAt: number;
  status: 'Operational' | 'Degraded' | 'Offline';
}

export interface OrderBook {
  symbol: string;
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][];
  timestamp: number;
}

export interface OpenInterestSnapshot {
  symbol: string;
  openInterest: number; // in base asset units
  openInterestUsd: number; // in USD
  change1hPercent: number | null;
  change4hPercent: number | null;
  change24hPercent: number | null;
  change1hAbs: number | null;
  change4hAbs: number | null;
  change24hAbs: number | null;
  timestamp: number;
}

export interface FundingRateSnapshot {
  symbol: string;
  fundingRate: number; // e.g. 0.0001 = 0.01%
  timestamp: number;
  nextFundingTime: number | null;
  trend: 'Positive' | 'Negative' | 'Neutral';
}

export interface LiquidationSnapshot {
  symbol: string;
  long24h: number | null;
  short24h: number | null;
  total24h: number | null;
  long4h: number | null;
  short4h: number | null;
  total4h: number | null;
  long1h: number | null;
  short1h: number | null;
  total1h: number | null;
  timestamp: number;
}

export interface LongShortRatioSnapshot {
  symbol: string;
  longRatio: number; // e.g. 54.2
  shortRatio: number; // e.g. 45.8
  ratio: number; // e.g. 1.18
  timestamp: number;
}

export interface IExchangeAdapter {
  id: ExchangeId;
  name: string;
  isHealthy: boolean;
  latencyMs: number;
  lastUpdated: number;

  getMarkets(): Promise<ExchangeMarketMetadata[]>;
  getTicker(symbol: string): Promise<RawTicker | null>;
  getAllTickers(): Promise<RawTicker[]>;
  getOHLCV(symbol: string, timeframe: string, limit?: number): Promise<Candle[]>;
  getOrderBook(symbol: string): Promise<OrderBook | null>;
  getOpenInterest(symbol: string): Promise<OpenInterestSnapshot | null>;
  getFundingRate(symbol: string): Promise<FundingRateSnapshot | null>;
  getLiquidations(symbol: string): Promise<LiquidationSnapshot | null>;
  getLongShortRatio(symbol: string): Promise<LongShortRatioSnapshot | null>;
  getExchangeStatus(): Promise<MarketStats>;
}

