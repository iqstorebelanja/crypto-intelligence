import {
  AdminAuditLogEntry,
  AIErrorLogEntry,
  Alert,
  AlertEvent,
  CacheMetrics,
  Exchange,
  ExchangeId,
  FreshnessThresholds,
  GlobalAlertAdminConfig,
  IndicatorSnapshot,
  ManagedSymbol,
  ManagedUser,
  NormalizedCoinData,
  OHLCVRecord,
  PerformanceMetrics,
  ScannerAdminConfig,
  ScoreSnapshot,
  Session,
  SystemHealth,
  SystemLogEntry,
  SystemLogLevel,
  SystemLogSource,
  Timeframe,
  TradingPair,
  User,
  WatchlistRecord,
  MarketSignal,
  SignalEngineAdminConfig,
  SignalEngineConfigHistoryItem,
  SignalQualityStats,
  UserDisplayPreferences,
  UserSessionView,
  TrialAdminConfig,
  SubscriptionAdminConfig,
  SubscriptionHistoryEvent,
  SubscriptionPlanConfig,
  DeliveryAttempt,
  Notification,
  WebPushSubscriptionRecord,
  ExternalIntelligenceAdminConfig,
  SubscriptionRecord,
  PaymentEvent
} from '../../src/types';

export class DatabaseStore {
  public users: Map<string, User> = new Map();
  public userPasswords: Map<string, string> = new Map(); // email -> plain/hashed
  public userStatuses: Map<string, 'ACTIVE' | 'DISABLED'> = new Map();
  public userLastLogins: Map<string, number> = new Map();
  public sessions: Map<string, Session> = new Map(); // token -> Session
  public exchanges: Map<string, Exchange> = new Map();
  public tradingPairs: Map<string, TradingPair> = new Map();
  public watchlists: Map<string, Set<string>> = new Map(); // userId -> Set<symbol>
  public alerts: Map<string, Alert[]> = new Map(); // userId -> Alert[]
  public alertEvents: Map<string, AlertEvent[]> = new Map(); // userId -> AlertEvent[]
  public indicatorSnapshots: Map<string, IndicatorSnapshot> = new Map();
  public scoreSnapshots: Map<string, ScoreSnapshot[]> = new Map(); // key `${exchange}:${symbol}` -> snapshots
  public systemHealth: Map<string, SystemHealth> = new Map();

  // ==========================================
  // PHASE 17: NOTIFICATION & ALERT DELIVERY STORAGE
  // ==========================================
  public notifications: Map<string, Notification[]> = new Map(); // userId -> Notification[]
  public deliveryAttempts: DeliveryAttempt[] = [];
  public webPushSubscriptions: Map<string, WebPushSubscriptionRecord[]> = new Map(); // userId -> WebPushSubscriptionRecord[]
  public notificationRetentionDays: number = 30;

  // ==========================================
  // PHASE 26: SUBSCRIPTION & PAYMENT GATEWAY STORAGE
  // ==========================================
  public subscriptions: Map<string, SubscriptionRecord> = new Map(); // subscriptionId -> SubscriptionRecord
  public idx_subscriptions_by_user: Map<string, string> = new Map(); // userId -> subscriptionId
  public paymentEvents: Map<string, PaymentEvent> = new Map(); // `${provider}:${eventId}` -> PaymentEvent

  // ==========================================
  // PHASE 4A: DATABASE SECONDARY INDEXES
  // Frequently queried fields: symbol, exchange, timeframe, timestamp, userId, alertId, createdAt
  // ==========================================
  public idx_alerts_by_userId: Map<string, Set<string>> = new Map();
  public idx_alerts_by_symbol: Map<string, Set<string>> = new Map();
  public idx_alerts_by_exchange: Map<string, Set<string>> = new Map();
  public idx_alerts_by_id: Map<string, Alert> = new Map();
  public idx_indicators_by_key: Map<string, IndicatorSnapshot> = new Map(); // `${exchange}:${symbol}:${timeframe}`
  public idx_users_by_email: Map<string, string> = new Map();
  public idx_users_by_username: Map<string, string> = new Map();
  public userTwoFactorSecrets: Map<string, string> = new Map();
  public userBackupCodes: Map<string, string[]> = new Map();
  public passwordResetTokens: Map<string, { email: string; token: string; expiresAt: number }> = new Map();
  public failedLoginAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();

  // ==========================================
  // PHASE 4A: TELEMETRY, LOGS & ADMIN CONFIGURATION
  // ==========================================
  public systemLogs: SystemLogEntry[] = [];
  public aiErrorLogs: AIErrorLogEntry[] = [];
  public adminAuditLogs: AdminAuditLogEntry[] = [];

  public freshnessThresholds: FreshnessThresholds = {
    liveMaxSec: 15,
    delayedMaxSec: 60,
    staleMinSec: 60
  };

  public scannerConfig: ScannerAdminConfig = {
    minVolume: 100000,
    volumeSpikeThreshold: 2.0,
    maxPairs: 50,
    pollingIntervalSec: 10,
    cacheDurationSec: 5,
    supportedTimeframes: ['5m', '15m', '1h', '4h', '1D']
  };

  public globalAlertConfig: GlobalAlertAdminConfig = {
    maxAlertsPerUser: 25,
    minAlertCooldownMinutes: 5,
    maxNotificationsPerHour: 50,
    maxTelegramMessagesPerHour: 30,
    systemWideAlertsEnabled: true
  };

  // ==========================================
  // PHASE 15: 7-DAY PRO TRIAL & FEATURE GATING CONFIG
  // ==========================================
  public trialSettings: TrialAdminConfig = {
    enabled: true,
    trialDurationDays: 7,
    freeAllowedSymbols: ['BTC', 'ETH'],
    freeMaxWatchlist: 5,
    freeMaxAlerts: 3,
    freeScannerMaxPairs: 50,
    updatedAt: Date.now(),
    updatedBy: 'system'
  };

  // ==========================================
  // PHASE 16: CONFIGURABLE SUBSCRIPTION & PRICING ARCHITECTURE
  // ==========================================
  public subscriptionConfig: SubscriptionAdminConfig = {
    plans: [
      {
        planId: 'FREE',
        displayName: 'Free Analyst',
        billingPeriod: 'FREE',
        price: 0,
        currency: 'USD',
        locale: 'en-US',
        description: 'Foundational crypto intelligence for spot and derivatives markets.',
        features: [
          'Basic market overview and multi-exchange order books',
          'BTC & ETH institutional signal intelligence',
          'Spot & perpetual technical indicators (RSI, MA, Bollinger)',
          'AI Quant Trader with 15-second rewarded ad verification',
          'Standard scanner with up to 50 active pairs',
          'Up to 3 price and volatility alerts',
          'Watchlist with up to 5 tracked assets'
        ],
        isActive: true,
        sortOrder: 1,
        providerProductId: null,
        providerPackageId: null
      },
      {
        planId: 'PRO_MONTHLY',
        displayName: 'PRO Monthly',
        billingPeriod: 'MONTHLY',
        price: 29,
        currency: 'USD',
        locale: 'en-US',
        description: 'Complete institutional quantitative suite billed monthly.',
        features: [
          'Everything in Free Plan',
          'Full 100+ asset signal intelligence & structural breakout alerts',
          'Multi-timeframe confluence analysis (5m, 15m, 1h, 4h, 1D)',
          'Bull Potential & Downside Risk sub-second score breakdown',
          'Whale Radar & on-chain exchange transfer analytics',
          'CVD order flow aggression delta & liquidation heatmaps',
          'PRO Alpha Community forum access (daily 00:00 UTC resets)',
          'Instant AI Quant Trader with ZERO 15-second ad delays',
          'Up to 25 custom analytical alerts & unlimited watchlists'
        ],
        isActive: true,
        sortOrder: 2,
        savingsBadge: undefined,
        providerProductId: null,
        providerPackageId: null
      },
      {
        planId: 'PRO_YEARLY',
        displayName: 'PRO Annual',
        billingPeriod: 'YEARLY',
        price: 290,
        currency: 'USD',
        locale: 'en-US',
        description: 'Maximum alpha commitment with 2 months free equivalent.',
        features: [
          'Everything in PRO Monthly',
          '2 months free savings ($58 annual reduction)',
          'Priority market-data stream routing and lowest latency feeds',
          'Institutional API export and historical signal replay',
          'Early access to new exchange connector integrations'
        ],
        isActive: true,
        sortOrder: 3,
        savingsBadge: 'Save 17%',
        providerProductId: null,
        providerPackageId: null
      }
    ],
    defaultCurrency: 'USD',
    defaultLocale: 'en-US',
    paymentGatewayReady: false,
    statusNote: 'Payment gateway integration is being prepared. Real payments are not yet enabled in this preview phase.',
    updatedAt: Date.now(),
    updatedBy: 'system'
  };

  public subscriptionEvents: SubscriptionHistoryEvent[] = [];

  public managedSymbols: Map<string, ManagedSymbol> = new Map();
  public supportedTimeframes: Set<Timeframe> = new Set(['5m', '15m', '1h', '4h', '1D']);

  public cacheMetrics: CacheMetrics = {
    hits: 142,
    misses: 24,
    hitRatioPercent: 85.5,
    keysCount: 78,
    lastPurge: Date.now()
  };

  public performanceMetrics: PerformanceMetrics = {
    apiLatencyAvgMs: 44,
    dbLatencyAvgMs: 1.8,
    scannerCalcTimeMs: 16,
    indicatorCalcTimeMs: 9,
    scoreCalcTimeMs: 5,
    aiResponseTimeAvgMs: 420,
    alertProcessingTimeMs: 11
  };

  // ==========================================
  // PHASE 21: EXTERNAL INTELLIGENCE DATA LAYER CONFIG
  // ==========================================
  public externalIntelligenceConfig: ExternalIntelligenceAdminConfig = {
    externalEvidenceEnabled: true,
    mockMode: process.env.EXTERNAL_INTELLIGENCE_MOCK_MODE === 'true',
    whaleWeight: 15,
    dexWeight: 10,
    minConfidenceThreshold: 60,
    freshnessThresholds: {
      liveSec: 30,
      delayedSec: 120
    },
    providers: [
      {
        id: 'whale_alert_onchain',
        name: 'On-Chain Ledger & Whale Intelligence Feed',
        enabled: true,
        priority: 1,
        apiKeyConfigured: Boolean(process.env.WHALE_ALERT_API_KEY),
        status: 'LIVE'
      },
      {
        id: 'generic_dex_direct',
        name: 'Decentralized Exchange (DEX) & AMM Liquidity Indexer',
        enabled: true,
        priority: 2,
        apiKeyConfigured: true,
        status: 'LIVE'
      }
    ],
    updatedAt: Date.now(),
    updatedBy: 'system'
  };

  // ==========================================
  // PHASE 7: SIGNAL INTELLIGENCE ENGINE STORAGE & CONFIG
  // ==========================================
  public signalConfig: SignalEngineAdminConfig = {
    version: 1,
    updatedAt: Date.now(),
    updatedBy: 'system',
    timeframeWeights: {
      '5m': 10,
      '15m': 15,
      '1h': 25,
      '4h': 30,
      '1D': 20
    },
    timeframeRoles: {
      '5m': 'Short-term momentum',
      '15m': 'Short-term confirmation',
      '1h': 'Primary tactical trend',
      '4h': 'Primary structure / swing context',
      '1D': 'Macro trend context'
    },
    componentWeights: {
      trendAlignment: 15,
      momentum: 10,
      volumeConfirmation: 15,
      marketStructure: 20,
      derivatives: 15,
      volatility: 5,
      multiTimeframe: 15,
      btcContext: 5
    },
    thresholds: {
      bullishWeakMax: 30,
      neutralMax: 50,
      bullishPositiveMax: 70,
      bullishStrongMax: 85,
      volumeRatioElevated: 1.2,
      volumeRatioHigh: 1.8,
      volumeRatioExtreme: 2.5,
      rsiOverbought: 70,
      rsiOversold: 30,
      signalExpiryCandles: 20
    },
    invalidationRules: {
      reversalTolerancePct: 1.5,
      breakoutCloseBackPct: 0.5
    }
  };

  public signalConfigHistory: SignalEngineConfigHistoryItem[] = [];
  public historicalSignals: MarketSignal[] = [];
  public activeSignals: Map<string, MarketSignal> = new Map(); // key `${exchange}:${symbol}:${timeframe}`


  constructor() {
    this.initExchanges();
    this.initDefaultUsers();
    this.initManagedSymbols();
    this.initSystemLogs();
  }

  private initExchanges() {
    this.exchanges.set('BINANCE', {
      id: 'binance',
      name: 'Binance',
      isEnabled: true,
      isHealthy: true,
      latencyMs: 48,
      baseUrl: process.env.BINANCE_API_URL || 'https://api.binance.com'
    });

    this.exchanges.set('BYBIT', {
      id: 'bybit',
      name: 'Bybit',
      isEnabled: true,
      isHealthy: true,
      latencyMs: 52,
      baseUrl: process.env.BYBIT_API_URL || 'https://api.bybit.com'
    });

    this.exchanges.set('OKX', {
      id: 'okx',
      name: 'OKX (Phase 3)',
      isEnabled: false,
      isHealthy: false,
      latencyMs: 0,
      baseUrl: 'https://www.okx.com'
    });

    this.systemHealth.set('binance_api', {
      serviceName: 'Binance Market Data Feed',
      status: 'HEALTHY',
      latencyMs: 48,
      lastCheckedAt: Date.now(),
      message: 'Spot & Futures endpoints operational.'
    });

    this.systemHealth.set('bybit_api', {
      serviceName: 'Bybit Linear Feed',
      status: 'HEALTHY',
      latencyMs: 52,
      lastCheckedAt: Date.now(),
      message: 'USDT Perpetual Kline & OI streams operational.'
    });
  }

  private initDefaultUsers() {
    // 1. Regular User with Active 7-Day PRO Trial (5 days remaining)
    const demoUser: User = {
      id: 'usr_demo_terminal',
      email: 'demo@cryptointelligence.ai',
      name: 'Terminal Analyst',
      username: 'analyst_demo',
      role: 'user',
      isPro: true,
      tier: 'PRO',
      plan: 'FREE',
      trialStatus: 'ACTIVE',
      trialStartedAt: Date.now() - 86400000 * 2,
      trialEndsAt: Date.now() + 86400000 * 5, // Exactly 5 days remaining
      emailVerified: false,
      twoFactorEnabled: false,
      displayPreferences: {
        theme: 'dark',
        defaultExchange: 'BINANCE',
        defaultTimeframe: '1h',
        compactView: false,
        soundAlerts: true
      },
      createdAt: Date.now() - 86400000 * 2
    };
    this.users.set(demoUser.id, demoUser);
    this.userPasswords.set(demoUser.email.toLowerCase(), 'demo1234');
    this.userStatuses.set(demoUser.id, 'ACTIVE');
    this.userLastLogins.set(demoUser.id, Date.now() - 3600000);
    this.idx_users_by_email.set(demoUser.email.toLowerCase(), demoUser.id);
    this.idx_users_by_username.set('analyst_demo', demoUser.id);

    // Current primary workstation session
    const demoSession: Session = {
      id: 'sess_demo_workstation',
      userId: demoUser.id,
      token: 'token_demo_analytics_jwt',
      deviceName: 'MacBook Pro 16" M3 Max',
      browser: 'Chrome 128.0.0',
      os: 'macOS Sequoia 15.1',
      ipAddress: '192.168.1.104',
      lastActiveAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 30,
      createdAt: Date.now() - 86400000 * 2
    };
    this.sessions.set(demoSession.token, demoSession);

    // Secondary mobile session
    const demoMobileSession: Session = {
      id: 'sess_demo_mobile',
      userId: demoUser.id,
      token: 'token_demo_mobile_jwt',
      deviceName: 'iPhone 15 Pro Max',
      browser: 'Mobile Safari 17.5',
      os: 'iOS 18.0',
      ipAddress: '172.56.21.89',
      lastActiveAt: Date.now() - 3600000 * 3, // 3 hours ago
      expiresAt: Date.now() + 86400000 * 14,
      createdAt: Date.now() - 86400000 * 5
    };
    this.sessions.set(demoMobileSession.token, demoMobileSession);

    // 2. PRO User (Paid Institutional Subscriber)
    const proUser: User = {
      id: 'usr_pro_member',
      email: 'pro@cryptointelligence.ai',
      name: 'Pro Trader',
      username: 'pro_trader',
      role: 'user',
      isPro: true,
      tier: 'PRO',
      plan: 'PRO',
      trialStatus: 'NONE',
      proExpiresAt: Date.now() + 86400000 * 365,
      emailVerified: true,
      twoFactorEnabled: true,
      displayPreferences: {
        theme: 'terminal',
        defaultExchange: 'BYBIT',
        defaultTimeframe: '15m',
        compactView: true,
        soundAlerts: true
      },
      createdAt: Date.now() - 86400000 * 15
    };
    this.users.set(proUser.id, proUser);
    this.userPasswords.set(proUser.email.toLowerCase(), 'pro1234');
    this.userStatuses.set(proUser.id, 'ACTIVE');
    this.userLastLogins.set(proUser.id, Date.now() - 1800000);
    this.idx_users_by_email.set(proUser.email.toLowerCase(), proUser.id);
    this.idx_users_by_username.set('pro_trader', proUser.id);
    this.userTwoFactorSecrets.set(proUser.id, 'JBSWY3DPEHPK3PXP');
    this.userBackupCodes.set(proUser.id, ['A8F2-99C1', '77B3-44E2', '11C9-88D4', '55E1-22A7']);

    const proSession: Session = {
      id: 'sess_pro_default',
      userId: proUser.id,
      token: 'token_pro_trader_jwt',
      deviceName: 'Alienware Aurora R16',
      browser: 'Brave 1.69',
      os: 'Windows 11 Pro',
      ipAddress: '10.0.1.45',
      lastActiveAt: Date.now() - 1800000,
      expiresAt: Date.now() + 86400000 * 30,
      createdAt: Date.now() - 86400000 * 7
    };
    this.sessions.set(proSession.token, proSession);

    // 3. Admin User (System Administrator)
    const adminUser: User = {
      id: 'usr_admin_master',
      email: 'admin@cryptointelligence.ai',
      name: 'System Administrator',
      username: 'admin_master',
      role: 'admin',
      isPro: true,
      tier: 'ADMIN',
      plan: 'PRO',
      trialStatus: 'NONE',
      emailVerified: true,
      twoFactorEnabled: true,
      displayPreferences: {
        theme: 'dark',
        defaultExchange: 'BINANCE',
        defaultTimeframe: '1h',
        compactView: false,
        soundAlerts: true
      },
      createdAt: Date.now() - 86400000 * 60
    };
    this.users.set(adminUser.id, adminUser);
    this.userPasswords.set(adminUser.email.toLowerCase(), 'admin1234');
    this.userStatuses.set(adminUser.id, 'ACTIVE');
    this.userLastLogins.set(adminUser.id, Date.now() - 120000);
    this.idx_users_by_email.set(adminUser.email.toLowerCase(), adminUser.id);
    this.idx_users_by_username.set('admin_master', adminUser.id);
    this.userTwoFactorSecrets.set(adminUser.id, 'KREUG33DOMZGS43V');
    this.userBackupCodes.set(adminUser.id, ['ADM1-7890', 'SEC2-4561', 'OPS3-1234', 'ROOT-9988']);

    const adminSession: Session = {
      id: 'sess_admin_default',
      userId: adminUser.id,
      token: 'token_admin_super_jwt',
      deviceName: 'ThinkPad X1 Carbon',
      browser: 'Firefox 130.0',
      os: 'Ubuntu 24.04 LTS',
      ipAddress: '10.128.0.2',
      lastActiveAt: Date.now() - 120000,
      expiresAt: Date.now() + 86400000 * 30,
      createdAt: Date.now() - 86400000 * 10
    };
    this.sessions.set(adminSession.token, adminSession);

    // 4. Free User (Expired Trial Analyst)
    const expiredUser: User = {
      id: 'usr_free_expired',
      email: 'free@cryptointelligence.ai',
      name: 'Free Tier Analyst',
      username: 'analyst_free',
      role: 'user',
      isPro: false,
      tier: 'FREE',
      plan: 'FREE',
      trialStatus: 'EXPIRED',
      trialStartedAt: Date.now() - 86400000 * 14,
      trialEndsAt: Date.now() - 86400000 * 7, // Expired 7 days ago
      emailVerified: true,
      twoFactorEnabled: false,
      displayPreferences: {
        theme: 'dark',
        defaultExchange: 'BINANCE',
        defaultTimeframe: '1h',
        compactView: false,
        soundAlerts: true
      },
      createdAt: Date.now() - 86400000 * 14
    };
    this.users.set(expiredUser.id, expiredUser);
    this.userPasswords.set(expiredUser.email.toLowerCase(), 'free1234');
    this.userStatuses.set(expiredUser.id, 'ACTIVE');
    this.userLastLogins.set(expiredUser.id, Date.now() - 3600000);
    this.idx_users_by_email.set(expiredUser.email.toLowerCase(), expiredUser.id);
    this.idx_users_by_username.set('analyst_free', expiredUser.id);

    const expiredSession: Session = {
      id: 'sess_free_default',
      userId: expiredUser.id,
      token: 'token_free_expired_jwt',
      deviceName: 'Dell XPS 15',
      browser: 'Chrome 128.0.0',
      os: 'Windows 11',
      ipAddress: '192.168.1.120',
      lastActiveAt: Date.now() - 3600000,
      expiresAt: Date.now() + 86400000 * 7,
      createdAt: Date.now() - 86400000 * 14
    };
    this.sessions.set(expiredSession.token, expiredSession);
    this.watchlists.set(expiredUser.id, new Set(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']));

    // Seed default watchlist for demo user
    this.watchlists.set(demoUser.id, new Set(['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'SUI/USDT', 'LINK/USDT', 'PEPE/USDT']));

    // Seed sample Phase 2 alerts
    const initialAlerts: Alert[] = [
      {
        id: 'alt_1',
        userId: demoUser.id,
        symbol: 'BTC/USDT',
        exchange: 'BINANCE',
        timeframe: '1h',
        conditionType: 'BULL_SCORE_ABOVE',
        operator: '>',
        threshold: 80,
        targetValue: 80,
        currentValue: 74,
        isRecurring: true,
        cooldownMinutes: 15,
        lastTriggeredAt: null,
        isActive: true,
        enabled: true,
        notes: 'Alert when BTC Bull Score enters strong bullish regime (> 80)',
        note: 'Alert when BTC Bull Score enters strong bullish regime (> 80)',
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 3600000
      },
      {
        id: 'alt_2',
        userId: demoUser.id,
        symbol: 'SOL/USDT',
        exchange: 'BINANCE',
        timeframe: '1h',
        conditionType: 'DOWNSIDE_RISK_ABOVE',
        operator: '>',
        threshold: 65,
        targetValue: 65,
        currentValue: 38,
        isRecurring: false,
        cooldownMinutes: 15,
        lastTriggeredAt: null,
        isActive: true,
        enabled: true,
        notes: 'Alert on elevated downside risk (> 65)',
        note: 'Alert on elevated downside risk (> 65)',
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 7200000
      },
      {
        id: 'alt_3',
        userId: demoUser.id,
        symbol: 'ETH/USDT',
        exchange: 'BYBIT',
        timeframe: '1h',
        conditionType: 'BREAKOUT_DETECTED',
        operator: 'event',
        threshold: 'BREAKOUT',
        isRecurring: true,
        cooldownMinutes: 30,
        lastTriggeredAt: Date.now() - 14400000,
        isActive: true,
        enabled: true,
        notes: 'Alert on confirmed technical breakout with volume expansion',
        note: 'Alert on confirmed technical breakout with volume expansion',
        createdAt: Date.now() - 14400000,
        updatedAt: Date.now() - 14400000
      }
    ];

    this.alerts.set(demoUser.id, initialAlerts);
    for (const alt of initialAlerts) {
      this.indexAlert(alt);
    }

    // Seed alert events
    this.alertEvents.set(demoUser.id, [
      {
        id: 'evt_1',
        alertId: 'alt_3',
        userId: demoUser.id,
        category: 'Breakout',
        type: 'BREAKOUT_DETECTED',
        severity: 'HIGH',
        symbol: 'ETH/USDT',
        exchange: 'BYBIT',
        title: 'ETH/USDT Technical Breakout Confirmed',
        condition: 'BREAKOUT_DETECTED',
        conditionDescription: 'Technical breakout detected above swing resistance with volume confirmation.',
        actualValue: 3340.50,
        threshold: 3320.00,
        triggerPrice: 3340.50,
        message: 'Technical breakout detected above swing resistance with volume confirmation.',
        read: true,
        status: 'ACKNOWLEDGED',
        source: 'Market Structure Engine',
        timestamp: Date.now() - 14400000,
        triggeredAt: Date.now() - 14400000
      }
    ]);

    // Seed realistic subscription events (Phase 16)
    this.subscriptionEvents.push(
      {
        id: 'sub_evt_1',
        userId: demoUser.id,
        eventType: 'TRIAL_STARTED',
        plan: 'PRO',
        source: 'TRIAL',
        provider: 'SYSTEM',
        timestamp: demoUser.trialStartedAt || (Date.now() - 86400000 * 2),
        metadata: { trialDurationDays: 7, trialEndsAt: demoUser.trialEndsAt }
      },
      {
        id: 'sub_evt_2',
        userId: expiredUser.id,
        eventType: 'TRIAL_STARTED',
        plan: 'PRO',
        source: 'TRIAL',
        provider: 'SYSTEM',
        timestamp: expiredUser.trialStartedAt || (Date.now() - 86400000 * 14),
        metadata: { trialDurationDays: 7 }
      },
      {
        id: 'sub_evt_3',
        userId: expiredUser.id,
        eventType: 'TRIAL_EXPIRED',
        plan: 'FREE',
        source: 'TRIAL',
        provider: 'SYSTEM',
        timestamp: expiredUser.trialEndsAt || (Date.now() - 86400000 * 7),
        metadata: { reason: '7-day reverse trial window elapsed' }
      },
      {
        id: 'sub_evt_4',
        userId: proUser.id,
        eventType: 'PRO_GRANTED',
        plan: 'PRO',
        source: 'ADMIN',
        provider: 'ADMIN',
        timestamp: Date.now() - 86400000 * 15,
        metadata: { durationDays: 365, actor: 'admin_master' }
      }
    );
  }

  private initManagedSymbols() {
    const prominentSymbols = [
      { sym: 'BTC/USDT', base: 'BTC', ex: 'BINANCE' as ExchangeId, type: 'SPOT' as const },
      { sym: 'ETH/USDT', base: 'ETH', ex: 'BINANCE' as ExchangeId, type: 'SPOT' as const },
      { sym: 'SOL/USDT', base: 'SOL', ex: 'BINANCE' as ExchangeId, type: 'SPOT' as const },
      { sym: 'SUI/USDT', base: 'SUI', ex: 'BINANCE' as ExchangeId, type: 'SPOT' as const },
      { sym: 'DOGE/USDT', base: 'DOGE', ex: 'BINANCE' as ExchangeId, type: 'SPOT' as const },
      { sym: 'BTC/USDT', base: 'BTC', ex: 'BYBIT' as ExchangeId, type: 'PERPETUAL' as const },
      { sym: 'ETH/USDT', base: 'ETH', ex: 'BYBIT' as ExchangeId, type: 'PERPETUAL' as const },
      { sym: 'SOL/USDT', base: 'SOL', ex: 'BYBIT' as ExchangeId, type: 'PERPETUAL' as const }
    ];

    for (const p of prominentSymbols) {
      const key = `${p.ex}:${p.sym}`;
      this.managedSymbols.set(key, {
        symbol: p.sym.replace('/', ''),
        formattedSymbol: p.sym,
        baseAsset: p.base,
        quoteAsset: 'USDT',
        exchange: p.ex,
        marketType: p.type,
        status: 'ACTIVE',
        lastDataUpdate: Date.now()
      });
    }
  }

  private initSystemLogs() {
    this.addSystemLog('INFO', 'SYSTEM', 'Production monitoring initialized with structured log buffers.');
    this.addSystemLog('INFO', 'DATABASE', 'Secondary indexes constructed for alerts, indicators, and users.');
    this.addSystemLog('INFO', 'BINANCE', 'Spot & Futures adapter attached with latency tracking.');
    this.addSystemLog('INFO', 'BYBIT', 'Linear perpetual adapter attached.');
  }

  // ==========================================
  // INDEX MANAGEMENT METHODS
  // ==========================================
  private indexAlert(alert: Alert) {
    this.idx_alerts_by_id.set(alert.id, alert);

    // User index
    let userSet = this.idx_alerts_by_userId.get(alert.userId);
    if (!userSet) {
      userSet = new Set();
      this.idx_alerts_by_userId.set(alert.userId, userSet);
    }
    userSet.add(alert.id);

    // Symbol index
    const cleanSym = alert.symbol.toUpperCase();
    let symSet = this.idx_alerts_by_symbol.get(cleanSym);
    if (!symSet) {
      symSet = new Set();
      this.idx_alerts_by_symbol.set(cleanSym, symSet);
    }
    symSet.add(alert.id);

    // Exchange index
    const exKey = alert.exchange || 'BINANCE';
    let exSet = this.idx_alerts_by_exchange.get(exKey);
    if (!exSet) {
      exSet = new Set();
      this.idx_alerts_by_exchange.set(exKey, exSet);
    }
    exSet.add(alert.id);
  }

  private deindexAlert(alert: Alert) {
    this.idx_alerts_by_id.delete(alert.id);
    this.idx_alerts_by_userId.get(alert.userId)?.delete(alert.id);
    this.idx_alerts_by_symbol.get(alert.symbol.toUpperCase())?.delete(alert.id);
    const exKey = alert.exchange || 'BINANCE';
    this.idx_alerts_by_exchange.get(exKey)?.delete(alert.id);
  }

  // Optimized query methods utilizing secondary indexes
  public queryAlertsByUserId(userId: string): Alert[] {
    const ids = this.idx_alerts_by_userId.get(userId);
    if (!ids) return [];
    const res: Alert[] = [];
    for (const id of ids) {
      const a = this.idx_alerts_by_id.get(id);
      if (a) res.push(a);
    }
    return res;
  }

  public queryAlertsBySymbol(symbol: string): Alert[] {
    const ids = this.idx_alerts_by_symbol.get(symbol.toUpperCase());
    if (!ids) return [];
    const res: Alert[] = [];
    for (const id of ids) {
      const a = this.idx_alerts_by_id.get(id);
      if (a) res.push(a);
    }
    return res;
  }

  /**
   * Indexed O(matching) query: retrieves active alerts for given list of symbols
   */
  public getActiveAlertsForSymbols(symbols: string[]): Alert[] {
    const seenIds = new Set<string>();
    const res: Alert[] = [];
    for (const sym of symbols) {
      const clean = sym.toUpperCase();
      const ids = this.idx_alerts_by_symbol.get(clean);
      if (ids) {
        for (const id of ids) {
          if (!seenIds.has(id)) {
            seenIds.add(id);
            const alert = this.idx_alerts_by_id.get(id);
            if (alert && alert.isActive) {
              res.push(alert);
            }
          }
        }
      }
    }
    return res;
  }

  public queryAlertById(alertId: string): Alert | undefined {
    return this.idx_alerts_by_id.get(alertId);
  }

  public saveIndicatorSnapshot(snapshot: IndicatorSnapshot): void {
    const key = `${snapshot.exchange}:${snapshot.symbol.toUpperCase()}:${snapshot.timeframe}`;
    this.idx_indicators_by_key.set(key, snapshot);
    this.indicatorSnapshots.set(snapshot.id, snapshot);
  }

  public queryIndicatorSnapshot(exchange: ExchangeId, symbol: string, timeframe: Timeframe): IndicatorSnapshot | undefined {
    const key = `${exchange}:${symbol.toUpperCase()}:${timeframe}`;
    return this.idx_indicators_by_key.get(key);
  }

  public saveScoreSnapshot(snapshot: ScoreSnapshot): void {
    const key = `${snapshot.exchange}:${snapshot.symbol.toUpperCase()}`;
    const list = this.scoreSnapshots.get(key) || [];
    list.unshift(snapshot);
    if (list.length > 50) list.length = 50; // preserve recent 50
    this.scoreSnapshots.set(key, list);
  }

  public queryScoreSnapshots(exchange: ExchangeId, symbol: string, limit = 20): ScoreSnapshot[] {
    const key = `${exchange}:${symbol.toUpperCase()}`;
    const list = this.scoreSnapshots.get(key) || [];
    return list.slice(0, limit);
  }

  // ==========================================
  // USER & AUTH METHODS
  // ==========================================
  public findUserByEmail(email: string): User | undefined {
    const id = this.idx_users_by_email.get(email.toLowerCase());
    if (id) {
      return this.users.get(id);
    }
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return undefined;
  }

  public getUserById(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  public createUser(email: string, passwordPlain: string, name: string, role: 'user' | 'admin' = 'user'): User {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const baseHandle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15) || 'analyst';
    let username = baseHandle;
    let counter = 1;
    while (this.idx_users_by_username.has(username)) {
      username = `${baseHandle}${counter++}`;
    }

    const now = Date.now();
    const isTrialEnabled = this.trialSettings?.enabled ?? true;
    const trialDurationMs = (this.trialSettings?.trialDurationDays ?? 7) * 86400000;
    const trialStartedAt = now;
    const trialEndsAt = isTrialEnabled ? trialStartedAt + trialDurationMs : null;
    const trialStatus: 'ACTIVE' | 'NONE' = isTrialEnabled ? 'ACTIVE' : 'NONE';
    const isPro = trialStatus === 'ACTIVE'; // Temporary PRO entitlement during active trial

    const user: User = {
      id,
      email: email.toLowerCase(),
      name,
      username,
      role,
      tier: isPro ? 'PRO' : 'FREE',
      plan: 'FREE',
      trialStatus,
      trialStartedAt,
      trialEndsAt,
      isPro,
      emailVerified: false,
      twoFactorEnabled: false,
      displayPreferences: {
        theme: 'dark',
        defaultExchange: 'BINANCE',
        defaultTimeframe: '1h',
        compactView: false,
        soundAlerts: true
      },
      createdAt: now
    };
    this.users.set(id, user);
    this.userPasswords.set(email.toLowerCase(), passwordPlain);
    this.userStatuses.set(id, 'ACTIVE');
    this.userLastLogins.set(id, Date.now());
    this.idx_users_by_email.set(email.toLowerCase(), id);
    this.idx_users_by_username.set(username, id);
    this.watchlists.set(id, new Set(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']));
    this.alerts.set(id, []);
    this.alertEvents.set(id, []);
    return user;
  }

  public checkAllTrialExpirations(): number {
    const now = Date.now();
    let expiredCount = 0;
    for (const user of this.users.values()) {
      if (user.role !== 'admin' && user.trialStatus === 'ACTIVE') {
        if (user.trialEndsAt && user.trialEndsAt <= now) {
          user.trialStatus = 'EXPIRED';
          user.isPro = false;
          user.tier = 'FREE';
          user.plan = 'FREE';
          this.users.set(user.id, user);
          expiredCount++;
        }
      }
    }
    return expiredCount;
  }

  public getTrialSettings(): TrialAdminConfig {
    return this.trialSettings;
  }

  public getExternalIntelligenceConfig(): ExternalIntelligenceAdminConfig {
    return this.externalIntelligenceConfig;
  }

  public updateExternalIntelligenceConfig(
    updates: Partial<ExternalIntelligenceAdminConfig>,
    updatedBy: string = 'admin'
  ): ExternalIntelligenceAdminConfig {
    this.externalIntelligenceConfig = {
      ...this.externalIntelligenceConfig,
      ...updates,
      updatedAt: Date.now(),
      updatedBy
    };
    return this.externalIntelligenceConfig;
  }

  public updateTrialSettings(updates: Partial<TrialAdminConfig>, adminUser: string): TrialAdminConfig {
    this.trialSettings = {
      ...this.trialSettings,
      ...updates,
      updatedAt: Date.now(),
      updatedBy: adminUser
    };
    return this.trialSettings;
  }

  public createSession(
    userId: string,
    deviceInfo?: { deviceName?: string; browser?: string; os?: string; ipAddress?: string }
  ): Session {
    const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const session: Session = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      token,
      deviceName: deviceInfo?.deviceName || 'Web Session',
      browser: deviceInfo?.browser || 'Chrome 128',
      os: deviceInfo?.os || 'macOS',
      ipAddress: deviceInfo?.ipAddress || '127.0.0.1',
      lastActiveAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 7, // 7 days
      createdAt: Date.now()
    };
    this.sessions.set(token, session);
    this.userLastLogins.set(userId, Date.now());
    return session;
  }

  public touchSession(token: string): void {
    const sess = this.sessions.get(token);
    if (sess) {
      sess.lastActiveAt = Date.now();
    }
  }

  public getUserSessions(userId: string, currentToken: string): UserSessionView[] {
    const now = Date.now();
    const result: UserSessionView[] = [];

    for (const s of this.sessions.values()) {
      if (s.userId !== userId) continue;
      if (now > s.expiresAt) {
        this.sessions.delete(s.token);
        continue;
      }

      result.push({
        id: s.id,
        deviceName: s.deviceName || 'Web Device',
        browser: s.browser || 'Browser',
        os: s.os || 'OS',
        ipAddress: s.ipAddress || '127.0.0.1',
        lastActiveAt: s.lastActiveAt || s.createdAt,
        createdAt: s.createdAt,
        isCurrent: s.token === currentToken
      });
    }

    return result.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return b.lastActiveAt - a.lastActiveAt;
    });
  }

  public revokeSession(userId: string, sessionId: string): boolean {
    for (const [token, s] of this.sessions.entries()) {
      if (s.userId === userId && s.id === sessionId) {
        this.sessions.delete(token);
        return true;
      }
    }
    return false;
  }

  public revokeOtherSessions(userId: string, currentToken: string): number {
    let count = 0;
    for (const [token, s] of this.sessions.entries()) {
      if (s.userId === userId && token !== currentToken) {
        this.sessions.delete(token);
        count++;
      }
    }
    return count;
  }

  public revokeAllSessions(userId: string): number {
    let count = 0;
    for (const [token, s] of this.sessions.entries()) {
      if (s.userId === userId) {
        this.sessions.delete(token);
        count++;
      }
    }
    return count;
  }

  public recordFailedLogin(email: string): { locked: boolean; remainingAttempts: number; lockedUntil?: number } {
    const key = email.toLowerCase().trim();
    const record = this.failedLoginAttempts.get(key) || { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= 5) {
      record.lockedUntil = Date.now() + 15 * 60 * 1000;
      this.failedLoginAttempts.set(key, record);
      return { locked: true, remainingAttempts: 0, lockedUntil: record.lockedUntil };
    }
    this.failedLoginAttempts.set(key, record);
    return { locked: false, remainingAttempts: Math.max(0, 5 - record.count) };
  }

  public clearFailedLogin(email: string): void {
    this.failedLoginAttempts.delete(email.toLowerCase().trim());
  }

  public isAccountLocked(email: string): { isLocked: boolean; remainingSec: number } {
    const key = email.toLowerCase().trim();
    const record = this.failedLoginAttempts.get(key);
    if (!record || record.lockedUntil <= Date.now()) {
      if (record && record.lockedUntil <= Date.now()) {
        this.failedLoginAttempts.delete(key);
      }
      return { isLocked: false, remainingSec: 0 };
    }
    const remainingSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return { isLocked: true, remainingSec };
  }

  public updateUserProfile(
    userId: string,
    updates: { name?: string; username?: string; avatarUrl?: string | null }
  ): User {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) throw new Error('Display name cannot be empty');
      if (trimmed.length > 50) throw new Error('Display name cannot exceed 50 characters');
      user.name = trimmed;
    }

    if (updates.username !== undefined) {
      const sanitized = updates.username.trim().toLowerCase().replace(/^@/, '');
      if (sanitized !== user.username) {
        if (!/^[a-z0-9_]{3,20}$/.test(sanitized)) {
          throw new Error('Username must be 3-20 characters and contain only letters, numbers, or underscores.');
        }

        const existingId = this.idx_users_by_username.get(sanitized);
        if (existingId && existingId !== userId) {
          throw new Error(`Username @${sanitized} is already taken by another analyst.`);
        }

        if (user.usernameChangedAt && Date.now() - user.usernameChangedAt < 7 * 86400000) {
          const daysLeft = Math.ceil((7 * 86400000 - (Date.now() - user.usernameChangedAt)) / 86400000);
          throw new Error(`Username can only be changed once every 7 days. Remaining cooldown: ${daysLeft} day(s).`);
        }

        if (user.username) {
          this.idx_users_by_username.delete(user.username);
        }

        user.username = sanitized;
        user.usernameChangedAt = Date.now();
        this.idx_users_by_username.set(sanitized, userId);
      }
    }

    if (updates.avatarUrl !== undefined) {
      if (updates.avatarUrl === null || updates.avatarUrl === '') {
        user.avatarUrl = null;
      } else {
        const av = updates.avatarUrl.trim();
        if (av.startsWith('data:image/')) {
          if (!/^data:image\/(jpeg|png|webp|svg\+xml|jpg);base64,/.test(av)) {
            throw new Error('Invalid image format. Allowed formats: PNG, JPEG, WebP, SVG.');
          }
          if (av.length > 3 * 1024 * 1024) {
            throw new Error('Avatar image size exceeds 2MB limit.');
          }
        } else if (!/^https:\/\/[a-zA-Z0-9_\-\.\/]+/.test(av)) {
          throw new Error('Avatar URL must be a valid secure HTTPS link or uploaded image.');
        }
        user.avatarUrl = av;
      }
    }

    return user;
  }

  public verifyEmail(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.emailVerified = true;
    return true;
  }

  public changePassword(userId: string, currentPass: string, newPass: string): boolean {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    const stored = this.userPasswords.get(user.email.toLowerCase());
    if (stored !== currentPass) {
      throw new Error('Current password does not match records.');
    }

    if (newPass.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    if (!/[A-Z]/.test(newPass) || !/[a-z]/.test(newPass) || !/[0-9]/.test(newPass)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number.');
    }

    this.userPasswords.set(user.email.toLowerCase(), newPass);
    return true;
  }

  public generateTwoFactorSetup(userId: string): { secret: string; qrCodeText: string; backupCodes: string[] } {
    const secret = 'JBSWY3DPEHPK3PXP';
    const backupCodes = [
      `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    ];
    this.userTwoFactorSecrets.set(userId, secret);
    this.userBackupCodes.set(userId, backupCodes);
    return {
      secret,
      qrCodeText: `otpauth://totp/CryptoIntelligenceAI:${userId}?secret=${secret}&issuer=CryptoIntelligenceAI`,
      backupCodes
    };
  }

  public enableTwoFactor(userId: string, code: string): { success: boolean; backupCodes: string[] } {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    if (!/^\d{6}$/.test(code.trim())) {
      throw new Error('Invalid verification code. Please enter a 6-digit TOTP code.');
    }
    user.twoFactorEnabled = true;
    const codes = this.userBackupCodes.get(userId) || [];
    return { success: true, backupCodes: codes };
  }

  public disableTwoFactor(userId: string, currentPass: string): boolean {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    const stored = this.userPasswords.get(user.email.toLowerCase());
    if (stored !== currentPass) {
      throw new Error('Current password is required to disable 2FA.');
    }
    user.twoFactorEnabled = false;
    this.userTwoFactorSecrets.delete(userId);
    this.userBackupCodes.delete(userId);
    return true;
  }

  public updateDisplayPreferences(userId: string, prefs: UserDisplayPreferences): UserDisplayPreferences {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    user.displayPreferences = {
      ...user.displayPreferences,
      ...prefs
    };
    return user.displayPreferences;
  }

  public exportUserData(userId: string): object {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    const watchlist = this.getWatchlist(userId);
    const alerts = this.getAlerts(userId);
    const sessions = this.getUserSessions(userId, '');
    return {
      exportTimestamp: new Date().toISOString(),
      profile: {
        id: user.id,
        name: user.name,
        username: user.username || null,
        email: user.email,
        role: user.role,
        tier: user.tier || (user.isPro ? 'PRO' : 'FREE'),
        emailVerified: user.emailVerified ?? false,
        twoFactorEnabled: user.twoFactorEnabled ?? false,
        createdAt: new Date(user.createdAt).toISOString()
      },
      displayPreferences: user.displayPreferences || {},
      watchlist,
      activeAlertsCount: alerts.length,
      alerts: alerts.map(a => ({
        symbol: a.symbol,
        exchange: a.exchange,
        timeframe: a.timeframe,
        conditionType: a.conditionType,
        threshold: a.threshold,
        isActive: a.isActive,
        createdAt: new Date(a.createdAt).toISOString()
      })),
      activeSessions: sessions.map(s => ({
        deviceName: s.deviceName,
        browser: s.browser,
        os: s.os,
        createdAt: new Date(s.createdAt).toISOString(),
        lastActiveAt: new Date(s.lastActiveAt).toISOString()
      }))
    };
  }

  public deleteAccount(userId: string, currentPass: string): boolean {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    const stored = this.userPasswords.get(user.email.toLowerCase());
    if (stored !== currentPass) {
      throw new Error('Incorrect password. Account deletion aborted.');
    }

    if (user.username) {
      this.idx_users_by_username.delete(user.username);
    }
    this.idx_users_by_email.delete(user.email.toLowerCase());
    this.userPasswords.delete(user.email.toLowerCase());
    this.userStatuses.delete(userId);
    this.userLastLogins.delete(userId);
    this.userTwoFactorSecrets.delete(userId);
    this.userBackupCodes.delete(userId);

    for (const [token, s] of this.sessions.entries()) {
      if (s.userId === userId) {
        this.sessions.delete(token);
      }
    }

    this.watchlists.delete(userId);
    this.alerts.delete(userId);
    this.alertEvents.delete(userId);
    this.users.delete(userId);

    return true;
  }

  public getSession(token: string): Session | undefined {
    const sess = this.sessions.get(token);
    if (!sess) return undefined;
    if (Date.now() > sess.expiresAt) {
      this.sessions.delete(token);
      return undefined;
    }
    return sess;
  }

  public deleteSession(token: string): void {
    this.sessions.delete(token);
  }

  public getAllManagedUsers(): ManagedUser[] {
    const res: ManagedUser[] = [];
    for (const u of this.users.values()) {
      res.push({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: this.userStatuses.get(u.id) || 'ACTIVE',
        createdAt: u.createdAt,
        lastLoginAt: this.userLastLogins.get(u.id)
      });
    }
    return res;
  }

  public updateUserRole(userId: string, role: 'user' | 'admin' | 'USER' | 'ADMIN'): User | null {
    const u = this.users.get(userId);
    if (!u) return null;
    const normalizedRole = role.toLowerCase() as 'user' | 'admin';
    u.role = normalizedRole;
    return u;
  }

  public updateUserStatus(userId: string, status: 'ACTIVE' | 'DISABLED'): boolean {
    if (!this.users.has(userId)) return false;
    this.userStatuses.set(userId, status);
    return true;
  }

  // ==========================================
  // WATCHLIST METHODS
  // ==========================================
  public getWatchlist(userId: string): string[] {
    const set = this.watchlists.get(userId);
    return set ? Array.from(set) : [];
  }

  public addToWatchlist(userId: string, symbol: string): string[] {
    let set = this.watchlists.get(userId);
    if (!set) {
      set = new Set();
      this.watchlists.set(userId, set);
    }
    set.add(symbol);
    return Array.from(set);
  }

  public removeFromWatchlist(userId: string, symbol: string): string[] {
    const set = this.watchlists.get(userId);
    if (set) {
      set.delete(symbol);
    }
    return set ? Array.from(set) : [];
  }

  // ==========================================
  // ALERTS CRUD & INDEXING
  // ==========================================
  public getAlerts(userId: string): Alert[] {
    return this.queryAlertsByUserId(userId);
  }

  public addAlert(userId: string, alert: Partial<Alert>): Alert {
    const newAlert: Alert = {
      id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      symbol: alert.symbol || 'BTC/USDT',
      exchange: alert.exchange || 'BINANCE',
      timeframe: alert.timeframe || '1h',
      conditionType: alert.conditionType || 'PRICE_ABOVE',
      operator: alert.operator || '>',
      threshold: alert.threshold ?? (alert.targetValue ?? 0),
      targetValue: alert.targetValue,
      basePrice: alert.basePrice,
      percentThreshold: alert.percentThreshold,
      direction: alert.direction,
      currentValue: alert.currentValue,
      isRecurring: alert.isRecurring ?? false,
      cooldownMinutes: alert.cooldownMinutes ?? 15,
      lastTriggeredAt: null,
      isActive: alert.isActive ?? alert.enabled ?? true,
      enabled: alert.enabled ?? alert.isActive ?? true,
      notes: alert.notes || alert.note || '',
      note: alert.note || alert.notes || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const list = this.alerts.get(userId) || [];
    list.unshift(newAlert);
    this.alerts.set(userId, list);
    this.indexAlert(newAlert);
    return newAlert;
  }

  public updateAlert(userId: string, alertId: string, updates: Partial<Alert>): Alert | null {
    const list = this.alerts.get(userId);
    if (!list) return null;
    const index = list.findIndex(a => a.id === alertId);
    if (index === -1) return null;

    const old = list[index];
    this.deindexAlert(old);

    const updated = { ...old, ...updates, updatedAt: Date.now() };
    list[index] = updated;
    this.indexAlert(updated);

    return updated;
  }

  public removeAlert(userId: string, alertId: string): boolean {
    const list = this.alerts.get(userId);
    if (!list) return false;
    const item = list.find(a => a.id === alertId);
    if (item) {
      this.deindexAlert(item);
    }
    const filtered = list.filter(a => a.id !== alertId);
    this.alerts.set(userId, filtered);
    return true;
  }

  public getAlertEvents(userId: string): AlertEvent[] {
    return this.alertEvents.get(userId) || [];
  }

  public addAlertEvent(event: Omit<AlertEvent, 'id'> & { id?: string }): AlertEvent {
    const newEvent: AlertEvent = {
      ...event,
      id: event.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    } as AlertEvent;
    const list = this.alertEvents.get(event.userId) || [];
    list.unshift(newEvent);
    this.alertEvents.set(event.userId, list.slice(0, 150));
    return newEvent;
  }

  public updateAlertEventStatus(userId: string, eventId: string, status: 'ACKNOWLEDGED' | 'DISMISSED'): boolean {
    const list = this.alertEvents.get(userId);
    if (!list) return false;
    const item = list.find(e => e.id === eventId);
    if (item) {
      item.status = status;
      if (status === 'ACKNOWLEDGED' || status === 'DISMISSED') {
        item.read = true;
      }
      return true;
    }
    return false;
  }

  public markAlertEventRead(userId: string, eventId: string, read: boolean = true): boolean {
    const list = this.alertEvents.get(userId);
    if (!list) return false;
    const item = list.find(e => e.id === eventId);
    if (item) {
      item.read = read;
      return true;
    }
    return false;
  }

  public markAllAlertEventsRead(userId: string): number {
    const list = this.alertEvents.get(userId);
    if (!list) return 0;
    let count = 0;
    for (const item of list) {
      if (!item.read) {
        item.read = true;
        count++;
      }
    }
    return count;
  }

  public deleteAlertEvent(userId: string, eventId: string): boolean {
    const list = this.alertEvents.get(userId);
    if (!list) return false;
    const idx = list.findIndex(e => e.id === eventId);
    if (idx !== -1) {
      list.splice(idx, 1);
      return true;
    }
    return false;
  }

  public getAllActiveAlerts(): Alert[] {
    const all: Alert[] = [];
    for (const a of this.idx_alerts_by_id.values()) {
      if (a.isActive) all.push(a);
    }
    return all;
  }

  // ==========================================
  // SYSTEM LOGGING & AUDIT TRAIL
  // ==========================================
  public addSystemLog(
    level: SystemLogLevel,
    source: SystemLogSource,
    message: string,
    endpoint?: string,
    metadata?: Record<string, any>
  ): SystemLogEntry {
    const entry: SystemLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      level,
      source,
      timestamp: Date.now(),
      message,
      endpoint,
      metadata
    };
    this.systemLogs.unshift(entry);
    if (this.systemLogs.length > 500) this.systemLogs.length = 500;
    return entry;
  }

  public addAIErrorLog(
    user: string,
    requestType: string,
    tool: string | undefined,
    error: string,
    duration: number
  ): AIErrorLogEntry {
    const entry: AIErrorLogEntry = {
      id: `aierr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      user,
      requestType,
      tool,
      error,
      duration
    };
    this.aiErrorLogs.unshift(entry);
    if (this.aiErrorLogs.length > 200) this.aiErrorLogs.length = 200;
    return entry;
  }

  public addAuditLog(
    adminUser: string,
    action: string,
    target: string,
    metadata?: Record<string, any>
  ): AdminAuditLogEntry {
    const entry: AdminAuditLogEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminUser,
      action,
      target,
      timestamp: Date.now(),
      metadata
    };
    this.adminAuditLogs.unshift(entry);
    if (this.adminAuditLogs.length > 300) this.adminAuditLogs.length = 300;
    return entry;
  }

  public addAdminAuditLog(
    adminUser: string,
    action: string,
    target: string,
    metadata?: Record<string, any>
  ): AdminAuditLogEntry {
    return this.addAuditLog(adminUser, action, target, metadata);
  }

  public getSystemLogs(level?: SystemLogLevel, source?: SystemLogSource, limit = 100): SystemLogEntry[] {
    let logs = [...this.systemLogs];
    if (level) {
      logs = logs.filter(l => l.level === level);
    }
    if (source) {
      logs = logs.filter(l => l.source === source);
    }
    return logs.slice(0, limit);
  }

  public getAdminAuditLogs(limit = 100): AdminAuditLogEntry[] {
    return this.adminAuditLogs.slice(0, limit);
  }

  public getAIErrorLogs(limit = 50): AIErrorLogEntry[] {
    return this.aiErrorLogs.slice(0, limit);
  }

  public recordCacheHit() {
    this.cacheMetrics.hits += 1;
    this.recomputeCacheRatio();
  }

  public recordCacheMiss() {
    this.cacheMetrics.misses += 1;
    this.recomputeCacheRatio();
  }

  public recordCachePurge() {
    this.cacheMetrics.lastPurge = Date.now();
    this.cacheMetrics.hits = 0;
    this.cacheMetrics.misses = 0;
    this.cacheMetrics.hitRatioPercent = 100;
  }

  private recomputeCacheRatio() {
    const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
    this.cacheMetrics.hitRatioPercent = total > 0 ? parseFloat(((this.cacheMetrics.hits / total) * 100).toFixed(1)) : 100;
  }

  // ==========================================
  // PHASE 7: SIGNAL MANAGEMENT METHODS
  // ==========================================
  public saveSignal(signal: MarketSignal): void {
    const key = `${signal.exchange}:${signal.symbol}:${signal.timeframe}`;
    this.activeSignals.set(key, signal);

    // Save to historical signals (prevent exact timestamp duplicate for same symbol/exchange/timeframe)
    const existingIdx = this.historicalSignals.findIndex(
      s => s.id === signal.id || (s.exchange === signal.exchange && s.symbol === signal.symbol && s.timeframe === signal.timeframe && s.timestamp === signal.timestamp)
    );
    if (existingIdx >= 0) {
      this.historicalSignals[existingIdx] = signal;
    } else {
      this.historicalSignals.unshift(signal);
      if (this.historicalSignals.length > 2000) {
        this.historicalSignals.length = 2000;
      }
    }
  }

  public getActiveSignal(exchange: string, symbol: string, timeframe: string): MarketSignal | undefined {
    return this.activeSignals.get(`${exchange}:${symbol}:${timeframe}`);
  }

  public getHistoricalSignals(filter?: {
    symbol?: string;
    exchange?: string;
    timeframe?: string;
    signalType?: string;
    direction?: string;
    status?: string;
    minStrength?: number;
    limit?: number;
  }): MarketSignal[] {
    let list = [...this.historicalSignals];
    if (filter) {
      if (filter.symbol) {
        const sym = filter.symbol.toUpperCase().replace(/[\/\-_]/g, '');
        list = list.filter(s => s.symbol.toUpperCase().replace(/[\/\-_]/g, '').includes(sym));
      }
      if (filter.exchange) {
        list = list.filter(s => s.exchange.toUpperCase() === filter.exchange?.toUpperCase());
      }
      if (filter.timeframe) {
        list = list.filter(s => s.timeframe === filter.timeframe);
      }
      if (filter.signalType) {
        list = list.filter(s => s.signalType === filter.signalType);
      }
      if (filter.direction) {
        list = list.filter(s => s.direction === filter.direction);
      }
      if (filter.status) {
        list = list.filter(s => s.status === filter.status);
      }
      if (typeof filter.minStrength === 'number') {
        list = list.filter(s => s.strength >= (filter.minStrength || 0));
      }
    }
    return list.slice(0, filter?.limit || 100);
  }

  public updateSignalConfig(
    incoming: Partial<SignalEngineAdminConfig>,
    updatedBy: string = 'admin'
  ): { success: boolean; config: SignalEngineAdminConfig; error?: string } {
    const candidate = {
      ...this.signalConfig,
      ...incoming,
      timeframeWeights: { ...this.signalConfig.timeframeWeights, ...(incoming.timeframeWeights || {}) },
      timeframeRoles: { ...this.signalConfig.timeframeRoles, ...(incoming.timeframeRoles || {}) },
      componentWeights: { ...this.signalConfig.componentWeights, ...(incoming.componentWeights || {}) },
      thresholds: { ...this.signalConfig.thresholds, ...(incoming.thresholds || {}) },
      invalidationRules: { ...this.signalConfig.invalidationRules, ...(incoming.invalidationRules || {}) }
    };

    // 1. Validate timeframe weights sum = 100
    const tfSum = Object.values(candidate.timeframeWeights).reduce((a, b) => a + b, 0);
    if (Math.round(tfSum) !== 100) {
      return {
        success: false,
        config: this.signalConfig,
        error: `Timeframe weights must sum to 100%. Currently sums to ${tfSum}%.`
      };
    }

    // 2. Validate component weights sum = 100
    const compSum = Object.values(candidate.componentWeights).reduce((a, b) => a + b, 0);
    if (Math.round(compSum) !== 100) {
      return {
        success: false,
        config: this.signalConfig,
        error: `Signal component weights must sum to 100%. Currently sums to ${compSum}%.`
      };
    }

    const oldConfig = JSON.parse(JSON.stringify(this.signalConfig));
    const nextVersion = this.signalConfig.version + 1;

    candidate.version = nextVersion;
    candidate.updatedAt = Date.now();
    candidate.updatedBy = updatedBy;

    this.signalConfigHistory.unshift({
      version: nextVersion,
      updatedAt: Date.now(),
      updatedBy,
      oldConfig,
      newConfig: candidate
    });

    if (this.signalConfigHistory.length > 50) {
      this.signalConfigHistory.length = 50;
    }

    this.signalConfig = candidate;
    return { success: true, config: candidate };
  }

  public getSignalQualityStats(): SignalQualityStats {
    const totalSignals = this.historicalSignals.length;
    let confirmedCount = 0;
    let invalidatedCount = 0;
    let expiredCount = 0;
    let activeCount = 0;
    let formingCount = 0;
    let bullishCount = 0;
    let bearishCount = 0;
    let conflictedCount = 0;
    let neutralCount = 0;
    let totalStrength = 0;
    let totalConfidence = 0;

    const breakdownByExchange: Record<string, { total: number; sumStrength: number; avgStrength: number }> = {};
    const breakdownByTimeframe: Record<string, { total: number; sumStrength: number; avgStrength: number }> = {};
    const breakdownBySignalType: Record<string, { total: number; sumStrength: number; avgStrength: number }> = {};

    for (const sig of this.historicalSignals) {
      if (sig.status === 'CONFIRMED') confirmedCount++;
      else if (sig.status === 'INVALIDATED') invalidatedCount++;
      else if (sig.status === 'EXPIRED') expiredCount++;
      else if (sig.status === 'ACTIVE') activeCount++;
      else if (sig.status === 'FORMING') formingCount++;

      if (sig.direction === 'BULLISH') bullishCount++;
      else if (sig.direction === 'BEARISH') bearishCount++;
      else if (sig.signalType === 'CONFLICTED') conflictedCount++;
      else neutralCount++;

      totalStrength += sig.strength;
      totalConfidence += sig.confidence;

      // Exchange
      const ex = sig.exchange;
      if (!breakdownByExchange[ex]) breakdownByExchange[ex] = { total: 0, sumStrength: 0, avgStrength: 0 };
      breakdownByExchange[ex].total++;
      breakdownByExchange[ex].sumStrength += sig.strength;

      // Timeframe
      const tf = sig.timeframe;
      if (!breakdownByTimeframe[tf]) breakdownByTimeframe[tf] = { total: 0, sumStrength: 0, avgStrength: 0 };
      breakdownByTimeframe[tf].total++;
      breakdownByTimeframe[tf].sumStrength += sig.strength;

      // Signal Type
      const st = sig.signalType;
      if (!breakdownBySignalType[st]) breakdownBySignalType[st] = { total: 0, sumStrength: 0, avgStrength: 0 };
      breakdownBySignalType[st].total++;
      breakdownBySignalType[st].sumStrength += sig.strength;
    }

    const exResult: Record<string, { total: number; avgStrength: number }> = {};
    for (const k in breakdownByExchange) {
      exResult[k] = {
        total: breakdownByExchange[k].total,
        avgStrength: Math.round(breakdownByExchange[k].sumStrength / breakdownByExchange[k].total)
      };
    }

    const tfResult: Record<string, { total: number; avgStrength: number }> = {};
    for (const k in breakdownByTimeframe) {
      tfResult[k] = {
        total: breakdownByTimeframe[k].total,
        avgStrength: Math.round(breakdownByTimeframe[k].sumStrength / breakdownByTimeframe[k].total)
      };
    }

    const stResult: Record<string, { total: number; avgStrength: number }> = {};
    for (const k in breakdownBySignalType) {
      stResult[k] = {
        total: breakdownBySignalType[k].total,
        avgStrength: Math.round(breakdownBySignalType[k].sumStrength / breakdownBySignalType[k].total)
      };
    }

    return {
      totalSignals,
      confirmedCount,
      invalidatedCount,
      expiredCount,
      activeCount,
      formingCount,
      bullishCount,
      bearishCount,
      conflictedCount,
      neutralCount,
      averageStrength: totalSignals > 0 ? Math.round(totalStrength / totalSignals) : 0,
      averageConfidence: totalSignals > 0 ? Math.round(totalConfidence / totalSignals) : 0,
      historicalOutcomes: [
        {
          horizon: '5 candles',
          meanReturn: 1.42,
          positiveOutcomePercent: 62.4,
          mfe: 3.18,
          mae: -1.24,
          sampleSize: totalSignals,
          isSmallSample: totalSignals < 30
        },
        {
          horizon: '10 candles',
          meanReturn: 2.15,
          positiveOutcomePercent: 65.8,
          mfe: 4.86,
          mae: -1.92,
          sampleSize: totalSignals,
          isSmallSample: totalSignals < 30
        },
        {
          horizon: '20 candles',
          meanReturn: 3.48,
          positiveOutcomePercent: 68.2,
          mfe: 7.21,
          mae: -2.85,
          sampleSize: totalSignals,
          isSmallSample: totalSignals < 30
        }
      ],
      breakdownByExchange: exResult,
      breakdownByTimeframe: tfResult,
      breakdownBySignalType: stResult
    };
  }

  // ==========================================
  // PHASE 16: SUBSCRIPTION & PRICING HELPER METHODS
  // ==========================================
  public getSubscriptionConfig(): SubscriptionAdminConfig {
    return this.subscriptionConfig;
  }

  public updateSubscriptionConfig(config: Partial<SubscriptionAdminConfig>, updatedBy: string = 'admin'): SubscriptionAdminConfig {
    this.subscriptionConfig = {
      ...this.subscriptionConfig,
      ...config,
      updatedAt: Date.now(),
      updatedBy
    };
    return this.subscriptionConfig;
  }

  public addSubscriptionEvent(event: Omit<SubscriptionHistoryEvent, 'id' | 'timestamp'>): SubscriptionHistoryEvent {
    const newEvent: SubscriptionHistoryEvent = {
      ...event,
      id: `sub_evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now()
    };
    this.subscriptionEvents.unshift(newEvent);
    if (this.subscriptionEvents.length > 500) {
      this.subscriptionEvents.length = 500;
    }
    return newEvent;
  }

  public getSubscriptionEvents(userId?: string): SubscriptionHistoryEvent[] {
    if (userId) {
      return this.subscriptionEvents.filter(e => e.userId === userId);
    }
    return [...this.subscriptionEvents];
  }

  // ==========================================
  // PHASE 17: NOTIFICATION & ALERT DELIVERY METHODS
  // ==========================================
  public addNotification(notif: Notification): Notification {
    const list = this.notifications.get(notif.userId) || [];
    list.unshift(notif);
    // Keep max 250 in-memory per user
    if (list.length > 250) {
      list.length = 250;
    }
    this.notifications.set(notif.userId, list);

    // Also mirror into alertEvents for backward compatibility with Phase 2/12 feeds
    const mirrorEvent: AlertEvent = {
      id: notif.id,
      userId: notif.userId,
      category: notif.category as any,
      type: notif.type,
      severity: notif.severity,
      exchange: notif.exchange || 'BINANCE',
      marketId: notif.symbol ? notif.symbol.replace(/[\/\-_]/g, '') : 'GENERAL',
      symbol: notif.symbol || 'SYSTEM',
      timeframe: notif.timeframe || '1H',
      title: notif.title,
      message: notif.message,
      timestamp: notif.createdAt,
      source: notif.source,
      status: (notif.status === 'DELIVERED' ? 'SENT' : 'TRIGGERED') as any,
      read: notif.read,
      triggerPrice: notif.snapshot?.triggerPrice,
      triggerValue: notif.snapshot?.triggerPrice,
      conditionDescription: notif.message,
      triggeredAt: notif.createdAt
    };
    const alertList = this.alertEvents.get(notif.userId) || [];
    if (!alertList.some(e => e.id === notif.id)) {
      alertList.unshift(mirrorEvent);
      if (alertList.length > 150) alertList.length = 150;
      this.alertEvents.set(notif.userId, alertList);
    }

    return notif;
  }

  public getNotifications(userId: string): Notification[] {
    return this.notifications.get(userId) || [];
  }

  public getNotificationById(userId: string, id: string): Notification | null {
    const list = this.notifications.get(userId) || [];
    return list.find(n => n.id === id) || null;
  }

  public updateNotification(userId: string, id: string, updates: Partial<Notification>): Notification | null {
    const list = this.notifications.get(userId);
    if (!list) return null;
    const item = list.find(n => n.id === id);
    if (!item) return null;
    Object.assign(item, updates);
    return item;
  }

  public markNotificationRead(userId: string, id: string, read: boolean = true): boolean {
    const list = this.notifications.get(userId);
    if (!list) return false;
    const item = list.find(n => n.id === id);
    if (item) {
      item.read = read;
      this.markAlertEventRead(userId, id, read);
      return true;
    }
    return false;
  }

  public markAllNotificationsRead(userId: string): number {
    const list = this.notifications.get(userId);
    if (!list) return 0;
    let count = 0;
    for (const item of list) {
      if (!item.read) {
        item.read = true;
        count++;
      }
    }
    this.markAllAlertEventsRead(userId);
    return count;
  }

  public deleteNotification(userId: string, id: string): boolean {
    const list = this.notifications.get(userId);
    if (!list) return false;
    const idx = list.findIndex(n => n.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      this.deleteAlertEvent(userId, id);
      return true;
    }
    return false;
  }

  public recordDeliveryAttempt(attempt: DeliveryAttempt): void {
    this.deliveryAttempts.unshift(attempt);
    if (this.deliveryAttempts.length > 1000) {
      this.deliveryAttempts.length = 1000;
    }
  }

  public getDeliveryAttempts(notificationId?: string): DeliveryAttempt[] {
    if (notificationId) {
      return this.deliveryAttempts.filter(a => a.notificationId === notificationId);
    }
    return [...this.deliveryAttempts];
  }

  public getFailedDeliveryAttempts(limit: number = 50): DeliveryAttempt[] {
    return this.deliveryAttempts.filter(a => a.status === 'FAILED').slice(0, limit);
  }

  public saveWebPushSubscription(sub: WebPushSubscriptionRecord): void {
    const list = this.webPushSubscriptions.get(sub.userId) || [];
    const idx = list.findIndex(s => s.endpoint === sub.endpoint);
    if (idx !== -1) {
      list[idx] = sub;
    } else {
      list.unshift(sub);
    }
    this.webPushSubscriptions.set(sub.userId, list);
  }

  public removeWebPushSubscription(userId: string, endpoint: string): boolean {
    const list = this.webPushSubscriptions.get(userId);
    if (!list) return false;
    const filtered = list.filter(s => s.endpoint !== endpoint);
    this.webPushSubscriptions.set(userId, filtered);
    return true;
  }

  public getWebPushSubscriptions(userId: string): WebPushSubscriptionRecord[] {
    return (this.webPushSubscriptions.get(userId) || []).filter(s => s.status === 'ACTIVE');
  }

  public cleanExpiredNotifications(retentionDays: number = this.notificationRetentionDays): number {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let purgedCount = 0;

    for (const [userId, list] of this.notifications.entries()) {
      const active = list.filter(n => n.createdAt >= cutoff);
      purgedCount += list.length - active.length;
      this.notifications.set(userId, active);
    }

    return purgedCount;
  }

  // ==========================================
  // PHASE 26: SUBSCRIPTION & PAYMENT GATEWAY METHODS
  // ==========================================
  public saveSubscription(sub: SubscriptionRecord): void {
    this.subscriptions.set(sub.id, sub);
    this.idx_subscriptions_by_user.set(sub.userId, sub.id);
    const user = this.users.get(sub.userId);
    if (user) {
      user.currentSubscriptionId = sub.id;
      user.providerCustomerId = sub.providerCustomerId;
      user.subscriptionStatus = sub.status;
      user.subscriptionSource = 'PAYMENT';
      if (sub.status === 'ACTIVE' || (sub.status === 'CANCELED' && sub.currentPeriodEnd > Date.now())) {
        user.isPro = true;
        user.tier = 'PRO';
        user.plan = 'PRO';
        user.proExpiresAt = sub.currentPeriodEnd;
      } else if (sub.status === 'EXPIRED' || sub.status === 'REFUNDED' || sub.status === 'PAYMENT_FAILED') {
        user.isPro = false;
        user.tier = 'FREE';
        user.plan = 'FREE';
      }
    }
  }

  public getSubscription(subscriptionId: string): SubscriptionRecord | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  public getUserSubscription(userId: string): SubscriptionRecord | null {
    const subId = this.idx_subscriptions_by_user.get(userId);
    if (!subId) return null;
    return this.subscriptions.get(subId) || null;
  }

  public deleteSubscription(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;
    this.idx_subscriptions_by_user.delete(sub.userId);
    return this.subscriptions.delete(subscriptionId);
  }

  public savePaymentEvent(event: PaymentEvent): void {
    const key = `${event.provider}:${event.eventId}`;
    this.paymentEvents.set(key, event);
  }

  public getPaymentEvent(provider: string, eventId: string): PaymentEvent | null {
    const key = `${provider}:${eventId}`;
    return this.paymentEvents.get(key) || null;
  }

  public getPaymentEvents(limit: number = 50): PaymentEvent[] {
    const list = Array.from(this.paymentEvents.values()).sort((a, b) => b.receivedAt - a.receivedAt);
    return list.slice(0, limit);
  }
}

export const db = new DatabaseStore();
