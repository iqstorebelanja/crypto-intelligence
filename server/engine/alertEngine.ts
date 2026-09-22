import { Alert, AlertEvent, NormalizedCoinData } from '../../src/types';
import { db } from '../db/schema';
import { telegramService } from '../services/telegramService';

export class AlertEngine {
  public checkAlertsAgainstMarket(coins: NormalizedCoinData[]): AlertEvent[] {
    const activeAlerts = db.getAllActiveAlerts();
    if (!activeAlerts.length || !coins.length) return [];

    const coinMap = new Map<string, NormalizedCoinData>();
    for (const c of coins) {
      coinMap.set(c.symbol.toUpperCase(), c);
      const clean = c.symbol.replace('/', '').toUpperCase();
      coinMap.set(clean, c);
    }

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
      }

      if (isTriggered) {
        // Update alert state
        db.updateAlert(alert.userId, alert.id, {
          lastTriggeredAt: now,
          currentValue: triggerValue,
          isActive: alert.isRecurring ? true : false
        });

        const event = db.addAlertEvent({
          alertId: alert.id,
          userId: alert.userId,
          symbol: coin.symbol,
          exchange: coin.exchange,
          condition: alert.conditionType,
          conditionType: alert.conditionType,
          triggerPrice,
          actualValue: triggerValue,
          threshold: alert.threshold ?? (alert.targetValue ?? 0),
          conditionDescription,
          message: conditionDescription,
          read: false,
          status: 'TRIGGERED',
          timestamp: now,
          triggeredAt: now
        });

        triggeredEvents.push(event);

        // Asynchronously dispatch to Telegram if configured
        telegramService.sendAlertNotification(alert.userId, event).catch(err => {
          console.warn('Telegram notification delivery error:', err.message);
        });
      }
    }

    return triggeredEvents;
  }
}

export const alertEngine = new AlertEngine();
