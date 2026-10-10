import {
  AlertEventStatus,
  AlertEvidenceItem,
  AlertSeverity,
  DEFAULT_NOTIFICATION_PREFERENCES,
  ExchangeId,
  NormalizedCoinData,
  UnifiedAlert,
  UnifiedAlertCategory,
  UserNotificationPreferences
} from '../../src/types';
import { db } from '../db/schema';
import { telegramService } from './telegramService';

export interface AlertFilterParams {
  categoryGroup?: 'all' | 'signals' | 'whale' | 'risk' | 'technical' | 'orderFlow' | 'health';
  category?: UnifiedAlertCategory;
  exchange?: string;
  symbol?: string;
  severity?: AlertSeverity;
  status?: AlertEventStatus;
  unreadOnly?: boolean;
  limit?: number;
}

export class NotificationEngine {
  private userPreferences: Map<string, UserNotificationPreferences> = new Map();
  private lastAlertTimestamps: Map<string, number> = new Map(); // key: `${userId}_${symbol}_${category}` -> timestamp
  private hourlyAlertCounters: Map<string, { count: number; hourWindow: number }> = new Map();

  constructor() {
    // Seed default preferences for demo users
    this.userPreferences.set('usr_demo_terminal', {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      userId: 'usr_demo_terminal'
    });
    this.userPreferences.set('usr_demo_1', {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      userId: 'usr_demo_1'
    });

    // Seed realistic operational alerts for demo users
    this.seedInitialOperationalAlerts('usr_demo_terminal');
    this.seedInitialOperationalAlerts('usr_demo_1');
  }

  /**
   * Category grouping mapping for unified filtering
   */
  public getCategoryGroup(category: UnifiedAlertCategory): 'signals' | 'whale' | 'risk' | 'technical' | 'orderFlow' | 'health' {
    switch (category) {
      case 'Bull Signal':
      case 'Bearish Signal':
      case 'Breakout':
      case 'Breakdown':
      case 'Retest':
        return 'signals';
      case 'Whale Activity':
      case 'Large Exchange Deposit':
      case 'Large Exchange Withdrawal':
        return 'whale';
      case 'Downside Risk threshold':
      case 'Liquidation':
      case 'BTC Market Condition':
        return 'risk';
      case 'Bull Score threshold':
      case 'RSI':
      case 'Volume Spike':
      case 'Open Interest':
      case 'Funding':
      case 'Market Structure':
        return 'technical';
      case 'Order Flow':
      case 'CVD Divergence':
        return 'orderFlow';
      case 'Data/Exchange health':
        return 'health';
      default:
        return 'technical';
    }
  }

  /**
   * Retrieves or initializes user preferences
   */
  public getUserPreferences(userId: string): UserNotificationPreferences {
    const existing = this.userPreferences.get(userId);
    if (existing) return existing;

    const newPrefs: UserNotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      userId
    };
    this.userPreferences.set(userId, newPrefs);
    return newPrefs;
  }

  /**
   * Saves and returns updated preferences
   */
  public saveUserPreferences(userId: string, updates: Partial<UserNotificationPreferences>): UserNotificationPreferences {
    const current = this.getUserPreferences(userId);
    const updated: UserNotificationPreferences = {
      ...current,
      ...updates,
      categoryFilters: {
        ...current.categoryFilters,
        ...(updates.categoryFilters || {})
      }
    };
    this.userPreferences.set(userId, updated);
    return updated;
  }

  /**
   * Check if current time is within quiet hours
   */
  public isWithinQuietHours(prefs: UserNotificationPreferences): boolean {
    if (!prefs.quietHoursEnabled) return false;
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
      const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Over midnight (e.g. 23:00 to 07:00)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch {
      return false;
    }
  }

  /**
   * Dispatches a unified alert through the engine
   */
  public dispatchAlert(raw: Partial<UnifiedAlert> & { userId: string; category: UnifiedAlertCategory; symbol: string; title: string; message: string }): UnifiedAlert | null {
    const prefs = this.getUserPreferences(raw.userId);
    const severity: AlertSeverity = raw.severity || 'MEDIUM';

    // 1. Check minimum severity filter
    const severityRanks: Record<AlertSeverity, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4
    };

    if (severityRanks[severity] < severityRanks[prefs.minSeverity]) {
      return null;
    }

    // 2. Check category filter toggle
    const group = this.getCategoryGroup(raw.category);
    if (!prefs.categoryFilters[group]) {
      return null;
    }

    // 3. Check quiet hours (unless critical)
    if (severity !== 'CRITICAL' && this.isWithinQuietHours(prefs)) {
      return null;
    }

    // 4. Rate limiting per hour
    const now = Date.now();
    const currentHour = Math.floor(now / 3600000);
    const hourData = this.hourlyAlertCounters.get(raw.userId) || { count: 0, hourWindow: currentHour };
    if (hourData.hourWindow !== currentHour) {
      hourData.count = 0;
      hourData.hourWindow = currentHour;
    }
    if (hourData.count >= prefs.maxAlertsPerHour && severity !== 'CRITICAL') {
      return null;
    }
    hourData.count++;
    this.hourlyAlertCounters.set(raw.userId, hourData);

    // 5. Cooldown check per symbol + category
    const cooldownKey = `${raw.userId}_${raw.symbol}_${raw.category}`;
    const lastTrigger = this.lastAlertTimestamps.get(cooldownKey);
    const cooldownMs = (prefs.cooldownMinutes || 15) * 60 * 1000;
    if (lastTrigger && now - lastTrigger < cooldownMs && severity !== 'CRITICAL') {
      return null;
    }
    this.lastAlertTimestamps.set(cooldownKey, now);

    // 6. Build pristine Unified Alert record
    const id = raw.id || `alt_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const fullAlert: UnifiedAlert = {
      id,
      userId: raw.userId,
      category: raw.category,
      type: raw.type || raw.category.toUpperCase().replace(/\s+/g, '_'),
      severity,
      exchange: raw.exchange || 'BINANCE',
      marketId: raw.marketId || `${raw.symbol.replace(/[\/\-_]/g, '')}`,
      symbol: raw.symbol,
      timeframe: raw.timeframe || '1H',
      title: raw.title,
      message: raw.message,
      timestamp: raw.timestamp || now,
      source: raw.source || 'Unified Notification Engine',
      status: raw.status || 'TRIGGERED',
      read: raw.read ?? false,
      modelVersion: raw.modelVersion || 'v2.4-quantum',
      triggerValue: raw.triggerValue,
      threshold: raw.threshold,
      evidence: raw.evidence,
      signalId: raw.signalId,
      whaleEventId: raw.whaleEventId,
      liquidationEventId: raw.liquidationEventId,
      orderFlowEventId: raw.orderFlowEventId,

      // Backward compatibility fields
      alertId: raw.alertId || id,
      triggeredAt: raw.timestamp || now,
      condition: raw.category,
      conditionDescription: raw.message,
      actualValue: raw.triggerValue,
      triggerPrice: typeof raw.triggerValue === 'number' ? raw.triggerValue : undefined
    };

    // Store in DB
    db.addAlertEvent(fullAlert);

    // Send Telegram notification if enabled
    if (prefs.telegramEnabled && prefs.telegramChatId) {
      telegramService.sendAlertNotification(raw.userId, fullAlert).catch(err => {
        console.warn('[NotificationEngine] Telegram delivery error:', err.message);
      });
    }

    return fullAlert;
  }

  /**
   * Returns filtered alert events for user
   */
  public getAlertEvents(userId: string, filters?: AlertFilterParams): UnifiedAlert[] {
    const all = db.getAlertEvents(userId);

    return all.filter(item => {
      // Group filter
      if (filters?.categoryGroup && filters.categoryGroup !== 'all') {
        const itemGroup = this.getCategoryGroup(item.category);
        if (itemGroup !== filters.categoryGroup) return false;
      }

      // Specific Category filter
      if (filters?.category && item.category !== filters.category) {
        return false;
      }

      // Exchange filter
      if (filters?.exchange && filters.exchange !== 'ALL') {
        const itemEx = (item.exchange || '').toString().toUpperCase();
        if (itemEx !== filters.exchange.toUpperCase()) return false;
      }

      // Symbol filter
      if (filters?.symbol && filters.symbol.trim()) {
        const query = filters.symbol.trim().toUpperCase().replace('/', '');
        const itemClean = item.symbol.toUpperCase().replace('/', '');
        if (!itemClean.includes(query)) return false;
      }

      // Severity filter
      if (filters?.severity && item.severity !== filters.severity) {
        return false;
      }

      // Status filter
      if (filters?.status && item.status !== filters.status) {
        return false;
      }

      // Unread only filter
      if (filters?.unreadOnly && item.read) {
        return false;
      }

      return true;
    }).slice(0, filters?.limit || 100);
  }

  /**
   * Mark single alert as read
   */
  public markAlertRead(userId: string, alertId: string, read: boolean = true): boolean {
    const list = db.getAlertEvents(userId);
    const item = list.find(a => a.id === alertId);
    if (item) {
      item.read = read;
      return true;
    }
    return false;
  }

  /**
   * Mark all alerts as read for user
   */
  public markAllAlertsRead(userId: string): number {
    const list = db.getAlertEvents(userId);
    let count = 0;
    for (const item of list) {
      if (!item.read) {
        item.read = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Acknowledge all alerts
   */
  public acknowledgeAllAlerts(userId: string): number {
    const list = db.getAlertEvents(userId);
    let count = 0;
    for (const item of list) {
      if (item.status === 'TRIGGERED') {
        item.status = 'ACKNOWLEDGED';
        item.read = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Update status of single alert
   */
  public updateAlertStatus(userId: string, alertId: string, status: AlertEventStatus): boolean {
    const list = db.getAlertEvents(userId);
    const item = list.find(a => a.id === alertId);
    if (item) {
      item.status = status;
      if (status === 'ACKNOWLEDGED' || status === 'DISMISSED') {
        item.read = true;
      }
      return true;
    }
    return false;
  }

  /**
   * Delete single alert event
   */
  public deleteAlert(userId: string, alertId: string): boolean {
    const list = db.getAlertEvents(userId);
    const idx = list.findIndex(a => a.id === alertId);
    if (idx !== -1) {
      list.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear alerts based on mode
   */
  public clearAlerts(userId: string, mode: 'all' | 'dismissed' | 'read' = 'dismissed'): number {
    const list = db.getAlertEvents(userId);
    const originalLen = list.length;
    let filtered: UnifiedAlert[] = [];

    if (mode === 'all') {
      filtered = [];
    } else if (mode === 'dismissed') {
      filtered = list.filter(a => a.status !== 'DISMISSED');
    } else if (mode === 'read') {
      filtered = list.filter(a => !a.read);
    }

    db.alertEvents.set(userId, filtered);
    return originalLen - filtered.length;
  }

  /**
   * Dispatches an interactive simulation test alert to verify notification channels
   */
  public triggerTestAlert(userId: string, testCategory?: UnifiedAlertCategory): UnifiedAlert {
    const category = testCategory || 'Bull Signal';
    const now = Date.now();

    const sampleAlerts: Record<string, Partial<UnifiedAlert>> = {
      'Bull Signal': {
        category: 'Bull Signal',
        type: 'BULLISH_CONTINUATION_CONFIRMED',
        severity: 'HIGH',
        exchange: 'BINANCE',
        marketId: 'BTCUSDT',
        symbol: 'BTC/USDT',
        timeframe: '1H',
        title: 'Bullish Continuation Confirmed',
        message: 'High-confidence continuation pattern validated by volume surge and moving average confluence.',
        source: 'Signal Engine',
        triggerValue: 68420.5,
        threshold: 67800,
        evidence: [
          { label: 'Bull Score', value: 84 },
          { label: 'Signal Strength', value: 86 },
          { label: 'Volume Ratio', value: '2.4x' }
        ],
        modelVersion: 'v2.4-quantum'
      },
      'Whale Activity': {
        category: 'Large Exchange Withdrawal',
        type: 'EXCHANGE_OUTFLOW_LARGE',
        severity: 'CRITICAL',
        exchange: 'BINANCE',
        marketId: 'SOLUSDT',
        symbol: 'SOL/USDT',
        timeframe: '15M',
        title: 'Large Exchange Withdrawal',
        message: 'Massive accumulation detected: 28,400 SOL ($4.2M) withdrawn to private institutional cold storage.',
        source: 'Whale Intelligence Radar',
        triggerValue: '$4.2M',
        evidence: [
          { label: 'Amount', value: '$4.2M Outflow' },
          { label: 'Destination', value: 'Cold Wallet' },
          { label: 'Tx Type', value: 'Accumulation' }
        ],
        modelVersion: 'v1.8-radar'
      },
      'Downside Risk threshold': {
        category: 'Downside Risk threshold',
        type: 'DOWNSIDE_RISK_ELEVATED',
        severity: 'HIGH',
        exchange: 'OKX',
        marketId: 'ETHUSDT',
        symbol: 'ETH/USDT',
        timeframe: '4H',
        title: 'Downside Risk Elevated',
        message: 'Bearish divergence on 4H RSI with high sell-side liquidity concentration near support breakdown.',
        source: 'Risk Engine',
        triggerValue: 76,
        threshold: 70,
        evidence: [
          { label: 'Risk Score', value: 76 },
          { label: 'RSI14', value: 68.4 },
          { label: 'Invalidation', value: '$3,420' }
        ],
        modelVersion: 'v2.4-quantum'
      }
    };

    const template = sampleAlerts[category] || sampleAlerts['Bull Signal'];

    const alert: UnifiedAlert = {
      id: `alt_test_${now}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      category: template.category as UnifiedAlertCategory,
      type: template.type!,
      severity: template.severity!,
      exchange: template.exchange!,
      marketId: template.marketId!,
      symbol: template.symbol!,
      timeframe: template.timeframe || '1H',
      title: template.title!,
      message: template.message!,
      timestamp: now,
      source: template.source!,
      status: 'TRIGGERED',
      read: false,
      modelVersion: template.modelVersion || 'v2.4-quantum',
      triggerValue: template.triggerValue,
      threshold: template.threshold,
      evidence: template.evidence,
      alertId: `alt_test_${now}`,
      triggeredAt: now,
      condition: template.category,
      conditionDescription: template.message
    };

    db.addAlertEvent(alert);

    // Also send to Telegram if configured
    const prefs = this.getUserPreferences(userId);
    if (prefs.telegramEnabled && prefs.telegramChatId) {
      telegramService.sendAlertNotification(userId, alert).catch(() => {});
    }

    return alert;
  }

  /**
   * Seed high-fidelity operational alerts across all categories
   */
  private seedInitialOperationalAlerts(userId: string) {
    const now = Date.now();

    const seeds: Array<Omit<UnifiedAlert, 'id' | 'userId'> & { idOffset: number }> = [
      {
        idOffset: 1,
        category: 'Bull Signal',
        type: 'BULLISH_CONTINUATION_CONFIRMED',
        severity: 'HIGH',
        exchange: 'BINANCE',
        marketId: 'BTCUSDT',
        symbol: 'BTC/USDT',
        timeframe: '1H',
        title: 'Bullish Continuation Confirmed',
        message: 'High-probability continuation pattern validated with MTF confluence and expanding volume delta.',
        timestamp: now - 2 * 60 * 1000, // 2 min ago
        source: 'Signal Engine',
        status: 'TRIGGERED',
        read: false,
        modelVersion: 'v2.4-quantum',
        triggerValue: 78,
        threshold: 70,
        evidence: [
          { label: 'Bull Score', value: 78 },
          { label: 'Signal Strength', value: 81 },
          { label: 'Confluence', value: '4/4 MTF' }
        ]
      },
      {
        idOffset: 2,
        category: 'Downside Risk threshold',
        type: 'DOWNSIDE_RISK_ELEVATED',
        severity: 'HIGH',
        exchange: 'OKX',
        marketId: 'ETHUSDT',
        symbol: 'ETH/USDT',
        timeframe: '4H',
        title: 'Downside Risk Elevated',
        message: 'Structural weakness detected. Selling pressure exceeds buy liquidity absorption band.',
        timestamp: now - 8 * 60 * 1000, // 8 min ago
        source: 'Risk Engine',
        status: 'TRIGGERED',
        read: false,
        modelVersion: 'v2.4-quantum',
        triggerValue: 74,
        threshold: 65,
        evidence: [
          { label: 'Risk Score', value: 74 },
          { label: 'Funding Rate', value: '+0.018%' },
          { label: 'Resistance', value: '$3,480' }
        ]
      },
      {
        idOffset: 3,
        category: 'Large Exchange Withdrawal',
        type: 'EXCHANGE_OUTFLOW_LARGE',
        severity: 'CRITICAL',
        exchange: 'BINANCE',
        marketId: 'SOLUSDT',
        symbol: 'SOL/USDT',
        timeframe: '15M',
        title: 'Large Exchange Withdrawal',
        message: 'Substantial exchange outflow: $4.2M SOL withdrawn to institutional custody address.',
        timestamp: now - 15 * 60 * 1000, // 15 min ago
        source: 'Whale Intelligence',
        status: 'TRIGGERED',
        read: false,
        modelVersion: 'v1.8-radar',
        triggerValue: '$4.2M',
        evidence: [
          { label: 'Amount', value: '$4.2M' },
          { label: 'Tx Type', value: 'Withdrawal' },
          { label: 'Network', value: 'Solana Mainnet' }
        ]
      },
      {
        idOffset: 4,
        category: 'Liquidation',
        type: 'LIQUIDATION_CASCADE',
        severity: 'CRITICAL',
        exchange: 'BYBIT',
        marketId: 'AVAXUSDT',
        symbol: 'AVAX/USDT',
        timeframe: '5M',
        title: 'Long Liquidation Cascade',
        message: 'Rapid cascade triggered: $1.85M in leveraged long positions liquidated across 3 consecutive 1m bars.',
        timestamp: now - 28 * 60 * 1000, // 28 min ago
        source: 'Liquidation Engine',
        status: 'ACKNOWLEDGED',
        read: true,
        modelVersion: 'v2.1-stream',
        triggerValue: '$1.85M',
        evidence: [
          { label: 'Volume Liquidated', value: '$1.85M' },
          { label: 'Side', value: 'Long Cascade' },
          { label: 'OI Shift', value: '-8.4%' }
        ]
      },
      {
        idOffset: 5,
        category: 'CVD Divergence',
        type: 'ORDER_FLOW_BULLISH_DIVERGENCE',
        severity: 'MEDIUM',
        exchange: 'KRAKEN',
        marketId: 'XRPUSDT',
        symbol: 'XRP/USDT',
        timeframe: '15M',
        title: 'CVD Bullish Divergence',
        message: 'Aggressive spot taker buying detected while price is compressed in key demand block.',
        timestamp: now - 42 * 60 * 1000, // 42 min ago
        source: 'Order Flow Radar',
        status: 'ACKNOWLEDGED',
        read: true,
        modelVersion: 'v2.4-quantum',
        triggerValue: '+8.4M',
        evidence: [
          { label: 'Spot Delta', value: '+$8.4M' },
          { label: 'Absorption', value: 'Active' },
          { label: 'Imbalance', value: '68% Buy' }
        ]
      },
      {
        idOffset: 6,
        category: 'Breakout',
        type: 'STRUCTURAL_BREAKOUT_CONFIRMED',
        severity: 'HIGH',
        exchange: 'BINANCE',
        marketId: 'BNBUSDT',
        symbol: 'BNB/USDT',
        timeframe: '1H',
        title: 'Bullish Resistance Breakout',
        message: 'Price cleanly broke above 30-day macro swing high with 220% volume expansion.',
        timestamp: now - 58 * 60 * 1000, // 58 min ago
        source: 'Market Structure Engine',
        status: 'ACKNOWLEDGED',
        read: true,
        modelVersion: 'v2.4-quantum',
        triggerValue: 614.8,
        threshold: 612.0,
        evidence: [
          { label: 'Breakout Level', value: '$612.00' },
          { label: 'Volume Ratio', value: '2.2x' },
          { label: 'Status', value: 'Confirmed' }
        ]
      },
      {
        idOffset: 7,
        category: 'BTC Market Condition',
        type: 'MACRO_VOLATILITY_COMPRESSION',
        severity: 'LOW',
        exchange: 'ALL',
        marketId: 'BTCUSDT',
        symbol: 'BTC/USDT',
        timeframe: '4H',
        title: 'BTC Volatility Compression Squeeze',
        message: 'Bollinger Band bandwidth collapsed to 30-day low (1.4%). Explosive volatility expansion anticipated.',
        timestamp: now - 95 * 60 * 1000, // 95 min ago
        source: 'System Radar',
        status: 'ACKNOWLEDGED',
        read: true,
        modelVersion: 'v2.4-quantum',
        evidence: [
          { label: 'Bandwidth', value: '1.42%' },
          { label: 'Squeeze State', value: 'Compressed' }
        ]
      },
      {
        idOffset: 8,
        category: 'Data/Exchange health',
        type: 'DATA_FEED_RECONNECTED',
        severity: 'LOW',
        exchange: 'GATE',
        marketId: 'SYSTEM',
        symbol: 'GATE-FEED',
        timeframe: 'REALTIME',
        title: 'Gate.io Feed Reconnected & Synchronized',
        message: 'WebSocket ticker stream restored. Normal latency verified at 38ms.',
        timestamp: now - 140 * 60 * 1000, // 2.3 hrs ago
        source: 'Health Telemetry',
        status: 'ACKNOWLEDGED',
        read: true,
        evidence: [
          { label: 'Latency', value: '38ms' },
          { label: 'Data Freshness', value: 'Healthy' }
        ]
      }
    ];

    for (const s of seeds) {
      const { idOffset, ...rest } = s;
      const full: UnifiedAlert = {
        ...rest,
        id: `alt_seed_${now - rest.timestamp}_${idOffset}`,
        userId,
        alertId: `alt_seed_${idOffset}`,
        triggeredAt: rest.timestamp,
        condition: rest.category,
        conditionDescription: rest.message
      };
      db.addAlertEvent(full);
    }
  }

  /**
   * Evaluates live scanner coin data and generates unified alerts automatically
   */
  public evaluateMarketTriggers(coins: NormalizedCoinData[]): UnifiedAlert[] {
    const generated: UnifiedAlert[] = [];
    const now = Date.now();

    for (const coin of coins) {
      // 1. High Bull Score alert (> 82)
      if (coin.scores.bullScore >= 82) {
        const key = `eval_bull_${coin.symbol}`;
        const last = this.lastAlertTimestamps.get(key);
        if (!last || now - last > 60 * 60 * 1000) {
          this.lastAlertTimestamps.set(key, now);
          const alert = this.dispatchAlert({
            userId: 'usr_demo_1',
            category: 'Bull Score threshold',
            type: 'BULL_SCORE_SURGE',
            severity: 'HIGH',
            exchange: coin.exchange || 'BINANCE',
            marketId: coin.symbol.replace('/', ''),
            symbol: coin.symbol,
            timeframe: '1H',
            title: `${coin.symbol} Bull Score Surge (${coin.scores.bullScore}/100)`,
            message: `Strong quantitative buy signals converged with positive RSI momentum and volume expansion.`,
            source: 'Quantitative Radar',
            triggerValue: coin.scores.bullScore,
            threshold: 80,
            evidence: [
              { label: 'Bull Score', value: coin.scores.bullScore },
              { label: 'Price', value: `$${coin.price.toLocaleString()}` },
              { label: '24h Change', value: `${coin.change24h > 0 ? '+' : ''}${coin.change24h.toFixed(2)}%` }
            ]
          });
          if (alert) generated.push(alert);
        }
      }

      // 2. High Downside Risk alert (> 75)
      if (coin.scores.downsideRiskScore >= 75) {
        const key = `eval_risk_${coin.symbol}`;
        const last = this.lastAlertTimestamps.get(key);
        if (!last || now - last > 60 * 60 * 1000) {
          this.lastAlertTimestamps.set(key, now);
          const alert = this.dispatchAlert({
            userId: 'usr_demo_1',
            category: 'Downside Risk threshold',
            type: 'DOWNSIDE_RISK_WARNING',
            severity: 'HIGH',
            exchange: coin.exchange || 'BINANCE',
            marketId: coin.symbol.replace('/', ''),
            symbol: coin.symbol,
            timeframe: '4H',
            title: `${coin.symbol} Downside Risk Elevated (${coin.scores.downsideRiskScore}/100)`,
            message: `Distribution signs observed with elevated leverage and potential long liquidations.`,
            source: 'Risk Engine',
            triggerValue: coin.scores.downsideRiskScore,
            threshold: 75,
            evidence: [
              { label: 'Risk Score', value: coin.scores.downsideRiskScore },
              { label: 'Funding Trend', value: coin.derivatives?.fundingTrend || 'Elevated' }
            ]
          });
          if (alert) generated.push(alert);
        }
      }
    }

    return generated;
  }
}

export const notificationEngine = new NotificationEngine();
