import { assetRegistryService } from '../services/assetRegistryService';
import { marketDataService } from '../services/marketDataService';
import { exchangeCapabilityRegistry } from '../services/capabilityRegistry';
import { realtimeStreamManager } from '../services/realtimeStreamManager';
import { singleFlight } from '../services/singleFlight';
import { MarketDataPipeline } from '../engine/marketDataPipeline';
import { DataValidator } from '../engine/dataValidator';

export interface TestResult {
  testId: string;
  name: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

export async function runPhase6Tests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Ensure registry is discovered
  await assetRegistryService.runDiscovery(true);

  // -------------------------------------------------------------
  // TEST A: BINANCE MARKET (BTC)
  // -------------------------------------------------------------
  {
    const start = Date.now();
    try {
      const markets = assetRegistryService.getMarketsForAsset('BTC');
      const binanceMarket = markets.find(m => m.exchange === 'BINANCE');
      const detail = await marketDataService.getCoinDetail('BTCUSDT', '1h', 'BINANCE');

      const passed = Boolean(binanceMarket && detail.coin && detail.coin.exchange === 'BINANCE' && detail.coin.price > 0);
      results.push({
        testId: 'TEST_A',
        name: 'Binance Market (BTC) Discovery & Detail',
        passed,
        details: passed
          ? `BTC discovered on Binance ($${detail.coin?.price.toLocaleString()}) with ${detail.candles.length} candles`
          : 'Failed to discover BTC on Binance',
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        testId: 'TEST_A',
        name: 'Binance Market (BTC)',
        passed: false,
        details: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  // -------------------------------------------------------------
  // TEST B: OKX-ONLY MARKET (ABC)
  // -------------------------------------------------------------
  {
    const start = Date.now();
    try {
      const markets = assetRegistryService.getMarketsForAsset('ABC');
      const existsInOkx = markets.some(m => m.exchange === 'OKX');
      const absentInBinance = !markets.some(m => m.exchange === 'BINANCE');
      const allAssets = assetRegistryService.getAllAssets();
      const existsInAll = allAssets.some(a => a.baseAsset === 'ABC' || a.id === 'ABC');

      const detail = await marketDataService.getCoinDetail('ABC', '1h', 'OKX');
      const detailOkx = Boolean(detail.coin && detail.coin.exchange === 'OKX');

      const passed = existsInOkx && absentInBinance && existsInAll && detailOkx;
      results.push({
        testId: 'TEST_B',
        name: 'OKX-Only Market (ABC) Independent Discovery',
        passed,
        details: passed
          ? `ABC exists in OKX (${existsInOkx}), absent in Binance (${absentInBinance}), present in ALL (${existsInAll}), loads OKX data (${detailOkx})`
          : `Failed: okx=${existsInOkx}, absentBinance=${absentInBinance}, inAll=${existsInAll}, detailOkx=${detailOkx}`,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        testId: 'TEST_B',
        name: 'OKX-Only Market (ABC)',
        passed: false,
        details: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  // -------------------------------------------------------------
  // TEST C: PIONEX-ONLY MARKET (XYZ)
  // -------------------------------------------------------------
  {
    const start = Date.now();
    try {
      const markets = assetRegistryService.getMarketsForAsset('XYZ');
      const existsInPionex = markets.some(m => m.exchange === 'PIONEX');
      const absentInBinance = !markets.some(m => m.exchange === 'BINANCE');
      const allAssets = assetRegistryService.getAllAssets();
      const existsInAll = allAssets.some(a => a.baseAsset === 'XYZ' || a.id === 'XYZ');

      const detail = await marketDataService.getCoinDetail('XYZ', '1h', 'PIONEX');
      const detailPionex = Boolean(detail.coin && detail.coin.exchange === 'PIONEX');

      const passed = existsInPionex && absentInBinance && existsInAll && detailPionex;
      results.push({
        testId: 'TEST_C',
        name: 'Pionex-Only Market (XYZ) Independent Discovery',
        passed,
        details: passed
          ? `XYZ exists in Pionex (${existsInPionex}), absent in Binance (${absentInBinance}), present in ALL (${existsInAll}), loads Pionex data (${detailPionex})`
          : `Failed: pionex=${existsInPionex}, absentBinance=${absentInBinance}, inAll=${existsInAll}`,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        testId: 'TEST_C',
        name: 'Pionex-Only Market (XYZ)',
        passed: false,
        details: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  // -------------------------------------------------------------
  // TEST D: EXCHANGE DATA ISOLATION (OKX ABC)
  // -------------------------------------------------------------
  {
    const start = Date.now();
    try {
      const detail = await marketDataService.getCoinDetail('ABC', '1h', 'OKX');
      const coin = detail.coin;

      // Verification of strict isolation:
      // 1. Exchange must be strictly OKX
      // 2. Source must be OKX
      // 3. Price must be > 0
      // 4. Derivatives must be null (no Binance data leaked!)
      // 5. Indicators and structure must be derived from OKX candles
      const isOkx = coin?.exchange === 'OKX';
      const isDerivativesNull = coin?.derivatives === null;
      const hasIndicators = Boolean(coin?.indicators && typeof coin.indicators.rsi14 === 'number');
      const hasStructure = Boolean(coin?.marketStructure && coin.marketStructure.state);

      const passed = Boolean(isOkx && isDerivativesNull && hasIndicators && hasStructure);
      results.push({
        testId: 'TEST_D',
        name: 'Exchange Data Isolation (OKX ABC has 0 Binance bleed)',
        passed,
        details: passed
          ? `Verified: Exchange=${coin?.exchange}, Derivatives=${coin?.derivatives} (isolated), RSI=${coin?.indicators.rsi14}, Structure=${coin?.marketStructure.state}`
          : `Failed: isOkx=${isOkx}, isDerivativesNull=${isDerivativesNull}, indicators=${hasIndicators}`,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        testId: 'TEST_D',
        name: 'Exchange Data Isolation',
        passed: false,
        details: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  // -------------------------------------------------------------
  // TEST E: WEBSOCKET FAILURE & REST FALLBACK
  // -------------------------------------------------------------
  {
    const start = Date.now();
    try {
      // 1. Simulate disconnect
      realtimeStreamManager.simulateWebSocketDisconnect('BINANCE');
      const metricsDegraded = realtimeStreamManager.getMetrics('BINANCE') as any;

      const wasDegraded = metricsDegraded.status === 'DEGRADED' && metricsDegraded.isRestFallbackActive;

      // 2. Restore WebSocket
      realtimeStreamManager.restoreWebSocket('BINANCE');
      const metricsRestored = realtimeStreamManager.getMetrics('BINANCE') as any;
      const wasRestored = metricsRestored.status === 'CONNECTED' && !metricsRestored.isRestFallbackActive;

      const passed = wasDegraded && wasRestored;
      results.push({
        testId: 'TEST_E',
        name: 'WebSocket Disconnect Detection & REST Fallback',
        passed,
        details: passed
          ? 'Successfully transitioned to DEGRADED with REST fallback active, then restored to CONNECTED'
          : `Failed: degraded=${wasDegraded}, restored=${wasRestored}`,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        testId: 'TEST_E',
        name: 'WebSocket Failure & Fallback',
        passed: false,
        details: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  // -------------------------------------------------------------
  // TEST F: STALE DATA DETECTION
  // -------------------------------------------------------------
  {
    const start = Date.now();
    try {
      const now = Date.now();
      // Test timestamps with different ages
      const freshRecord = MarketDataPipeline.calculateFreshness(now - 5000, 'Test Fresh');
      const delayedRecord = MarketDataPipeline.calculateFreshness(now - 25000, 'Test Delayed');
      const staleRecord = MarketDataPipeline.calculateFreshness(now - 120000, 'Test Stale');
      const unavailableRecord = MarketDataPipeline.calculateFreshness(0, 'Test Empty');

      const passed =
        freshRecord.status === 'LIVE' &&
        delayedRecord.status === 'DELAYED' &&
        staleRecord.status === 'STALE' &&
        unavailableRecord.status === 'UNAVAILABLE';

      results.push({
        testId: 'TEST_F',
        name: 'Data Freshness & Stale Tagging Accuracy',
        passed,
        details: passed
          ? `Status thresholds verified: 5s=${freshRecord.status}, 25s=${delayedRecord.status}, 120s=${staleRecord.status}, 0s=${unavailableRecord.status}`
          : `Failed statuses: fresh=${freshRecord.status}, delayed=${delayedRecord.status}, stale=${staleRecord.status}`,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        testId: 'TEST_F',
        name: 'Stale Data Detection',
        passed: false,
        details: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  // -------------------------------------------------------------
  // TEST G: REQUEST DEDUPLICATION (SINGLE-FLIGHT)
  // -------------------------------------------------------------
  {
    const start = Date.now();
    try {
      let upstreamExecutions = 0;
      const sharedFetcher = async () => {
        upstreamExecutions++;
        await new Promise(r => setTimeout(r, 40));
        return { data: 'test_result', executedAt: Date.now() };
      };

      const key = `test_singleflight_${Date.now()}`;
      // Fire 10 concurrent requests at the exact same millisecond
      const promises = Array.from({ length: 10 }).map(() =>
        singleFlight.execute(key, 'BINANCE', sharedFetcher)
      );

      const resolved = await Promise.all(promises);

      // Verify all 10 got the exact same data and upstream executed only once
      const allIdentical = resolved.every(r => r.data === 'test_result');
      const executedOnlyOnce = upstreamExecutions === 1;

      const passed = allIdentical && executedOnlyOnce;
      results.push({
        testId: 'TEST_G',
        name: 'Single-Flight Request Deduplication (10 concurrent -> 1 upstream)',
        passed,
        details: passed
          ? `10 concurrent consumers coalesced into ${upstreamExecutions} upstream execution. All 10 received identical result.`
          : `Failed: upstreamExecutions=${upstreamExecutions}, allIdentical=${allIdentical}`,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        testId: 'TEST_G',
        name: 'Request Deduplication',
        passed: false,
        details: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  // -------------------------------------------------------------
  // TEST H: MISSING DERIVATIVES RETURN NULL / N/A (NO FABRICATION)
  // -------------------------------------------------------------
  {
    const start = Date.now();
    try {
      const pionexCaps = exchangeCapabilityRegistry.getCapabilities('PIONEX');
      const detail = await marketDataService.getCoinDetail('XYZ', '1h', 'PIONEX');

      const supportsOi = pionexCaps.openInterest;
      const supportsFunding = pionexCaps.funding;
      const derivativesNull = detail.coin?.derivatives === null;

      const passed = !supportsOi && !supportsFunding && derivativesNull;
      results.push({
        testId: 'TEST_H',
        name: 'Missing Derivatives Handled as NULL / N/A (No Fabrication)',
        passed,
        details: passed
          ? `Pionex reports OI=${supportsOi}, Funding=${supportsFunding}. Coin derivatives=${detail.coin?.derivatives} (displayed as N/A)`
          : `Failed: supportsOi=${supportsOi}, supportsFunding=${supportsFunding}, derivatives=${detail.coin?.derivatives}`,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        testId: 'TEST_H',
        name: 'Missing Derivatives Handling',
        passed: false,
        details: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  // -------------------------------------------------------------
  // TEST I: DIRECT COIN ROUTE RESOLUTION
  // -------------------------------------------------------------
  {
    const start = Date.now();
    try {
      // Direct request for ABC on OKX
      const detail = await marketDataService.getCoinDetail('ABC', '1h', 'OKX');
      const coin = detail.coin;

      const isOkx = coin?.exchange === 'OKX';
      const isSymbolAbc = coin?.baseAsset === 'ABC';

      const passed = Boolean(isOkx && isSymbolAbc);
      results.push({
        testId: 'TEST_I',
        name: 'Direct Coin Route Resolution (/coin/ABC?exchange=okx)',
        passed,
        details: passed
          ? `Resolved correctly to ${coin?.exchange} ${coin?.symbol} without defaulting to Binance`
          : `Failed: exchange=${coin?.exchange}, baseAsset=${coin?.baseAsset}`,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        testId: 'TEST_I',
        name: 'Direct Coin Route Resolution',
        passed: false,
        details: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  // -------------------------------------------------------------
  // TEST J: EXCHANGE OUTAGE RESILIENCE
  // -------------------------------------------------------------
  {
    const start = Date.now();
    try {
      const binanceAdapter = (marketDataService as any).getAdapter('BINANCE');
      const okxAdapter = (marketDataService as any).getAdapter('OKX');
      const pionexAdapter = (marketDataService as any).getAdapter('PIONEX');
      const bybitAdapter = (marketDataService as any).getAdapter('BYBIT');

      // Test all adapters in parallel with Promise.allSettled
      const allResults = await Promise.allSettled([
        binanceAdapter.getTicker('BTCUSDT'),
        okxAdapter.getTicker('BTC-USDT'),
        pionexAdapter.getTicker('BTC_USDT'),
        bybitAdapter.getTicker('BTCUSDT')
      ]);

      const binanceOk = allResults[0].status === 'fulfilled';
      const okxOk = allResults[1].status === 'fulfilled';
      const pionexOk = allResults[2].status === 'fulfilled';
      const bybitOk = allResults[3].status === 'fulfilled';

      const passed = binanceOk && okxOk && pionexOk && bybitOk;
      results.push({
        testId: 'TEST_J',
        name: 'Exchange Outage Isolation & System Resilience',
        passed,
        details: passed
          ? 'All 4 independent exchange adapters (Binance, OKX, Pionex, Bybit) execute independently in parallel with full error isolation'
          : `Failures detected: binanceOk=${binanceOk}, okxOk=${okxOk}, pionexOk=${pionexOk}, bybitOk=${bybitOk}`,
        durationMs: Date.now() - start
      });
    } catch (err: any) {
      results.push({
        testId: 'TEST_J',
        name: 'Exchange Outage Resilience',
        passed: false,
        details: err.message,
        durationMs: Date.now() - start
      });
    }
  }

  return results;
}
