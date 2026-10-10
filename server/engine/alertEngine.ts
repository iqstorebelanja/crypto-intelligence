import { Alert, AlertEvent, NormalizedCoinData } from '../../src/types';
import { db } from '../db/schema';
import { notificationService } from '../services/notificationService';
import { monitoringService } from '../services/monitoringService';

export class AlertEngine {
  public checkAlertsAgainstMarket(coins: NormalizedCoinData[]): AlertEvent[] {
    if (!coins || !coins.length) return [];

    const coinMap = new Map<string, NormalizedCoinData>();
    const querySymbols: string[] = [];
    for (const c of coins) {
      const symUpper = c.symbol.toUpperCase();
      const clean = c.symbol.replace('/', '').toUpperCase();
      coinMap.set(symUpper, c);
      coinMap.set(clean, c);
      querySymbols.push(symUpper, clean);
    }

    // High performance indexed routing: evaluate ONLY active alerts matching the updated coins
    const activeAlerts = db.getActiveAlertsForSymbols(querySymbols);
    if (!activeAlerts.length) return [];

    const triggeredEvents: AlertEvent[] = [];
    const now = Date.now();

    for (const alert of activeAlerts) {
      const coin = coinMap.get(alert.symbol.toUpperCase()) || coinMap.get(alert.symbol.replace('/', '').toUpperCase());
      if (!coin) continue;

      // Check exchange match if specified
      if (alert.exchange && coin.exchange && alert.exchange !== coin.exchange) {
        continue;
      }

      // Check cooldown
      const cooldownMs = (alert.cooldownMinutes || 15) * 60 * 1000;
      if (alert.lastTriggeredAt && now - alert.lastTriggeredAt < cooldownMs) {
        continue;
      }

      let isTriggered = false;
      let triggerPrice = coin.price;
      let triggerValue = coin.price;
      let conditionDescription = '';

      const target = alert.targetValue ?? 0;
      const rsi = coin.indicators.rsi14;
      const bullScore = coin.scores.bullScore;
      const riskScore = coin.scores.downsideRiskScore;
      const structEvent = coin.marketStructure.event;
      const oiChange = coin.derivatives?.openInterestChange24h ?? coin.derivatives?.openInterestChange1h ?? 0;
      const fundingRate = coin.derivatives?.fundingRate ?? 0;

      switch (alert.conditionType) {
        case 'PRICE_ABOVE':
          if (coin.price >= target) {
            isTriggered = true;
            triggerValue = coin.price;
            conditionDescription = `Price ($${coin.price.toLocaleString()}) rose above threshold ($${target.toLocaleString()})`;
          }
          break;

        case 'PRICE_BELOW':
          if (coin.price <= target) {
            isTriggered = true;
            triggerValue = coin.price;
            conditionDescription = `Price ($${coin.price.toLocaleString()}) fell below threshold ($${target.toLocaleString()})`;
          }
          break;

        case 'PRICE_PCT_UP': {
          const base = alert.basePrice ?? target;
          const pct = alert.percentThreshold ?? (base > 0 ? ((target - base) / base) * 100 : 0);
          const targetPrice = alert.targetValue ?? (base * (1 + pct / 100));
          const currentPct = base > 0 ? ((coin.price - base) / base) * 100 : 0;
          if (coin.price >= targetPrice || (pct > 0 && currentPct >= pct)) {
            isTriggered = true;
            triggerPrice = coin.price;
            triggerValue = Number(currentPct.toFixed(2));
            conditionDescription = `${coin.symbol} surged by +${currentPct.toFixed(2)}% (Current: $${coin.price.toLocaleString()} vs Baseline: $${base.toLocaleString()}, Target: +${pct}%)`;
          }
          break;
        }

        case 'PRICE_PCT_DOWN': {
          const base = alert.basePrice ?? target;
          const pct = Math.abs(alert.percentThreshold ?? (base > 0 ? ((base - target) / base) * 100 : 0));
          const targetPrice = alert.targetValue ?? (base * (1 - pct / 100));
          const currentPct = base > 0 ? ((coin.price - base) / base) * 100 : 0;
          if (coin.price <= targetPrice || (pct > 0 && currentPct <= -pct)) {
            isTriggered = true;
            triggerPrice = coin.price;
            triggerValue = Number(currentPct.toFixed(2));
            conditionDescription = `${coin.symbol} dropped by ${currentPct.toFixed(2)}% (Current: $${coin.price.toLocaleString()} vs Baseline: $${base.toLocaleString()}, Target: -${pct}%)`;
          }
          break;
        }

        case 'PRICE_PCT_ANY': {
          const base = alert.basePrice ?? coin.price;
          const pct = Math.abs(alert.percentThreshold ?? 5);
          const currentPct = base > 0 ? ((coin.price - base) / base) * 100 : 0;
          if (Math.abs(currentPct) >= pct) {
            isTriggered = true;
            triggerPrice = coin.price;
            triggerValue = Number(currentPct.toFixed(2));
            conditionDescription = `${coin.symbol} moved by ${currentPct >= 0 ? '+' : ''}${currentPct.toFixed(2)}% (Current: $${coin.price.toLocaleString()} vs Baseline: $${base.toLocaleString()}, Threshold: ±${pct}%)`;
          }
          break;
        }

        case 'PRICE_CHANGE_PCT_ABOVE':
          if (coin.change24h >= target) {
            isTriggered = true;
            triggerValue = coin.change24h;
            conditionDescription = `${coin.symbol} 24h change rose to +${coin.change24h.toFixed(2)}% (Threshold: >= ${target}%)`;
          }
          break;

        case 'PRICE_CHANGE_PCT_BELOW':
          if (coin.change24h <= target) {
            isTriggered = true;
            triggerValue = coin.change24h;
            conditionDescription = `${coin.symbol} 24h change dropped to ${coin.change24h.toFixed(2)}% (Threshold: <= ${target}%)`;
          }
          break;

        case 'RSI_ABOVE':
          if (rsi >= target) {
            isTriggered = true;
            triggerValue = rsi;
            conditionDescription = `RSI14 reached ${rsi} (Threshold: > ${target})`;
          }
          break;

        case 'RSI_BELOW':
          if (rsi <= target) {
            isTriggered = true;
            triggerValue = rsi;
            conditionDescription = `RSI14 dropped to ${rsi} (Threshold: < ${target})`;
          }
          break;

        case 'BULL_SCORE_ABOVE':
          if (bullScore >= target) {
            isTriggered = true;
            triggerValue = bullScore;
            conditionDescription = `Bull Score rose to ${bullScore}/100 (Threshold: >= ${target})`;
          }
          break;

        case 'BULL_SCORE_BELOW':
          if (bullScore <= target) {
            isTriggered = true;
            triggerValue = bullScore;
            conditionDescription = `Bull Score slipped to ${bullScore}/100 (Threshold: <= ${target})`;
          }
          break;

        case 'DOWNSIDE_RISK_ABOVE':
          if (riskScore >= target) {
            isTriggered = true;
            triggerValue = riskScore;
            conditionDescription = `Downside Risk score elevated to ${riskScore}/100 (Threshold: >= ${target})`;
          }
          break;

        case 'BREAKOUT_DETECTED':
          if (structEvent === 'Potential Breakout' || coin.marketStructure.volumeConfirmed && coin.price > coin.marketStructure.lastSwingHigh) {
            isTriggered = true;
            triggerValue = coin.price;
            conditionDescription = `Technical breakout detected: Price exceeded resistance at $${coin.marketStructure.lastSwingHigh.toLocaleString()} with volume confirmation.`;
          }
          break;

        case 'BREAKDOWN_DETECTED':
          if (structEvent === 'Potential Breakdown' || coin.price < coin.marketStructure.lastSwingLow) {
            isTriggered = true;
            triggerValue = coin.price;
            conditionDescription = `Technical breakdown detected: Price pierced support at $${coin.marketStructure.lastSwingLow.toLocaleString()}.`;
          }
          break;

        case 'RETEST_DETECTED':
          if (structEvent === 'Potential Retest Zone' || structEvent === 'Support Retest' || structEvent === 'Resistance Retest') {
            isTriggered = true;
            triggerValue = coin.price;
            conditionDescription = `Retest zone test: ${coin.marketStructure.retestZone?.description || 'Price retesting structural swing zone.'}`;
          }
          break;

        case 'OI_SPIKE':
          if (Math.abs(oiChange) >= (target || 5)) {
            isTriggered = true;
            triggerValue = oiChange;
            conditionDescription = `Open interest surge of ${oiChange > 0 ? '+' : ''}${oiChange.toFixed(2)}% detected (Threshold: >= ${target || 5}%)`;
          }
          break;

        case 'FUNDING_FLIP':
          if (coin.derivatives?.fundingTrend === 'Positive' && fundingRate > 0.0003) {
            isTriggered = true;
            triggerValue = fundingRate;
            conditionDescription = `Funding rate expanded to ${(fundingRate * 100).toFixed(4)}% (Elevated Longs)`;
          } else if (coin.derivatives?.fundingTrend === 'Negative') {
            isTriggered = true;
            triggerValue = fundingRate;
            conditionDescription = `Funding rate flipped negative to ${(fundingRate * 100).toFixed(4)}% (Short bias)`;
          }
          break;

        case 'SIGNAL_BULLISH_CONFIRMED':
          if (coin.signal?.direction === 'BULLISH' && (coin.signal.status === 'CONFIRMED' || coin.signal.status === 'ACTIVE')) {
            isTriggered = true;
            triggerValue = coin.signal.strength;
            conditionDescription = `Bullish Signal Confirmed: ${coin.signal.signalType} (Strength: ${coin.signal.strength}/100, MTF Confluent)`;
          }
          break;

        case 'SIGNAL_BEARISH_CONFIRMED':
          if (coin.signal?.direction === 'BEARISH' && (coin.signal.status === 'CONFIRMED' || coin.signal.status === 'ACTIVE')) {
            isTriggered = true;
            triggerValue = coin.signal.strength;
            conditionDescription = `Bearish Signal Confirmed: ${coin.signal.signalType} (Strength: ${coin.signal.strength}/100, Downside Risk: ${coin.signal.downsideRiskStrength}/100)`;
          }
          break;

        case 'SIGNAL_STRENGTH_ABOVE':
          if ((coin.signal?.strength ?? 0) >= (target || 70)) {
            isTriggered = true;
            triggerValue = coin.signal?.strength ?? 0;
            conditionDescription = `Signal Strength reached ${triggerValue}/100 (Threshold: >= ${target || 70}) for ${coin.signal?.signalType || 'Signal'}`;
          }
          break;

        case 'SIGNAL_BREAKOUT_CONFIRMED':
          if (coin.signal?.signalType === 'BULLISH_BREAKOUT' || coin.signal?.breakoutContext?.state === 'BREAKOUT CONFIRMED') {
            isTriggered = true;
            triggerValue = coin.price;
            conditionDescription = `Breakout Confirmed: ${coin.signal?.breakoutContext?.description || `Price confirmed breakout above $${coin.marketStructure.lastSwingHigh}`}`;
          }
          break;

        case 'SIGNAL_BREAKDOWN_CONFIRMED':
          if (coin.signal?.signalType === 'BEARISH_BREAKDOWN') {
            isTriggered = true;
            triggerValue = coin.price;
            conditionDescription = `Breakdown Confirmed: Price pierced below support at $${coin.marketStructure.lastSwingLow} with downside momentum`;
          }
          break;

        case 'SIGNAL_MTF_ALIGNED':
          if (coin.signal?.multiTimeframeSummary?.isConfluent) {
            isTriggered = true;
            triggerValue = coin.signal.multiTimeframeSummary.alignmentScore;
            conditionDescription = `Multi-Timeframe Alignment: ${coin.signal.multiTimeframeSummary.summaryText} (Score: ${triggerValue}/100)`;
          }
          break;

        case 'SIGNAL_INVALIDATED':
          if (coin.signal?.status === 'INVALIDATED') {
            isTriggered = true;
            triggerValue = coin.price;
            conditionDescription = `Signal Invalidated: ${coin.signal.invalidationReason || 'Price crossed invalidation boundary'}`;
          }
          break;

        case 'SIGNAL_RISK_ELEVATED':
          if ((coin.signal?.downsideRiskStrength ?? coin.scores.downsideRiskScore) >= (target || 65)) {
            isTriggered = true;
            triggerValue = coin.signal?.downsideRiskStrength ?? coin.scores.downsideRiskScore;
            conditionDescription = `Elevated Downside Risk: Downside signal strength elevated to ${triggerValue}/100 (Threshold: >= ${target || 65})`;
          }
          break;

        case 'LARGE_WHALE_TRANSFER': {
          const largestTx = coin.externalIntelligence?.whaleAggregations?.['1h']?.largestTransferUsd || 0;
          const threshold = target || 10_000_000;
          if (largestTx >= threshold) {
            isTriggered = true;
            triggerValue = largestTx;
            conditionDescription = `Large Whale Transfer: On-chain transfer of $${(largestTx / 1e6).toFixed(1)}M detected (Threshold: >= $${(threshold / 1e6).toFixed(1)}M)`;
          }
          break;
        }

        case 'EXCHANGE_INFLOW_SPIKE': {
          const inflow = coin.externalIntelligence?.whaleAggregations?.['1h']?.exchangeInflowUsd || 0;
          const threshold = target || 15_000_000;
          if (inflow >= threshold) {
            isTriggered = true;
            triggerValue = inflow;
            conditionDescription = `Exchange Inflow Surge: $${(inflow / 1e6).toFixed(1)}M deposited to exchanges in past 1h (Threshold: >= $${(threshold / 1e6).toFixed(1)}M)`;
          }
          break;
        }

        case 'EXCHANGE_OUTFLOW_SPIKE': {
          const outflow = coin.externalIntelligence?.whaleAggregations?.['1h']?.exchangeOutflowUsd || 0;
          const threshold = target || 15_000_000;
          if (outflow >= threshold) {
            isTriggered = true;
            triggerValue = outflow;
            conditionDescription = `Exchange Outflow Surge: $${(outflow / 1e6).toFixed(1)}M withdrawn from exchanges in past 1h (Threshold: >= $${(threshold / 1e6).toFixed(1)}M)`;
          }
          break;
        }

        case 'DEX_VOLUME_SPIKE': {
          const spikeRatio = coin.externalIntelligence?.dexMetrics?.volumeSpikeRatio || 1.0;
          const threshold = target || 1.8;
          if (spikeRatio >= threshold) {
            isTriggered = true;
            triggerValue = spikeRatio;
            conditionDescription = `DEX Volume Spike: AMM volume surge at ${spikeRatio.toFixed(2)}x baseline (Threshold: >= ${threshold}x)`;
          }
          break;
        }

        case 'DEX_LIQUIDITY_CHANGE': {
          const liqChange = Math.abs(coin.externalIntelligence?.dexMetrics?.liquidityChange24hPct || 0);
          const threshold = target || 5.0;
          if (liqChange >= threshold) {
            isTriggered = true;
            triggerValue = coin.externalIntelligence?.dexMetrics?.liquidityChange24hPct || 0;
            conditionDescription = `DEX Liquidity Shift: Monitored AMM pool liquidity changed by ${triggerValue > 0 ? '+' : ''}${triggerValue.toFixed(1)}% (Threshold: ±${threshold}%)`;
          }
          break;
        }
      }

      if (isTriggered) {
        // Update alert state
        db.updateAlert(alert.userId, alert.id, {
          lastTriggeredAt: now,
          currentValue: triggerValue,
          isActive: alert.isRecurring ? true : false
        });

        // Determine Unified Category & Severity
        let category: any = 'Bull Signal';
        let severity: any = 'MEDIUM';
        let title = `${coin.symbol} Alert Triggered`;

        if (alert.conditionType.includes('BULL_SCORE')) {
          category = 'Bull Score threshold';
          severity = 'HIGH';
          title = `${coin.symbol} Bull Score Threshold Reached`;
        } else if (alert.conditionType.includes('RISK')) {
          category = 'Downside Risk threshold';
          severity = 'HIGH';
          title = `${coin.symbol} Downside Risk Elevated`;
        } else if (alert.conditionType.includes('RSI')) {
          category = 'RSI';
          severity = 'MEDIUM';
          title = `${coin.symbol} RSI Alert Triggered`;
        } else if (alert.conditionType.includes('OI')) {
          category = 'Open Interest';
          severity = 'HIGH';
          title = `${coin.symbol} Open Interest Surge`;
        } else if (alert.conditionType.includes('FUNDING')) {
          category = 'Funding';
          severity = 'MEDIUM';
          title = `${coin.symbol} Funding Rate Shift`;
        } else if (alert.conditionType === 'BREAKOUT_DETECTED' || alert.conditionType === 'SIGNAL_BREAKOUT_CONFIRMED') {
          category = 'Breakout';
          severity = 'HIGH';
          title = `${coin.symbol} Breakout Confirmed`;
        } else if (alert.conditionType === 'BREAKDOWN_DETECTED' || alert.conditionType === 'SIGNAL_BREAKDOWN_CONFIRMED') {
          category = 'Breakdown';
          severity = 'HIGH';
          title = `${coin.symbol} Breakdown Confirmed`;
        } else if (alert.conditionType === 'RETEST_DETECTED') {
          category = 'Retest';
          severity = 'MEDIUM';
          title = `${coin.symbol} Retest Zone Active`;
        } else if (alert.conditionType === 'SIGNAL_BULLISH_CONFIRMED') {
          category = 'Bull Signal';
          severity = 'HIGH';
          title = `${coin.symbol} Bullish Continuation Confirmed`;
        } else if (alert.conditionType === 'SIGNAL_BEARISH_CONFIRMED') {
          category = 'Bearish Signal';
          severity = 'HIGH';
          title = `${coin.symbol} Bearish Signal Confirmed`;
        } else if (alert.conditionType.includes('PRICE')) {
          category = 'Breakout';
          severity = 'MEDIUM';
          title = `${coin.symbol} Price Alert Triggered`;
        } else if (alert.conditionType === 'LARGE_WHALE_TRANSFER') {
          category = 'Whale/On-chain';
          severity = 'HIGH';
          title = `${coin.symbol} Large Whale Transfer Detected`;
          monitoringService.recordExternalAlertGenerated();
        } else if (alert.conditionType === 'EXCHANGE_INFLOW_SPIKE') {
          category = 'Whale/On-chain';
          severity = 'HIGH';
          title = `${coin.symbol} Exchange Inflow Surge`;
          monitoringService.recordExternalAlertGenerated();
        } else if (alert.conditionType === 'EXCHANGE_OUTFLOW_SPIKE') {
          category = 'Whale/On-chain';
          severity = 'HIGH';
          title = `${coin.symbol} Exchange Outflow Surge`;
          monitoringService.recordExternalAlertGenerated();
        } else if (alert.conditionType === 'DEX_VOLUME_SPIKE') {
          category = 'Whale/On-chain';
          severity = 'MEDIUM';
          title = `${coin.symbol} DEX Volume Surge`;
          monitoringService.recordExternalAlertGenerated();
        } else if (alert.conditionType === 'DEX_LIQUIDITY_CHANGE') {
          category = 'Whale/On-chain';
          severity = 'MEDIUM';
          title = `${coin.symbol} DEX Liquidity Shift`;
          monitoringService.recordExternalAlertGenerated();
        }

        // Create and dispatch through Central Notification Service with snapshot & deduplication
        const isCandleCloseCondition =
          alert.conditionType === 'SIGNAL_BULLISH_CONFIRMED' ||
          alert.conditionType === 'SIGNAL_BEARISH_CONFIRMED' ||
          alert.conditionType === 'SIGNAL_BREAKOUT_CONFIRMED' ||
          alert.conditionType === 'SIGNAL_BREAKDOWN_CONFIRMED';

        const isCandleClosed = coin.signal ? coin.signal.status === 'CONFIRMED' : true;

        notificationService.createNotification({
          userId: alert.userId,
          category,
          type: alert.conditionType,
          severity,
          title,
          message: conditionDescription,
          symbol: coin.symbol,
          exchange: coin.exchange || 'BINANCE',
          marketType: (coin.derivatives ? 'PERPETUAL' : 'SPOT') as any,
          timeframe: alert.timeframe || '1H',
          direction: coin.signal?.direction || (category === 'Bull Signal' ? 'BULLISH' : category === 'Bearish Signal' ? 'BEARISH' : 'NEUTRAL'),
          source: 'Alert Engine',
          sourceId: alert.id,
          requiresCandleClose: isCandleCloseCondition,
          isCandleClosed,
          isDataFresh: true,
          snapshot: {
            triggerPrice,
            indicatorSnapshot: {
              rsi: coin.indicators.rsi14,
              price: coin.price,
              change24h: coin.change24h
            },
            structureSnapshot: {
              event: coin.marketStructure.event,
              lastSwingHigh: coin.marketStructure.lastSwingHigh,
              lastSwingLow: coin.marketStructure.lastSwingLow
            },
            scoreSnapshot: {
              bullScore: coin.scores.bullScore,
              downsideRiskScore: coin.scores.downsideRiskScore
            }
          }
        }).then(res => {
          if (res.notification) {
            // Mirror as alert event
            triggeredEvents.push({
              id: res.notification.id,
              alertId: alert.id,
              userId: alert.userId,
              category: res.notification.category as any,
              type: alert.conditionType,
              severity: res.notification.severity,
              exchange: coin.exchange || 'BINANCE',
              marketId: coin.symbol.replace(/[\/\-_]/g, ''),
              symbol: coin.symbol,
              timeframe: alert.timeframe || '1H',
              title,
              message: conditionDescription,
              timestamp: now,
              source: 'Alert Engine',
              status: 'TRIGGERED',
              read: false,
              triggerValue,
              threshold: alert.threshold ?? (alert.targetValue ?? 0),
              triggerPrice,
              condition: alert.conditionType,
              conditionDescription,
              triggeredAt: now
            });
          }
        }).catch(err => {
          console.warn('[AlertEngine] Notification service error:', err.message);
        });
      }
    }

    return triggeredEvents;
  }
}

export const alertEngine = new AlertEngine();
