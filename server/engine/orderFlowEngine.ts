import {
  AggressivePressureState,
  Candle,
  CvdPoint,
  DataQualityScore,
  ExchangeId,
  LargeTrade,
  OrderBookDepthSnapshot,
  OrderBookImbalanceState,
  OrderFlowDivergenceType,
  OrderFlowSnapshot,
  Timeframe
} from '../../src/types';

export interface RawTradeInput {
  tradeId: string;
  exchange: ExchangeId;
  symbol: string;
  marketType: 'SPOT' | 'PERPETUAL' | 'FUTURES';
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL' | 'UNKNOWN';
  timestamp: number;
  source: string;
}

export interface RawOrderBookLevel {
  price: number;
  quantity: number;
}

export interface RawOrderBookInput {
  bids: RawOrderBookLevel[];
  asks: RawOrderBookLevel[];
  timestamp: number;
}

export class OrderFlowEngine {
  public static readonly VERSION = 'v1.0.0';

  /**
   * Evaluates complete Order Flow snapshot at given timestamp T
   */
  public evaluateOrderFlow(
    symbol: string,
    exchange: ExchangeId,
    timeframe: Timeframe,
    trades: RawTradeInput[] | null,
    orderBook: RawOrderBookInput | null,
    candles?: Candle[],
    cutoffTimestamp?: number,
    largeTradeMinUsd: number = 100_000,
    depthPercent: number = 2.0
  ): OrderFlowSnapshot {
    const asOfTime = cutoffTimestamp ?? Date.now();

    // 1. Strict No-Lookahead filtering: Discard any trade after cutoffTimestamp
    const validTrades = trades
      ? trades.filter(t => t.timestamp <= asOfTime)
      : null;

    // Discard order book if timestamp is in the future
    const validOrderBook = orderBook && orderBook.timestamp <= asOfTime
      ? orderBook
      : null;

    // Data Quality Assessment
    let dataQuality: DataQualityScore = 'HIGH';
    if (!validTrades && !validOrderBook) {
      dataQuality = 'UNAVAILABLE';
    } else if (!validTrades || !validOrderBook) {
      dataQuality = 'MEDIUM';
    } else if (validTrades.length < 10) {
      dataQuality = 'LOW';
    }

    // 2. Aggressive Buy / Sell Volume & Pressure
    let aggressiveBuyVolume = 0;
    let aggressiveSellVolume = 0;
    let netAggressiveVolume = 0;
    let buySellRatio = 1.0;
    let pressureState: AggressivePressureState = 'UNKNOWN';

    if (validTrades && validTrades.length > 0) {
      let knownSideTrades = 0;
      for (const t of validTrades) {
        const notional = t.price * t.quantity;
        if (t.side === 'BUY') {
          aggressiveBuyVolume += notional;
          knownSideTrades++;
        } else if (t.side === 'SELL') {
          aggressiveSellVolume += notional;
          knownSideTrades++;
        }
      }

      if (knownSideTrades > 0) {
        netAggressiveVolume = aggressiveBuyVolume - aggressiveSellVolume;
        buySellRatio = aggressiveSellVolume > 0
          ? Number((aggressiveBuyVolume / aggressiveSellVolume).toFixed(2))
          : aggressiveBuyVolume > 0 ? 99.0 : 1.0;

        const totalVol = aggressiveBuyVolume + aggressiveSellVolume;
        const netPct = totalVol > 0 ? netAggressiveVolume / totalVol : 0;

        if (netPct > 0.08) {
          pressureState = 'BUYING_PRESSURE';
        } else if (netPct < -0.08) {
          pressureState = 'SELLING_PRESSURE';
        } else {
          pressureState = 'BALANCED';
        }
      }
    }

    // 3. Order Book Depth Imbalance
    let orderBookImbalance: OrderBookDepthSnapshot | null = null;
    if (validOrderBook && validOrderBook.bids.length > 0 && validOrderBook.asks.length > 0) {
      orderBookImbalance = this.calculateOrderBookImbalance(validOrderBook, depthPercent);
    }

    // 4. Large Trade Detection
    const largeTrades: LargeTrade[] = [];
    if (validTrades) {
      for (const t of validTrades) {
        const notional = t.price * t.quantity;
        if (notional >= largeTradeMinUsd) {
          largeTrades.push({
            tradeId: t.tradeId,
            exchange: t.exchange,
            symbol: t.symbol,
            marketType: t.marketType,
            price: t.price,
            quantity: t.quantity,
            notional,
            side: t.side,
            classification: t.side === 'BUY' ? 'LARGE_BUY' : t.side === 'SELL' ? 'LARGE_SELL' : 'LARGE_TRADE_UNKNOWN',
            timestamp: t.timestamp,
            source: t.source,
            dataQuality: 'HIGH'
          });
        }
      }
    }

    // 5. Cumulative Volume Delta (CVD)
    const cvd = this.calculateCvd(validTrades, timeframe, candles);

    // 6. Order Flow Divergence
    const divergence = this.detectCvdDivergence(candles, cvd.points);

    // 7. Order Flow Score (-100 to +100)
    const orderFlowScore = this.calculateOrderFlowScore(
      pressureState,
      buySellRatio,
      orderBookImbalance,
      cvd.currentDelta,
      divergence.type,
      largeTrades
    );

    return {
      symbol,
      exchange,
      timeframe,
      timestamp: asOfTime,
      dataQuality,
      aggressiveBuyVolume: Math.round(aggressiveBuyVolume),
      aggressiveSellVolume: Math.round(aggressiveSellVolume),
      netAggressiveVolume: Math.round(netAggressiveVolume),
      buySellRatio,
      pressureState,
      orderBookImbalance,
      cvd,
      divergence,
      largeTrades,
      orderFlowScore
    };
  }

  /**
   * Calculates order book depth within depthPercent (e.g. 2%) of mid price
   */
  public calculateOrderBookImbalance(
    book: RawOrderBookInput,
    depthPercent: number = 2.0
  ): OrderBookDepthSnapshot {
    const bestBid = book.bids[0]?.price || 0;
    const bestAsk = book.asks[0]?.price || 0;
    const midPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : Math.max(bestBid, bestAsk);

    const minBidPrice = midPrice * (1 - depthPercent / 100);
    const maxAskPrice = midPrice * (1 + depthPercent / 100);

    let bidDepthUsd = 0;
    for (const b of book.bids) {
      if (b.price >= minBidPrice) {
        bidDepthUsd += b.price * b.quantity;
      }
    }

    let askDepthUsd = 0;
    for (const a of book.asks) {
      if (a.price <= maxAskPrice) {
        askDepthUsd += a.price * a.quantity;
      }
    }

    const totalDepth = bidDepthUsd + askDepthUsd;
    const imbalanceRatio = totalDepth > 0
      ? Number(((bidDepthUsd - askDepthUsd) / totalDepth).toFixed(3))
      : 0;

    let state: OrderBookImbalanceState = 'BALANCED';
    if (imbalanceRatio > 0.12) {
      state = 'BUY_SIDE_DEPTH_IMBALANCE';
    } else if (imbalanceRatio < -0.12) {
      state = 'SELL_SIDE_DEPTH_IMBALANCE';
    }

    const spreadUsd = bestAsk > bestBid ? Number((bestAsk - bestBid).toFixed(4)) : 0;
    const spreadBps = midPrice > 0 ? Number(((spreadUsd / midPrice) * 10000).toFixed(1)) : 0;

    return {
      bidDepthUsd: Math.round(bidDepthUsd),
      askDepthUsd: Math.round(askDepthUsd),
      imbalanceRatio,
      state,
      spreadUsd,
      spreadBps,
      timestamp: book.timestamp,
      disclaimer: 'Order-book imbalance reflects displayed liquidity and can change rapidly.'
    };
  }

  /**
   * Computes Cumulative Volume Delta across timeframes
   */
  public calculateCvd(
    trades: RawTradeInput[] | null,
    primaryTimeframe: Timeframe,
    candles?: Candle[]
  ): {
    timeframes: Record<Timeframe, { delta: number; cumulativeDelta: number; available: boolean }>;
    points: CvdPoint[];
    currentDelta: number;
    currentCvd: number;
    isAvailable: boolean;
  } {
    const fallbackTfMap: Record<Timeframe, { delta: number; cumulativeDelta: number; available: boolean }> = {
      '5m': { delta: 0, cumulativeDelta: 0, available: false },
      '15m': { delta: 0, cumulativeDelta: 0, available: false },
      '1h': { delta: 0, cumulativeDelta: 0, available: false },
      '4h': { delta: 0, cumulativeDelta: 0, available: false },
      '1D': { delta: 0, cumulativeDelta: 0, available: false }
    };

    if (!trades || trades.length === 0) {
      return {
        timeframes: fallbackTfMap,
        points: [],
        currentDelta: 0,
        currentCvd: 0,
        isAvailable: false
      };
    }

    // Sort trades ascending by timestamp
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    let runningCvd = 0;
    const points: CvdPoint[] = [];

    // Bucket into 15m intervals for granular points
    const bucketIntervalMs = 15 * 60 * 1000;
    const buckets: Map<number, { buy: number; sell: number }> = new Map();

    for (const t of sorted) {
      const bucketTime = Math.floor(t.timestamp / bucketIntervalMs) * bucketIntervalMs;
      const b = buckets.get(bucketTime) || { buy: 0, sell: 0 };
      const notional = t.price * t.quantity;
      if (t.side === 'BUY') b.buy += notional;
      if (t.side === 'SELL') b.sell += notional;
      buckets.set(bucketTime, b);
    }

    for (const [timestamp, { buy, sell }] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
      const delta = buy - sell;
      runningCvd += delta;
      points.push({
        timestamp,
        buyVolume: Math.round(buy),
        sellVolume: Math.round(sell),
        delta: Math.round(delta),
        cumulativeDelta: Math.round(runningCvd)
      });
    }

    const currentDelta = points.length > 0 ? points[points.length - 1].delta : 0;
    const currentCvd = runningCvd;

    // Timeframe scale estimations based on recent subsets
    const tfResult = { ...fallbackTfMap };
    const timeframes: Timeframe[] = ['5m', '15m', '1h', '4h', '1D'];
    const tfDurations: Record<Timeframe, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000
    };

    const latestTime = sorted[sorted.length - 1].timestamp;
    for (const tf of timeframes) {
      const cutoff = latestTime - tfDurations[tf];
      const tfTrades = sorted.filter(t => t.timestamp >= cutoff);
      let b = 0;
      let s = 0;
      for (const t of tfTrades) {
        const notional = t.price * t.quantity;
        if (t.side === 'BUY') b += notional;
        if (t.side === 'SELL') s += notional;
      }
      tfResult[tf] = {
        delta: Math.round(b - s),
        cumulativeDelta: Math.round(b - s),
        available: true
      };
    }

    return {
      timeframes: tfResult,
      points,
      currentDelta,
      currentCvd,
      isAvailable: true
    };
  }

  /**
   * Detects divergence between Price and CVD
   */
  public detectCvdDivergence(
    candles?: Candle[],
    cvdPoints?: CvdPoint[]
  ): {
    detected: boolean;
    type: OrderFlowDivergenceType;
    confidence: number;
    description: string;
  } {
    if (!candles || candles.length < 5 || !cvdPoints || cvdPoints.length < 3) {
      return {
        detected: false,
        type: 'NONE',
        confidence: 0,
        description: 'Insufficient trade delta points for divergence evaluation.'
      };
    }

    // Inspect last 2 swing points
    const p1 = candles[candles.length - 3].close;
    const p2 = candles[candles.length - 1].close;

    const cvd1 = cvdPoints[cvdPoints.length - 3].cumulativeDelta;
    const cvd2 = cvdPoints[cvdPoints.length - 1].cumulativeDelta;

    // Price Higher High, CVD Lower High -> Bearish Order Flow Divergence
    if (p2 > p1 && cvd2 < cvd1) {
      return {
        detected: true,
        type: 'POSSIBLE_BEARISH_ORDER_FLOW_DIVERGENCE',
        confidence: 76,
        description:
          'Price reached higher high while cumulative volume delta printed a lower high (potential aggressive buyer exhaustion).'
      };
    }

    // Price Lower Low, CVD Higher Low -> Bullish Order Flow Divergence
    if (p2 < p1 && cvd2 > cvd1) {
      return {
        detected: true,
        type: 'POSSIBLE_BULLISH_ORDER_FLOW_DIVERGENCE',
        confidence: 76,
        description:
          'Price reached lower low while cumulative volume delta printed a higher low (potential aggressive seller absorption).'
      };
    }

    return {
      detected: false,
      type: 'NONE',
      confidence: 50,
      description: 'Order flow delta moving in structural alignment with price.'
    };
  }

  /**
   * Calculates overall order flow score from -100 to +100
   */
  public calculateOrderFlowScore(
    pressureState: AggressivePressureState,
    buySellRatio: number,
    orderBookImbalance: OrderBookDepthSnapshot | null,
    currentDelta: number,
    divergenceType: OrderFlowDivergenceType,
    largeTrades: LargeTrade[]
  ): number {
    let score = 0;

    // 1. Aggressive Pressure State (-40 to +40)
    if (pressureState === 'BUYING_PRESSURE') {
      score += 35;
    } else if (pressureState === 'SELLING_PRESSURE') {
      score -= 35;
    }

    // 2. Buy/Sell Ratio component (-25 to +25)
    if (buySellRatio > 1.5) score += 20;
    else if (buySellRatio > 1.1) score += 10;
    else if (buySellRatio < 0.65) score -= 20;
    else if (buySellRatio < 0.9) score -= 10;

    // 3. Order Book Imbalance (-20 to +20)
    if (orderBookImbalance) {
      if (orderBookImbalance.state === 'BUY_SIDE_DEPTH_IMBALANCE') {
        score += 15;
      } else if (orderBookImbalance.state === 'SELL_SIDE_DEPTH_IMBALANCE') {
        score -= 15;
      }
    }

    // 4. Divergence effect (-20 to +20)
    if (divergenceType === 'POSSIBLE_BULLISH_ORDER_FLOW_DIVERGENCE') {
      score += 15;
    } else if (divergenceType === 'POSSIBLE_BEARISH_ORDER_FLOW_DIVERGENCE') {
      score -= 15;
    }

    // 5. Large Trades skew (-15 to +15)
    const largeBuys = largeTrades.filter(t => t.side === 'BUY').length;
    const largeSells = largeTrades.filter(t => t.side === 'SELL').length;
    if (largeBuys > largeSells) score += 10;
    if (largeSells > largeBuys) score -= 10;

    return Math.max(-100, Math.min(100, score));
  }
}

export const orderFlowEngine = new OrderFlowEngine();
