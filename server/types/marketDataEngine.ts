import { ExchangeId, Timeframe } from '../../src/types';

export type NormalizedMarketType = 'SPOT' | 'PERPETUAL' | 'FUTURES' | 'SWAP';

export type DataFreshnessStatus = 'LIVE' | 'DELAYED' | 'STALE' | 'UNAVAILABLE' | 'ERROR';

export type CandleState = 'FORMING' | 'CONFIRMED';

export interface DataFreshnessRecord {
  timestamp: number;
  receivedAt: number;
  source: string;
  latencyMs: number;
  status: DataFreshnessStatus;
}

export interface MarketObservation {
  exchange: ExchangeId;
  marketId: string;
  exchangeSymbol: string;
  normalizedSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  marketType: NormalizedMarketType;
  timestamp: number;
  source: string;

  // Actual available fields (null if unavailable, NEVER fabricated)
  lastPrice: number;
  bid: number | null;
  ask: number | null;
  bidVolume: number | null;
  askVolume: number | null;
  bestBid: number | null;
  bestAsk: number | null;

  volume24h: number;
  quoteVolume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;

  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount: number | null;

  fundingRate: number | null;
  openInterest: number | null;
  openInterestValue: number | null;
  longShortRatio: number | null;
  liquidations: number | null;
  longLiquidations: number | null;
  shortLiquidations: number | null;
  markPrice: number | null;
  indexPrice: number | null;

  freshness: DataFreshnessRecord;
}

export interface NormalizedEngineCandle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
  candleState: CandleState;
  exchange: ExchangeId;
  market: string;
  timeframe: Timeframe;
}

export interface MarketTrade {
  id: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface ExchangeCapabilities {
  exchange: ExchangeId;
  spot: boolean;
  futures: boolean;
  perpetual: boolean;
  swap: boolean;
  ohlcv: boolean;
  openInterest: boolean;
  funding: boolean;
  liquidations: boolean;
  orderBook: boolean;
  trades: boolean;
  markPrice: boolean;
  indexPrice: boolean;
  websocket: boolean;
  restFallback: boolean;
  status: 'LIVE' | 'PARTIAL' | 'OFFLINE' | 'DEGRADED';
  supportedTimeframes: Timeframe[];
}

export interface PipelineLogEvent {
  id: string;
  timestamp: number;
  exchange: ExchangeId;
  market?: string;
  operation: string;
  errorCode?: 
    | 'MARKET_DISCOVERY_FAILED'
    | 'OHLCV_FETCH_FAILED'
    | 'WEBSOCKET_DISCONNECTED'
    | 'RATE_LIMIT'
    | 'INVALID_CANDLE'
    | 'STALE_DATA'
    | 'NORMALIZATION_ERROR'
    | 'CACHE_ERROR'
    | 'TIMEOUT'
    | 'CIRCUIT_BREAKER_OPEN';
  message: string;
  retryCount?: number;
  latency?: number;
}
