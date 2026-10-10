import { WhaleProviderManager, SimulatedWhaleProvider } from '../adapters/whaleProvider';
import { orderFlowEngine } from './orderFlowEngine';
import { liquidationEngine } from './liquidationEngine';
import { signalEngine } from './signalEngine';
import {
  Candle,
  ExchangeId,
  LiquidationEvent,
  NormalizedCoinData,
  OrderBookDepthSnapshot,
  RawOrderBookInput,
  RawTradeInput,
  WhaleTransfer
} from '../../src/types';

export interface Phase8TestResult {
  testId: number;
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export class Phase8EngineTestRunner {
  public static async runAllTests(): Promise<{
    passedCount: number;
    failedCount: number;
    totalCount: number;
    results: Phase8TestResult[];
  }> {
    const results: Phase8TestResult[] = [];

    // Test 1: Provider Capability Registry verification
    try {
      const manager = new WhaleProviderManager();
      const caps = manager.getCapabilities();
      const hasSim = caps.some(c => c.providerId === 'simulated');
      const supportedFeatures = caps.find(c => c.providerId === 'simulated')?.features;

      const passed = hasSim && Boolean(supportedFeatures?.largeTransfers) && Boolean(supportedFeatures?.exchangeWallets);
      results.push({
        testId: 1,
        testName: 'Provider Capability Registry Verification',
        passed,
        message: passed
          ? 'Provider capability registry accurately reports supported features without synthetic capability claims.'
          : 'Capability registry check failed: simulated provider features missing.',
        details: { capabilitiesCount: caps.length }
      });
    } catch (err) {
      results.push({
        testId: 1,
        testName: 'Provider Capability Registry Verification',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 2: Large Transfer Detection & deduplication
    try {
      const manager = new WhaleProviderManager();
      const rawTransfers: WhaleTransfer[] = [
        {
          id: 'tx_dup_1',
          transactionHash: '0xabc123',
          timestamp: Date.now() - 10000,
          asset: 'BTC',
          chain: 'Bitcoin',
          amount: 50,
          usdValue: 4_500_000,
          sourceAddress: 'bc1qwallet1',
          destinationAddress: 'bc1qbinance_deposit',
          direction: 'WALLET_TO_EXCHANGE',
          eventType: 'EXCHANGE_DEPOSIT',
          dataQuality: 'HIGH',
          provider: 'Test Provider',
          confidence: 90,
          analyticalContext: 'NEUTRAL_TRANSFER',
          analyticalNotes: 'Test event'
        },
        {
          id: 'tx_dup_2',
          transactionHash: '0xabc123', // duplicate hash
          timestamp: Date.now() - 10000,
          asset: 'BTC',
          chain: 'Bitcoin',
          amount: 50,
          usdValue: 4_500_000,
          sourceAddress: 'bc1qwallet1',
          destinationAddress: 'bc1qbinance_deposit',
          direction: 'WALLET_TO_EXCHANGE',
          eventType: 'EXCHANGE_DEPOSIT',
          dataQuality: 'HIGH',
          provider: 'Duplicate Feed',
          confidence: 90,
          analyticalContext: 'NEUTRAL_TRANSFER',
          analyticalNotes: 'Test event duplicate'
        }
      ];

      const deduped = manager.deduplicateTransfers(rawTransfers);
      const passed = deduped.length === 1 && deduped[0].transactionHash === '0xabc123';
      results.push({
        testId: 2,
        testName: 'Large Transfer Detection & Deduplication',
        passed,
        message: passed
          ? 'Duplicate blockchain transactions correctly filtered by transactionHash deduplication.'
          : `Expected 1 deduped transfer, got ${deduped.length}`,
        details: { dedupedCount: deduped.length }
      });
    } catch (err) {
      results.push({
        testId: 2,
        testName: 'Large Transfer Detection & Deduplication',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 3: Transfer Classification (WALLET_TO_EXCHANGE, EXCHANGE_TO_WALLET, UNKNOWN)
    try {
      const manager = new WhaleProviderManager();
      const c1 = manager.classifyTransfer('0xunknown1', '0x28c6c06298d514db089934071355e5743bf21d60'); // To Binance
      const c2 = manager.classifyTransfer('0x28c6c06298d514db089934071355e5743bf21d60', '0xunknown2'); // From Binance
      const c3 = manager.classifyTransfer('0xunknown3', '0xunknown4'); // Unknown to Unknown

      const passed =
        c1.direction === 'WALLET_TO_EXCHANGE' &&
        c2.direction === 'EXCHANGE_TO_WALLET' &&
        c3.direction === 'UNKNOWN';

      results.push({
        testId: 3,
        testName: 'Transfer Classification (Wallet to Exchange, Exchange to Wallet, Unknown)',
        passed,
        message: passed
          ? 'Transfer directions correctly classified based on verifiable labels without speculative assumptions.'
          : `Classification mismatch: c1=${c1.direction}, c2=${c2.direction}, c3=${c3.direction}`,
        details: { c1: c1.direction, c2: c2.direction, c3: c3.direction }
      });
    } catch (err) {
      results.push({
        testId: 3,
        testName: 'Transfer Classification',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 4: Known Exchange Address Labels & Attribution
    try {
      const manager = new WhaleProviderManager();
      const labelBinance = manager.lookupLabel('0x28c6c06298d514db089934071355e5743bf21d60');
      const labelOkx = manager.lookupLabel('0x6cc5f688a315f3dc28a7781717a9a798a59fda7b');
      const labelUnknown = manager.lookupLabel('0xrandomwallet123456');

      const passed =
        labelBinance?.exchange === 'Binance' &&
        labelOkx?.exchange === 'OKX' &&
        labelUnknown === null;

      results.push({
        testId: 4,
        testName: 'Exchange Address Labels & Attribution',
        passed,
        message: passed
          ? 'Public exchange cold/hot wallets accurately attributed to verified entities.'
          : 'Exchange address label lookup failed.',
        details: { binance: labelBinance?.exchange, okx: labelOkx?.exchange }
      });
    } catch (err) {
      results.push({
        testId: 4,
        testName: 'Exchange Address Labels & Attribution',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 5: Exchange Flow Summary & Context
    try {
      const manager = new WhaleProviderManager();
      const mockTransfers: WhaleTransfer[] = [
        {
          id: 't1',
          timestamp: Date.now() - 3600000,
          asset: 'BTC',
          chain: 'Bitcoin',
          amount: 50,
          usdValue: 4_500_000,
          sourceAddress: '0x28c6c06298d514db089934071355e5743bf21d60',
          destinationAddress: 'bc1qcold1',
          direction: 'EXCHANGE_TO_WALLET',
          eventType: 'EXCHANGE_WITHDRAWAL',
          dataQuality: 'HIGH',
          provider: 'Test Provider',
          confidence: 90,
          analyticalContext: 'POSSIBLE_ACCUMULATION_CONTEXT',
          analyticalNotes: 'Accumulation flow'
        },
        {
          id: 't2',
          timestamp: Date.now() - 1800000,
          asset: 'BTC',
          chain: 'Bitcoin',
          amount: 60,
          usdValue: 5_400_000,
          sourceAddress: '0x28c6c06298d514db089934071355e5743bf21d60',
          destinationAddress: 'bc1qcold2',
          direction: 'EXCHANGE_TO_WALLET',
          eventType: 'EXCHANGE_WITHDRAWAL',
          dataQuality: 'HIGH',
          provider: 'Test Provider',
          confidence: 90,
          analyticalContext: 'POSSIBLE_ACCUMULATION_CONTEXT',
          analyticalNotes: 'Accumulation flow'
        }
      ];

      const flow = manager.summarizeExchangeFlows('BTC', mockTransfers);
      const passed =
        flow.withdrawalCount === 2 &&
        flow.depositCount === 0 &&
        flow.netFlowUsd < 0 &&
        flow.flowContext === 'ACCUMULATION_CONTEXT';

      results.push({
        testId: 5,
        testName: 'Exchange Flow Summary & Context',
        passed,
        message: passed
          ? 'Net negative exchange flow (withdrawals) correctly tagged with ACCUMULATION_CONTEXT.'
          : `Flow summary mismatch: netFlowUsd=${flow.netFlowUsd}, context=${flow.flowContext}`,
        details: { netFlowUsd: flow.netFlowUsd, flowContext: flow.flowContext }
      });
    } catch (err) {
      results.push({
        testId: 5,
        testName: 'Exchange Flow Summary & Context',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 6: Aggressive Trade / Trade Flow Classification
    try {
      const now = Date.now();
      const trades: RawTradeInput[] = [
        { tradeId: 't1', exchange: 'BINANCE', symbol: 'BTC/USDT', marketType: 'SPOT', price: 90000, quantity: 2, side: 'BUY', timestamp: now - 5000, source: 'Feed' },
        { tradeId: 't2', exchange: 'BINANCE', symbol: 'BTC/USDT', marketType: 'SPOT', price: 90010, quantity: 3, side: 'BUY', timestamp: now - 4000, source: 'Feed' },
        { tradeId: 't3', exchange: 'BINANCE', symbol: 'BTC/USDT', marketType: 'SPOT', price: 90005, quantity: 1, side: 'SELL', timestamp: now - 3000, source: 'Feed' }
      ];

      const flow = orderFlowEngine.calculateTradeFlow(trades);
      const passed = flow.aggressiveBuyVolume === 5 && flow.aggressiveSellVolume === 1 && flow.buySellRatio === 5.0 && flow.deltaVolume === 4;

      results.push({
        testId: 6,
        testName: 'Aggressive Trade / Trade Flow Classification',
        passed,
        message: passed
          ? 'Aggressive buyer and seller volume accurately computed with delta and buy/sell ratio.'
          : `Trade flow calculation mismatch: buyVol=${flow.aggressiveBuyVolume}, ratio=${flow.buySellRatio}`,
        details: flow
      });
    } catch (err) {
      results.push({
        testId: 6,
        testName: 'Aggressive Trade / Trade Flow Classification',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 7: Cumulative Volume Delta (CVD) Calculation
    try {
      const candles: Candle[] = [
        { time: 1000, open: 100, high: 102, low: 99, close: 101, volume: 1000 }, // +delta
        { time: 2000, open: 101, high: 103, low: 100, close: 102, volume: 2000 }, // +delta
        { time: 3000, open: 102, high: 102.5, low: 99, close: 99.5, volume: 1500 } // -delta
      ];

      const cvd = orderFlowEngine.calculateCVD(candles, 'BINANCE', '1h');
      const passed =
        cvd.series.length === 3 &&
        cvd.isAvailable === true &&
        cvd.series[1].cvd > cvd.series[0].cvd &&
        cvd.series[2].cvd < cvd.series[1].cvd;

      results.push({
        testId: 7,
        testName: 'Cumulative Volume Delta (CVD) Calculation',
        passed,
        message: passed
          ? 'CVD cumulative series correctly increments on upward candle volume and decrements on downward candle volume.'
          : 'CVD series calculation failure.',
        details: { seriesLength: cvd.series.length, currentDelta: cvd.currentDelta }
      });
    } catch (err) {
      results.push({
        testId: 7,
        testName: 'Cumulative Volume Delta (CVD) Calculation',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 8: Order-Book Imbalance Calculation
    try {
      const depth: RawOrderBookInput = {
        bids: [
          { price: 99.5, quantity: 100 },
          { price: 99.0, quantity: 200 }
        ],
        asks: [
          { price: 100.5, quantity: 20 },
          { price: 101.0, quantity: 30 }
        ],
        timestamp: Date.now()
      };

      const imb = orderFlowEngine.calculateOrderBookImbalance(depth, 100);
      const passed =
        imb !== null &&
        imb.state === 'BUY_SIDE_DEPTH_IMBALANCE' &&
        imb.bidDepthUsd > imb.askDepthUsd * 2;

      results.push({
        testId: 8,
        testName: 'Order-Book Imbalance Calculation',
        passed,
        message: passed
          ? 'Order-book depth within 1-2% correctly recognizes significant BUY_SIDE_DEPTH_IMBALANCE.'
          : 'Order book imbalance calculation mismatch.',
        details: imb
      });
    } catch (err) {
      results.push({
        testId: 8,
        testName: 'Order-Book Imbalance Calculation',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 9: Order-Flow Divergence Detection
    try {
      // Price higher high, CVD lower high -> Bearish divergence
      const candles: Candle[] = [
        { time: 1000, open: 100, high: 105, low: 99, close: 105, volume: 5000 },
        { time: 2000, open: 105, high: 108, low: 104, close: 107, volume: 1000 } // higher price, weaker volume delta
      ];

      const div = orderFlowEngine.detectOrderFlowDivergence(candles, 107, 200);
      // Ensure detection runs cleanly and provides non-speculative analytical description
      const passed = div !== null && typeof div.type === 'string' && typeof div.description === 'string';

      results.push({
        testId: 9,
        testName: 'Order-Flow Divergence Detection',
        passed,
        message: passed
          ? `Order-flow divergence successfully evaluated: ${div.type}`
          : 'Order-flow divergence failed.',
        details: div
      });
    } catch (err) {
      results.push({
        testId: 9,
        testName: 'Order-Flow Divergence Detection',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 10: Liquidation Spike Detection
    try {
      const now = Date.now();
      const events: LiquidationEvent[] = [
        {
          id: 'l1',
          exchange: 'BINANCE',
          symbol: 'BTC/USDT',
          marketType: 'PERPETUAL',
          timestamp: now - 60000,
          side: 'LONG_LIQUIDATION',
          price: 88000,
          quantity: 200,
          notionalUsd: 17_600_000,
          source: 'Feed'
        }
      ];

      const liqSnap = liquidationEngine.evaluateLiquidations(
        'BTC/USDT',
        'BINANCE',
        88000,
        -3.5,
        -2.0,
        events,
        5_000_000, // baseline
        2.5 // threshold
      );

      const passed = liqSnap.isSpike === true && liqSnap.spikeMultiple >= 2.5 && liqSnap.spikeStatus === 'ELEVATED LIQUIDATION ACTIVITY';

      results.push({
        testId: 10,
        testName: 'Liquidation Spike Detection',
        passed,
        message: passed
          ? `Liquidation spike detected at ${liqSnap.spikeMultiple}x baseline with ELEVATED LIQUIDATION ACTIVITY label.`
          : `Spike detection mismatch: isSpike=${liqSnap.isSpike}, multiple=${liqSnap.spikeMultiple}`,
        details: { spikeMultiple: liqSnap.spikeMultiple, isSpike: liqSnap.isSpike }
      });
    } catch (err) {
      results.push({
        testId: 10,
        testName: 'Liquidation Spike Detection',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 11: Liquidation + Price Context (Short Squeeze & Long Cascade)
    try {
      const shortSqueeze = liquidationEngine.determineLiquidationContext(3.5, -4.0, 1_000_000, 10_000_000, true);
      const longCascade = liquidationEngine.determineLiquidationContext(-3.5, -4.0, 10_000_000, 1_000_000, true);

      const passed =
        shortSqueeze.relation === 'SHORT_SQUEEZE_CONTEXT' &&
        longCascade.relation === 'LONG_SQUEEZE_DELEVERAGING_CONTEXT';

      results.push({
        testId: 11,
        testName: 'Liquidation + Price Context Evaluation',
        passed,
        message: passed
          ? 'Price/OI/Liquidation interactions properly classified into SHORT_SQUEEZE_CONTEXT and LONG_SQUEEZE_DELEVERAGING_CONTEXT.'
          : `Context mismatch: squeeze=${shortSqueeze.relation}, cascade=${longCascade.relation}`,
        details: { shortSqueeze: shortSqueeze.relation, longCascade: longCascade.relation }
      });
    } catch (err) {
      results.push({
        testId: 11,
        testName: 'Liquidation + Price Context Evaluation',
        passed: false,
        message: (err as Error).message
      });
    }

    // Test 12: Lookahead Safety (Time T isolation)
    try {
      const timestampT = 1700000000000;
      const validEvent: LiquidationEvent = {
        id: 't_valid',
        exchange: 'BINANCE',
        symbol: 'BTC/USDT',
        marketType: 'PERPETUAL',
        timestamp: timestampT - 60000,
        side: 'LONG_LIQUIDATION',
        price: 90000,
        quantity: 10,
        notionalUsd: 900000,
        source: 'Feed'
      };

      const futureEvent: LiquidationEvent = {
        id: 't_future',
        exchange: 'BINANCE',
        symbol: 'BTC/USDT',
        marketType: 'PERPETUAL',
        timestamp: timestampT + 60000, // Future!
        side: 'LONG_LIQUIDATION',
        price: 90000,
        quantity: 50,
        notionalUsd: 4500000,
        source: 'Feed'
      };

      const snapWithoutFuture = liquidationEngine.evaluateLiquidations(
        'BTC/USDT',
        'BINANCE',
        90000,
        0,
        0,
        [validEvent],
        1_000_000,
        2.5,
        timestampT
      );

      const snapWithFuture = liquidationEngine.evaluateLiquidations(
        'BTC/USDT',
        'BINANCE',
        90000,
        0,
        0,
        [validEvent, futureEvent],
        1_000_000,
        2.5,
        timestampT
      );

      const passed =
        snapWithoutFuture.totalLiquidations24h === snapWithFuture.totalLiquidations24h &&
        snapWithoutFuture.isSpike === snapWithFuture.isSpike &&
        snapWithoutFuture.currentPeriodLiquidationUsd === snapWithFuture.currentPeriodLiquidationUsd;

      results.push({
        testId: 12,
        testName: 'Strict No-Lookahead Bias Verification',
        passed,
        message: passed
          ? 'Strict time isolation verified: events occurring after timestamp T are completely discarded from calculation.'
          : 'Lookahead check failed: future event affected calculation at timestamp T.',
        details: {
          withoutFutureTotal: snapWithoutFuture.totalLiquidations24h,
          withFutureTotal: snapWithFuture.totalLiquidations24h
        }
      });
    } catch (err) {
      results.push({
        testId: 12,
        testName: 'Strict No-Lookahead Bias Verification',
        passed: false,
        message: (err as Error).message
      });
    }

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      passedCount,
      failedCount,
      totalCount: results.length,
      results
    };
  }
}
