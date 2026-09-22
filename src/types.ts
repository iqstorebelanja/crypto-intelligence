// ==========================================
// CRYPTO INTELLIGENCE AI - DOMAIN TYPES
// Phase 1 & Phase 2 Scope: Multi-Exchange Derivatives & Market Intelligence
// ==========================================

export type Timeframe = '5m' | '15m' | '1h' | '4h' | '1D';

export type ExchangeId = 'BINANCE' | 'OKX' | 'PIONEX' | 'BYBIT' | 'KUCOIN' | 'COINBASE' | 'KRAKEN' | 'BITGET' | (string & {});
export type MarketType = 'SPOT' | 'PERPETUAL' | 'FUTURES' | 'ALL';

// ==========================================
// GLOBAL MULTI-EXCHANGE & ASSET REGISTRY
// ==========================================
export interface Asset {
  id: string; // e.g. "BTC", "SOL", "ABC"
  baseAsset: string; // "BTC"
  displayName: string; // "Bitcoin" or "SOL"
  status: 'ACTIVE' | 'INACTIVE';
  chain?: string;
  contractAddress?: string;
  tokenStandard?: string;
  isVerifiedIdentity?: boolean; // Symbol collision protection
  unverifiedReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExchangeMarket {
  id: string; // e.g. "binance_BTCUSDT", "okx_BTC-USDT", "pionex_BTC_USDT"
  assetId: string; // maps to Asset.id
  exchange: ExchangeId;
  exchangeSymbol: string; // original exchange-specific ticker
  normalizedSymbol: string; // e.g. "BTC/USDT"
  quoteAsset: string;
  marketType: 'SPOT' | 'PERPETUAL' | 'FUTURES';
  status: 'ACTIVE' | 'INACTIVE' | 'HALTED';
  listingTime?: number;
  delistingTime?: number;
  pricePrecision?: number;
  quantityPrecision?: number;
  tickSize?: number;
  minQuantity?: number;
  minNotional?: number;
  metadata?: Record<string, any>;
  lastUpdated: number;
}

export interface ExchangeMarketMetadata {
  exchange: ExchangeId;
  marketId: string;
  symbol: string; // normalized "BTC/USDT"
  exchangeSymbol: string; // original "BTC-USDT"
  normalizedSymbol: string; // "BTC/USDT"
  baseAsset: string;
  quoteAsset: string;
  marketType: 'SPOT' | 'PERPETUAL' | 'FUTURES';
  status: 'ACTIVE' | 'INACTIVE' | 'HALTED';
  listingTime?: number;
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: number;
  minQuantity: number;
  minNotional: number;
  isActive: boolean;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface NewListingEvent {
  id: string;
  exchange: ExchangeId;
  exchangeSymbol: string;
  normalizedSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  marketType: 'SPOT' | 'PERPETUAL' | 'FUTURES';
  listingTime?: number;
  detectedAt: number;
}

export interface ExchangeUniverseStats {
  exchange: ExchangeId;
  exchangeName: string;
  activeMarkets: number;
  newMarkets: number;
  inactiveMarkets: number;
  lastDiscovery: number;
  discoveryStatus: 'Operational' | 'Degraded' | 'Offline';
  latencyMs: number;
  features: string[];
}

export interface AggregatedAssetView {
  asset: Asset;
  normalizedSymbol: string;
  availableMarkets: {
    exchange: ExchangeId;
    exchangeSymbol: string;
    marketType: 'SPOT' | 'PERPETUAL' | 'FUTURES';
    price: number;
    change24h: number;
    volume24h: number;
    quoteVolume24h: number;
    rsi14: number;
    bullScore: number;
    dataStatus: 'LIVE' | 'DATA DELAYED' | 'UNAVAILABLE';
    freshnessSeconds: number;
    hasDerivatives: boolean;
    openInterestUsd?: number | null;
    fundingRate?: number | null;
  }[];
  aggregatedVolume24hQuote?: number | null; // Aggregated ONLY if same quote currency, market type, and timeframe
  volumeAggregationNote?: string;
  primaryExchange: ExchangeId;
}

// Database Entities
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  status?: 'ACTIVE' | 'DISABLED';
  lastLogin?: number;
  createdAt: number;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}

export interface Exchange {
  id: string;
  name: string;
  isEnabled: boolean;
  isHealthy: boolean;
  latencyMs: number;
  baseUrl: string;
}

export interface TradingPair {
  id: string;
  symbol: string; // e.g. "BTCUSDT"
  formattedSymbol: string; // e.g. "BTC/USDT"
  baseAsset: string; // "BTC"
  quoteAsset: string; // "USDT"
  exchange: ExchangeId;
  marketType: 'SPOT' | 'PERPETUAL';
  status: 'TRADING' | 'HALTED';
}

export interface Candle {
  time: number; // timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCVRecord extends Candle {
  id: string;
  symbol: string;
  exchange: ExchangeId;
  marketType: 'SPOT' | 'PERPETUAL';
  timeframe: Timeframe;
}

export interface TechnicalIndicators {
  rsi6: number;
  rsi14: number;
  ma20: number;
  ma50: number;
  ma200: number;
  priceVsMa20: 'above' | 'below';
  priceVsMa50: 'above' | 'below';
  priceVsMa200: 'above' | 'below';
  maTrend: 'Strong Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bearish';
  maCross: 'golden_cross' | 'death_cross' | 'bullish_alignment' | 'bearish_alignment' | 'neutral';
  bb: {
    upper: number;
    middle: number;
    lower: number;
    width: number;
    percentB: number; // Price position relative to bands (0 to 1+)
  };
  volumeAnalysis: {
    current: number;
    average20: number;
    ratio: number;
    isSpike: boolean;
  };
}

export interface IndicatorSnapshot {
  id: string;
  symbol: string;
  exchange: ExchangeId;
  timeframe: Timeframe;
  indicators: TechnicalIndicators;
  timestamp: number;
}

export type BullClassification =
  | 'Weak bullish conditions'
  | 'Neutral conditions'
  | 'Positive conditions'
  | 'Strong bullish conditions'
  | 'Very strong bullish conditions';

export type DownsideRiskClassification =
  | 'Low downside pressure'
  | 'Moderate downside pressure'
  | 'Elevated downside pressure'
  | 'High downside pressure'
  | 'Very high downside pressure';

export type AnalyticalSignal =
  | 'Bullish conditions'
  | 'Neutral conditions'
  | 'Bearish conditions';

export interface ScoreComponent {
  weight: number;
  score: number; // 0 to 100
  note: string;
}

// Phase 2 Scoring Snapshots (Modular 100% Configurable)
export interface BullBreakdown {
  trendMA: ScoreComponent;         // 20%
  rsi: ScoreComponent;             // 10%
  volume: ScoreComponent;          // 15%
  bollingerBands: ScoreComponent;  // 10%
  priceMomentum: ScoreComponent;   // 10%
  marketStructure?: ScoreComponent; // 20%
  openInterest?: ScoreComponent;   // 10%
  funding?: ScoreComponent;        // 5%
}

export interface DownsideRiskBreakdown {
  rsiExtreme: ScoreComponent;
  maBreakdown: ScoreComponent;
  volumeWeakness: ScoreComponent;
  momentumLoss: ScoreComponent;
  supportLossProxy: ScoreComponent;
  bearishStructure?: ScoreComponent;
  derivativesRisk?: ScoreComponent;
  liquidationPressure?: ScoreComponent;
}

export interface ScoreSnapshot {
  id: string;
  symbol: string;
  exchange: ExchangeId;
  timeframe: Timeframe;
  bullScore: number;
  bullClassification: BullClassification;
  bullBreakdown: BullBreakdown;
  downsideRiskScore: number;
  downsideRiskClassification: DownsideRiskClassification;
  downsideRiskBreakdown: DownsideRiskBreakdown;
  signal: AnalyticalSignal;
  timestamp: number;
}

// ==========================================
// MARKET STRUCTURE (Phase 2 Enhanced)
// ==========================================
export interface SupportResistanceLevel {
  price: number;
  type: 'support' | 'resistance';
  distancePercent: number; // e.g. -3.2 or +4.1
  touches: number;
  label: string;
}

export interface RetestZone {
  min: number;
  max: number;
  brokenLevel: number;
  type: 'support' | 'resistance';
  description: string;
}

export interface SwingPoint {
  index: number;
  price: number;
  time: number;
  type: 'high' | 'low';
}

export interface MarketStructure {
  timeframe?: Timeframe;
  lookback?: number;
  state: 'Higher High (HH)' | 'Higher Low (HL)' | 'Lower High (LH)' | 'Lower Low (LL)' | 'Range-Bound / Consolidation';
  lastSwingHigh: number;
  lastSwingLow: number;
  swingHighs?: SwingPoint[];
  swingLows?: SwingPoint[];
  nearestSupport?: SupportResistanceLevel | null;
  nearestResistance?: SupportResistanceLevel | null;
  supportLevels: number[];
  resistanceLevels: number[];
  event:
    | 'Potential Breakout'
    | 'Potential Breakdown'
    | 'Potential Retest Zone'
    | 'Support Retest'
    | 'Resistance Retest'
    | 'Break of Structure (Prep)'
    | 'Consolidating';
  retestZone?: RetestZone | null;
  volumeConfirmed?: boolean;
  description: string;
}

// ==========================================
// DERIVATIVES INTELLIGENCE (Phase 2 Normalization)
// ==========================================
export type PriceOiRelation =
  | 'Price_Up_OI_Up'
  | 'Price_Down_OI_Up'
  | 'Price_Up_OI_Down'
  | 'Price_Down_OI_Down'
  | 'Neutral';

export interface DerivativesData {
  symbol: string;
  exchange: ExchangeId;
  marketType: 'PERPETUAL';
  source: string; // e.g. "Binance Futures API", "Bybit Linear v5"
  timestamp: number;
  // Open Interest
  openInterest: number | null; // Quantity in base asset
  openInterestUsd: number | null; // USD equivalent
  openInterestChange1h: number | null; // % change
  openInterestChange4h: number | null; // % change
  openInterestChange24h: number | null; // % change
  openInterestChange1hAbs: number | null;
  openInterestChange4hAbs: number | null;
  openInterestChange24hAbs: number | null;
  // Funding Rate
  fundingRate: number | null; // e.g. 0.0001 = 0.01%
  fundingTimestamp: number | null;
  fundingTrend: 'Positive' | 'Negative' | 'Neutral';
  nextFundingTime: number | null;
  // Long / Short Ratio
  longShortRatio: {
    longRatio: number; // percentage, e.g. 54.2
    shortRatio: number; // percentage, e.g. 45.8
    ratio: number; // e.g. 1.18
    timestamp: number;
  } | null;
  // Liquidations
  liquidations: {
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
  } | null;
  // Price + OI Analysis Combination
  priceOiRelation: PriceOiRelation;
  priceOiInterpretation: string;
  freshnessSeconds: number;
  dataStatus: 'LIVE' | 'DATA DELAYED' | 'UNAVAILABLE';
}

// ==========================================
// NORMALIZED COIN DATA (Unified Schema)
// ==========================================
export interface PriceHistoryPoint {
  time: number;
  date: string;
  shortDate: string;
  dayName: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePercent?: number;
}

export interface NormalizedCoinData {
  id: string;
  symbol: string; // e.g. "BTC/USDT"
  rawSymbol: string; // e.g. "BTCUSDT"
  marketId?: string; // unique e.g. "okx_BTC-USDT"
  exchangeSymbol?: string; // original exchange specific symbol, e.g. "BTC-USDT"
  normalizedSymbol?: string; // "BTC/USDT"
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  exchange: ExchangeId;
  marketType: 'SPOT' | 'PERPETUAL' | 'FUTURES';
  source: string;
  timestamp: number;
  dataStatus: 'LIVE' | 'DATA DELAYED' | 'UNAVAILABLE';
  freshnessSeconds: number;
  isVerifiedIdentity?: boolean;
  unverifiedReason?: string;
  indicators: TechnicalIndicators;
  scores: ScoreSnapshot;
  scoreSnapshot?: ScoreSnapshot;
  marketStructure: MarketStructure;
  derivatives: DerivativesData | null;
  history7d?: PriceHistoryPoint[];
  crossExchangeMarkets?: {
    exchange: ExchangeId;
    exchangeSymbol: string;
    price: number;
    change24h: number;
    marketType: 'SPOT' | 'PERPETUAL' | 'FUTURES';
  }[];
}

export interface BtcMarketCondition {
  price: number;
  change24h: number;
  rsi14: number;
  ma20: number;
  ma50: number;
  ma200: number;
  priceVsMa20: 'above' | 'below';
  priceVsMa50: 'above' | 'below';
  priceVsMa200: 'above' | 'below';
  bullScore: number;
  downsideRiskScore: number;
  signal: AnalyticalSignal;
  openInterestUsd?: number | null;
  oiChange24h?: number | null;
  fundingRate?: number | null;
  freshnessSeconds: number;
  dataStatus: 'LIVE' | 'DATA DELAYED';
}

export interface MarketSentimentData {
  index: number; // 0 - 100
  tier: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  color: string;
  globalRsi: {
    value: number;
    oversoldPercent: number;
    overboughtPercent: number;
    neutralPercent: number;
    oversoldCount: number;
    overboughtCount: number;
    neutralCount: number;
    status: 'Oversold' | 'Bearish Momentum' | 'Neutral' | 'Bullish Momentum' | 'Overbought';
    weight: number;
  };
  fearAndGreed: {
    value: number;
    classification: string;
    source: string;
    timestamp: number;
    weight: number;
  };
  marketMomentum24h: {
    value: number; // 0 - 100 normalized
    advancingCount: number;
    decliningCount: number;
    totalCount: number;
    advancingPercent: number;
    averageChange24h: number;
    status: 'Strong Bearish Breadth' | 'Bearish Tilt' | 'Balanced Breadth' | 'Bullish Tilt' | 'Strong Bullish Breadth';
    weight: number;
  };
  lastCalculatedAt: number;
}

export interface MarketOverview {
  btcCondition: BtcMarketCondition;
  ethPrice: number;
  ethChange24h: number;
  totalPairsScanned: number;
  activeExchange: 'ALL' | 'BINANCE' | 'BYBIT' | ExchangeId;
  sentiment?: MarketSentimentData;
  systemHealth: {
    isHealthy: boolean;
    latencyMs: number;
    lastCheckedAt: number;
    statusText: string;
    binanceStatus?: 'Operational' | 'Degraded' | 'Offline';
    bybitStatus?: 'Operational' | 'Degraded' | 'Offline';
    marketDataStatus?: 'Live' | 'Delayed';
    derivativesStatus?: 'Live' | 'Delayed' | 'Partial';
  };
  topBullCoins: NormalizedCoinData[];
  topRiskCoins: NormalizedCoinData[];
  volumeSpikeCoins: NormalizedCoinData[];
  momentumCoins: NormalizedCoinData[];
}

export interface WatchlistRecord {
  id: string;
  userId: string;
  symbol: string;
  exchange?: ExchangeId;
  marketType?: 'SPOT' | 'PERPETUAL';
  timeframe?: Timeframe;
  addedAt: number;
}

// ==========================================
// ALERTS & NOTIFICATIONS (Phase 2)
// ==========================================
export type AlertConditionType =
  | 'bullScore'
  | 'downsideRisk'
  | 'rsi14'
  | 'volumeRatio'
  | 'oiChange'
  | 'funding'
  | 'price'
  | 'breakout'
  | 'breakdown'
  | 'retest'
  | 'PRICE_ABOVE'
  | 'PRICE_BELOW'
  | 'PRICE_PCT_UP'
  | 'PRICE_PCT_DOWN'
  | 'PRICE_PCT_ANY'
  | 'PRICE_CHANGE_PCT_ABOVE'
  | 'PRICE_CHANGE_PCT_BELOW'
  | 'RSI_ABOVE'
  | 'RSI_BELOW'
  | 'BULL_SCORE_ABOVE'
  | 'BULL_SCORE_BELOW'
  | 'DOWNSIDE_RISK_ABOVE'
  | 'BREAKOUT_DETECTED'
  | 'BREAKDOWN_DETECTED'
  | 'RETEST_DETECTED'
  | 'OI_SPIKE'
  | 'FUNDING_FLIP';

export interface Alert {
  id: string;
  userId: string;
  symbol: string;
  exchange?: 'ALL' | 'BINANCE' | 'BYBIT' | ExchangeId;
  marketType?: 'SPOT' | 'PERPETUAL' | 'ALL';
  timeframe?: Timeframe;
  conditionType: AlertConditionType;
  metric?: string; // Phase 1 compatibility fallback
  operator: '>' | '<' | '==' | 'event';
  threshold: number | string;
  targetValue?: number | null; // Phase 1 compatibility fallback
  basePrice?: number; // Baseline price when percentage alert was set
  percentThreshold?: number; // % threshold to move from baseline
  direction?: 'UP' | 'DOWN' | 'ANY'; // Percentage move direction
  currentValue?: number | string;
  enabled: boolean;
  isActive?: boolean;
  isRecurring?: boolean;
  cooldownMinutes?: number;
  notes?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
  triggered?: boolean;
  lastTriggeredAt?: number | null;
}

export interface AlertEvent {
  id: string;
  alertId: string;
  userId: string;
  triggeredAt: number;
  symbol: string;
  exchange?: ExchangeId;
  condition: string;
  conditionType?: AlertConditionType;
  conditionDescription?: string;
  actualValue: number | string;
  threshold: number | string;
  triggerPrice?: number;
  message: string;
  read: boolean;
  status?: 'TRIGGERED' | 'SENT' | 'ACKNOWLEDGED' | 'DISMISSED';
  timestamp?: number;
}

export interface Notification {
  id: string;
  userId: string;
  channel: 'in_app' | 'browser' | 'telegram' | 'email';
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  phase: 'Phase 2 Operational' | 'Phase 2/3 Feature';
}

export interface NotificationProvider {
  id: string;
  name: string;
  isEnabled: boolean;
  send(userId: string, title: string, message: string): Promise<boolean>;
}

export interface SystemHealth {
  serviceName: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  latencyMs: number;
  lastCheckedAt: number;
  message: string;
}

// ==========================================
// PHASE 3: WHALE INTELLIGENCE & ON-CHAIN TYPES
// ==========================================
export type WhaleTxType =
  | 'Whale Buy'
  | 'Whale Sell'
  | 'Exchange Deposit'
  | 'Exchange Withdrawal'
  | 'Large Transfer'
  | 'Accumulation'
  | 'Distribution';

export type WhaleTxDirection = 'inflow' | 'outflow' | 'transfer' | 'internal';

export interface WhaleTransaction {
  id: string;
  symbol: string;
  amount: number;
  usdValue: number;
  type: WhaleTxType;
  direction: WhaleTxDirection;
  source: string;
  fromAddress?: string;
  toAddress?: string;
  fromEntity?: string;
  toEntity?: string;
  analyticalInterpretation: string;
  timestamp: number;
  txHash?: string;
}

export interface OnChainProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  active: boolean;
  description: string;
  supportedChains: string[];
  latencyMs?: number;
  lastBlockSynced?: number;
  isSimulated?: boolean;
}

export interface WhaleActivitySummary {
  available: boolean;
  reason?: string;
  provider?: string;
  symbol?: string;
  totalTransactions?: number;
  totalUsdVolume?: number;
  netExchangeFlowUsd?: number;
  accumulationSignals?: number;
  distributionSignals?: number;
  transactions?: WhaleTransaction[];
}

// ==========================================
// PHASE 3: TELEGRAM INTEGRATION TYPES
// ==========================================
export interface TelegramConfig {
  enabled: boolean;
  botToken?: string;
  chatId?: string;
  lastTestStatus?: 'SUCCESS' | 'FAILED' | null;
  lastTestError?: string;
  lastTestedAt?: number;
}

// ==========================================
// PHASE 3: AI TRADER & TOOL LAYER TYPES
// ==========================================
export interface AIToolInvocation {
  name: string;
  input: Record<string, any>;
  outputSummary?: string;
  timestamp: number;
  durationMs: number;
}

export interface StructuredAIAnalysis {
  symbol: string;
  exchange: string;
  market: string;
  timeframe: string;
  marketData: {
    price: number;
    change24h: number;
    high24h: number;
    low24h: number;
    volume: number;
    dataFreshness: string;
  };
  technical: {
    rsi6: number;
    rsi14: number;
    ma20: number;
    ma50: number;
    ma200: number;
    priceVsMa20: string;
    priceVsMa50: string;
    priceVsMa200: string;
    bollinger: string;
    volumeRatio: number;
  };
  derivatives: {
    openInterest: string;
    openInterestChange: string;
    fundingRate: string;
    liquidations: string;
    longShortRatio?: string;
  };
  marketStructure: {
    structure: string;
    support: number;
    resistance: number;
    breakout: string;
    breakdown: string;
  };
  scores: {
    bullScore: number;
    downsideRisk: number;
    signal: string;
    breakdown: {
      trend: number;
      rsi: number;
      volume: number;
      bollinger: number;
      momentum: number;
      structure: number;
      openInterest: number;
      funding: number;
    };
  };
  why: string;
  bullishFactors: string[];
  bearishFactors: string[];
  conflictingSignals: string[];
  scenarios: {
    bullish: string;
    neutral: string;
    bearish: string;
  };
  disclaimer: string;
}

export interface AIComparisonResult {
  symbolA: string;
  symbolB: string;
  coinA: any;
  coinB: any;
  relativeStrength: string;
  keyDivergences: string[];
  derivativesComparison: string;
  summary: string;
  disclaimer: string;
}

export interface OnChainProviderStatus {
  id: string;
  name: string;
  isConfigured: boolean;
  isActive: boolean;
  type: string;
  health: 'HEALTHY' | 'DEGRADED' | 'DOWN';
}

export interface AIMessage {
  id: string;
  conversationId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolsInvoked?: AIToolInvocation[];
  structuredAnalysis?: StructuredAIAnalysis | null;
  comparisonResult?: AIComparisonResult | null;
  queryType?: 'analysis' | 'comparison' | 'scanner' | 'history' | 'conflicts' | 'whales' | 'general';
  disclaimer?: string;
  timestamp: number;
}

export interface NaturalQueryFilterResult {
  intent: 'SCAN' | 'ANALYZE' | 'COMPARE' | 'WHALES' | 'EXPLAIN_SCORE' | 'HISTORY' | 'CONFLICTS' | 'UNKNOWN';
  targetSymbol?: string;
  secondarySymbol?: string;
  filters?: {
    bullMin?: number | null;
    riskMin?: number | null;
    volRatioMin?: number | null;
    rsiMin?: number | null;
    rsiMax?: number | null;
    aboveMa20?: boolean;
    aboveMa50?: boolean;
    aboveMa200?: boolean;
    oiExpanding?: boolean;
    highFunding?: boolean;
    breakoutOnly?: boolean;
    bearishStructureOnly?: boolean;
    minWhaleUsd?: number;
  };
  matchedCount?: number;
  summaryText: string;
}

// ==========================================
// PHASE 4A: PRODUCTION MONITORING & ADMIN TYPES
// ==========================================

export type SystemLogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type SystemLogSource =
  | 'AUTH'
  | 'BINANCE'
  | 'BYBIT'
  | 'DATABASE'
  | 'SCANNER'
  | 'INDICATOR'
  | 'SCORING'
  | 'ALERT'
  | 'AI'
  | 'TELEGRAM'
  | 'WHALE'
  | 'SYSTEM';

export type FreshnessStatus = 'LIVE' | 'DELAYED' | 'STALE' | 'UNAVAILABLE';

export interface FreshnessThresholds {
  liveMaxSec: number;     // e.g. 15s
  delayedMaxSec: number;  // e.g. 60s
  staleMinSec: number;    // e.g. 60s
}

export interface DataFreshnessItem {
  dataType: 'Ticker' | 'OHLCV' | 'Indicators' | 'Derivatives' | 'Funding' | 'OI' | 'Liquidations' | 'Market Structure' | 'Whale Data';
  source: string;
  exchange: ExchangeId;
  symbol: string;
  timeframe: Timeframe;
  lastUpdate: number;
  ageSeconds: number;
  status: FreshnessStatus;
}

export interface ExchangeHealthDetail {
  id: ExchangeId;
  name: string;
  status: 'Operational' | 'Degraded' | 'Offline' | 'Not Configured';
  isHealthy: boolean;
  latencyMs: number;
  lastUpdate: number;
  errorRatePercent: number;
  rateLimitStatus: 'Normal' | 'Elevated' | 'Throttled';
  requestCount: number;
  failedRequests: number;
  lastSuccessfulRequest: number;
  pairsCount: number;
  webSocketStatus?: 'Connected' | 'Disconnected' | 'Reconnecting' | 'N/A';
}

export interface ScannerAdminConfig {
  minVolume: number;
  volumeSpikeThreshold: number;
  maxPairs: number;
  pollingIntervalSec: number;
  cacheDurationSec: number;
  supportedTimeframes: Timeframe[];
}

export interface BullScoreWeights {
  trendWeight: number;      // default: 20
  rsiWeight: number;        // default: 10
  volumeWeight: number;     // default: 15
  bollingerWeight: number;  // default: 10
  momentumWeight: number;   // default: 10
  structureWeight: number;  // default: 20
  oiWeight: number;         // default: 10
  fundingWeight: number;    // default: 5
}

export interface DownsideRiskWeights {
  rsiExtremeWeight: number;       // default: 20
  maBreakdownWeight: number;      // default: 20
  volumeWeaknessWeight: number;   // default: 15
  momentumLossWeight: number;     // default: 15
  supportLossWeight: number;      // default: 15
  bearishStructureWeight: number; // default: 15
  derivativesRiskWeight: number;  // default: 0 or optional
}

export interface ScoreConfigVersion {
  id: string;
  version: number;
  type: 'BULL' | 'RISK';
  changedBy: string;
  timestamp: number;
  previousConfiguration: Record<string, number>;
  newConfiguration: Record<string, number>;
  totalWeight: number;
  notes?: string;
}

export interface GlobalAlertAdminConfig {
  maxAlertsPerUser: number;
  minAlertCooldownMinutes: number;
  maxNotificationsPerHour: number;
  maxTelegramMessagesPerHour: number;
  systemWideAlertsEnabled: boolean;
}

export interface ManagedSymbol {
  symbol: string;
  formattedSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  exchange: ExchangeId;
  marketType: 'SPOT' | 'PERPETUAL';
  status: 'ACTIVE' | 'DISABLED';
  lastDataUpdate: number;
}

export interface SystemLogEntry {
  id: string;
  level: SystemLogLevel;
  source: SystemLogSource;
  timestamp: number;
  message: string;
  endpoint?: string;
  metadata?: Record<string, any>;
}

export interface AIErrorLogEntry {
  id: string;
  timestamp: number;
  user: string;
  requestType: string;
  tool?: string;
  error: string;
  duration: number;
}

export interface AdminAuditLogEntry {
  id: string;
  adminUser: string;
  action: string;
  target: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRatioPercent: number;
  keysCount: number;
  lastPurge: number;
}

export interface PerformanceMetrics {
  apiLatencyAvgMs: number;
  dbLatencyAvgMs: number;
  scannerCalcTimeMs: number;
  indicatorCalcTimeMs: number;
  scoreCalcTimeMs: number;
  aiResponseTimeAvgMs: number;
  alertProcessingTimeMs: number;
}

export interface AIUsageMetrics {
  requestsToday: number;
  requestsThisHour: number;
  averageResponseTimeMs: number;
  aiErrorsCount: number;
  totalToolCalls: number;
  failedToolCalls: number;
  serviceStatus: 'Operational' | 'Degraded' | 'Not Configured';
  toolUsageBreakdown: Record<string, { calls: number; errors: number }>;
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: number;
  lastLoginAt?: number;
}

// ==========================================
// PHASE 5 — VALIDATION LAB & REPLAY TYPES
// ==========================================

export type HistoricalPeriod = '7d' | '30d' | '90d' | '180d' | '365d';
export type ValidationHorizon = '15m' | '1h' | '4h' | '12h' | '24h' | '3d' | '7d';

export interface ForwardOutcome {
  horizon: ValidationHorizon;
  futureTimestamp: number;
  futurePrice: number;
  absoluteReturn: number;
  percentageReturn: number; // ((futurePrice - price) / price) * 100
  mfe: number; // Maximum Favorable Excursion % (max upward movement within horizon)
  mae: number; // Maximum Adverse Excursion % (max downward movement within horizon)
}

export interface HistoricalSignalSnapshot {
  id: string;
  symbol: string;
  exchange: ExchangeId;
  marketType: 'SPOT' | 'PERPETUAL';
  timeframe: Timeframe;
  timestamp: number;

  price: number;

  RSI6: number;
  RSI14: number;

  MA20: number;
  MA50: number;
  MA200: number;

  BBUpper: number;
  BBMiddle: number;
  BBLower: number;

  volume: number;
  averageVolume: number;
  volumeRatio: number;

  openInterest: number | null; // N/A if unavailable
  openInterestChange: number | null;
  fundingRate: number | null;
  liquidations: number | null;

  marketStructure: string;
  support: number;
  resistance: number;

  bullScore: number;
  downsideRisk: number;
  signal: string;

  scoringConfigVersion: number;
  indicatorConfigVersion: number;
  marketStructureConfigVersion: number;

  outcomes: Record<ValidationHorizon, ForwardOutcome | null>;
}

export interface StatisticalSummary {
  sampleSize: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  positiveOutcomePercent: number; // Return > 0
  negativeOutcomePercent: number; // Return < 0
  neutralOutcomePercent: number;  // Return === 0
  p25: number;
  p75: number;
  averageMfe: number;
  averageMae: number;
  confidenceInterval95Mean: [number, number] | null;
  confidenceInterval95Proportion: [number, number] | null;
  isSmallSample: boolean; // < 30 samples
}

export interface ScoreBucketResult {
  bucketRange: string;
  minScore: number;
  maxScore: number;
  stats: StatisticalSummary;
}

export interface IndicatorConditionResult {
  conditionName: string;
  description: string;
  stats: StatisticalSummary;
}

export interface OiPriceCombinationResult {
  combination: 'Price ↑ + OI ↑' | 'Price ↓ + OI ↑' | 'Price ↑ + OI ↓' | 'Price ↓ + OI ↓';
  stats: StatisticalSummary;
  description: string;
}

export interface MarketStructureValidationResult {
  structureType: string;
  stats: StatisticalSummary;
}

export interface ValidationRunRequest {
  symbol: string;
  exchange: ExchangeId;
  timeframe: Timeframe;
  period: HistoricalPeriod;
  selectedHorizon: ValidationHorizon;
  modelVersion?: string;
  customFilters?: {
    minBullScore?: number | null;
    maxBullScore?: number | null;
    minDownsideRisk?: number | null;
    maxDownsideRisk?: number | null;
    minVolumeRatio?: number | null;
    maxRsi14?: number | null;
    minRsi14?: number | null;
    marketStructure?: string | null;
    aboveMa20?: boolean | null;
    aboveMa50?: boolean | null;
    aboveMa200?: boolean | null;
    oiPriceDynamics?: string | null;
  };
}

export interface ValidationRunResponse {
  success: boolean;
  error?: string;
  metadata: {
    symbol: string;
    exchange: ExchangeId;
    timeframe: Timeframe;
    period: HistoricalPeriod;
    selectedHorizon: ValidationHorizon;
    totalCandles: number;
    totalSignalsEvaluated: number;
    dateRange: { start: number; end: number };
    scoringConfigVersion: number;
    indicatorConfigVersion: number;
    marketStructureConfigVersion: number;
    modelVersionLabel: string;
    derivativesDataStatus: 'AVAILABLE' | 'N/A';
    executionTimeMs: number;
  };
  overallStats: StatisticalSummary;
  bullScoreBuckets: ScoreBucketResult[];
  downsideRiskBuckets: ScoreBucketResult[];
  indicatorConditions: IndicatorConditionResult[];
  oiPriceDynamics: OiPriceCombinationResult[];
  marketStructureResults: MarketStructureValidationResult[];
  recentSnapshots: HistoricalSignalSnapshot[];
  customFilterStats?: StatisticalSummary | null;
}


