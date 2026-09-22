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
  WatchlistRecord
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
  // PHASE 4A: DATABASE SECONDARY INDEXES
  // Frequently queried fields: symbol, exchange, timeframe, timestamp, userId, alertId, createdAt
  // ==========================================
  public idx_alerts_by_userId: Map<string, Set<string>> = new Map();
  public idx_alerts_by_symbol: Map<string, Set<string>> = new Map();
  public idx_alerts_by_exchange: Map<string, Set<string>> = new Map();
  public idx_alerts_by_id: Map<string, Alert> = new Map();
  public idx_indicators_by_key: Map<string, IndicatorSnapshot> = new Map(); // `${exchange}:${symbol}:${timeframe}`
  public idx_users_by_email: Map<string, string> = new Map();

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
    // 1. Regular User (Terminal Analyst)
    const demoUser: User = {
      id: 'usr_demo_terminal',
      email: 'demo@cryptointelligence.ai',
      name: 'Terminal Analyst',
      role: 'user',
      createdAt: Date.now() - 86400000 * 30
    };
    this.users.set(demoUser.id, demoUser);
    this.userPasswords.set(demoUser.email.toLowerCase(), 'demo1234');
    this.userStatuses.set(demoUser.id, 'ACTIVE');
    this.userLastLogins.set(demoUser.id, Date.now() - 3600000);
    this.idx_users_by_email.set(demoUser.email.toLowerCase(), demoUser.id);

    const demoSession: Session = {
      id: 'sess_demo_default',
      userId: demoUser.id,
      token: 'token_demo_analytics_jwt',
      expiresAt: Date.now() + 86400000 * 30,
      createdAt: Date.now()
    };
    this.sessions.set(demoSession.token, demoSession);

    // 2. Admin User (System Administrator)
    const adminUser: User = {
      id: 'usr_admin_master',
      email: 'admin@cryptointelligence.ai',
      name: 'System Administrator',
      role: 'admin',
      createdAt: Date.now() - 86400000 * 60
    };
    this.users.set(adminUser.id, adminUser);
    this.userPasswords.set(adminUser.email.toLowerCase(), 'admin1234');
    this.userStatuses.set(adminUser.id, 'ACTIVE');
    this.userLastLogins.set(adminUser.id, Date.now() - 120000);
    this.idx_users_by_email.set(adminUser.email.toLowerCase(), adminUser.id);

    const adminSession: Session = {
      id: 'sess_admin_default',
      userId: adminUser.id,
      token: 'token_admin_super_jwt',
      expiresAt: Date.now() + 86400000 * 30,
      createdAt: Date.now()
    };
    this.sessions.set(adminSession.token, adminSession);

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
        symbol: 'ETH/USDT',
        exchange: 'BYBIT',
        condition: 'BREAKOUT_DETECTED',
        conditionDescription: 'Technical breakout detected above swing resistance with volume confirmation.',
        actualValue: 3340.50,
        threshold: 3320.00,
        triggerPrice: 3340.50,
        message: 'Technical breakout detected above swing resistance with volume confirmation.',
        read: true,
        status: 'ACKNOWLEDGED',
        timestamp: Date.now() - 14400000,
        triggeredAt: Date.now() - 14400000
      }
    ]);
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

  public createUser(email: string, passwordPlain: string, name: string, role: 'user' | 'admin' = 'user'): User {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user: User = {
      id,
      email: email.toLowerCase(),
      name,
      role,
      createdAt: Date.now()
    };
    this.users.set(id, user);
    this.userPasswords.set(email.toLowerCase(), passwordPlain);
    this.userStatuses.set(id, 'ACTIVE');
    this.userLastLogins.set(id, Date.now());
    this.idx_users_by_email.set(email.toLowerCase(), id);
    this.watchlists.set(id, new Set(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']));
    this.alerts.set(id, []);
    this.alertEvents.set(id, []);
    return user;
  }

  public createSession(userId: string): Session {
    const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const session: Session = {
      id: `sess_${Date.now()}`,
      userId,
      token,
      expiresAt: Date.now() + 86400000 * 7, // 7 days
      createdAt: Date.now()
    };
    this.sessions.set(token, session);
    this.userLastLogins.set(userId, Date.now());
    return session;
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

  public addAlertEvent(event: Omit<AlertEvent, 'id'>): AlertEvent {
    const newEvent: AlertEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    const list = this.alertEvents.get(event.userId) || [];
    list.unshift(newEvent);
    this.alertEvents.set(event.userId, list.slice(0, 100));
    return newEvent;
  }

  public updateAlertEventStatus(userId: string, eventId: string, status: 'ACKNOWLEDGED' | 'DISMISSED'): boolean {
    const list = this.alertEvents.get(userId);
    if (!list) return false;
    const item = list.find(e => e.id === eventId);
    if (item) {
      item.status = status;
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
}

export const db = new DatabaseStore();
