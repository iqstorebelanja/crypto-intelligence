import {
  Alert,
  AlertDefinitionState,
  AlertEvidenceItem,
  AlertLimitsConfig,
  AlertSeverity,
  ChannelHealthMetric,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DeliveryAttempt,
  DeliveryErrorClassification,
  NormalizedCoinData,
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationHealthSummary,
  NotificationStatus,
  ProviderHealthState,
  UnifiedAlert,
  UnifiedAlertCategory,
  User,
  UserNotificationPreferences
} from '../../src/types';
import { db } from '../db/schema';
import {
  AlertRateLimiter,
  calculateNextRetryDelay,
  CircuitBreaker,
  classifyDeliveryError
} from './circuitBreaker';
import { inAppNotificationProvider } from './notificationProviders/inAppProvider';
import { webPushNotificationProvider } from './notificationProviders/webPushProvider';
import { telegramNotificationProvider } from './notificationProviders/telegramProvider';
import { emailNotificationProvider } from './notificationProviders/emailProvider';
import { NotificationProviderInterface } from './notificationProviders/baseProvider';

export interface CreateNotificationParams {
  userId: string;
  category: NotificationCategory | UnifiedAlertCategory;
  type?: string;
  title: string;
  message: string;
  symbol?: string;
  exchange?: string;
  marketType?: 'SPOT' | 'PERPETUAL' | 'FUTURES' | 'SWAP';
  timeframe?: string;
  direction?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  severity?: AlertSeverity;
  source?: string;
  sourceId?: string;
  dedupeKey?: string;
  metadata?: Record<string, any>;
  deepLink?: string;
  requiresCandleClose?: boolean;
  isCandleClosed?: boolean;
  isDataFresh?: boolean;
  snapshot?: {
    triggerPrice?: number;
    indicatorSnapshot?: Record<string, any>;
    structureSnapshot?: Record<string, any>;
    scoreSnapshot?: Record<string, any>;
  };
}

export interface StructuredNotificationLog {
  timestamp: number;
  event:
    | 'ALERT_TRIGGERED'
    | 'NOTIFICATION_QUEUED'
    | 'NOTIFICATION_DEDUPED'
    | 'DELIVERY_STARTED'
    | 'DELIVERY_SUCCESS'
    | 'DELIVERY_RETRY'
    | 'DELIVERY_FAILED'
    | 'PROVIDER_RATE_LIMIT'
    | 'PROVIDER_UNAVAILABLE'
    | 'ALERT_SUPPRESSED'
    | 'ENTITLEMENT_BLOCKED';
  userId?: string;
  notificationId?: string;
  channel?: NotificationChannel;
  provider?: string;
  symbol?: string;
  exchange?: string;
  category?: string;
  errorCode?: string;
  message?: string;
}

export class NotificationService {
  private userPreferences: Map<string, UserNotificationPreferences> = new Map();
  private dedupeCache: Map<string, number> = new Map(); // dedupeKey -> timestamp
  private alertCooldowns: Map<string, number> = new Map(); // `${userId}_${symbol}_${condition}` -> timestamp
  private providers: Map<NotificationChannel, NotificationProviderInterface> = new Map();
  private circuitBreakers: Map<NotificationChannel, CircuitBreaker> = new Map();
  private rateLimiter: AlertRateLimiter;
  private structuredLogs: StructuredNotificationLog[] = [];
  private readonly maxLogs: number = 500;

  // Queue for deferred deliveries (e.g., quiet hours or transient retries)
  private deferredQueue: Array<{
    notification: Notification;
    channel: NotificationChannel;
    attemptNumber: number;
    deliverAt: number;
  }> = [];

  constructor() {
    this.rateLimiter = new AlertRateLimiter(60, 25, 120);

    // Register Channel Providers
    this.providers.set('IN_APP', inAppNotificationProvider);
    this.providers.set('WEB_PUSH', webPushNotificationProvider);
    this.providers.set('TELEGRAM', telegramNotificationProvider);
    this.providers.set('EMAIL', emailNotificationProvider);

    // Register Circuit Breakers for each provider
    this.circuitBreakers.set('IN_APP', new CircuitBreaker('In-App Storage', { failureThreshold: 5, resetTimeoutMs: 15000 }));
    this.circuitBreakers.set('WEB_PUSH', new CircuitBreaker('Web Push Gateway', { failureThreshold: 4, resetTimeoutMs: 30000 }));
    this.circuitBreakers.set('TELEGRAM', new CircuitBreaker('Telegram Bot Bridge', { failureThreshold: 4, resetTimeoutMs: 30000 }));
    this.circuitBreakers.set('EMAIL', new CircuitBreaker('Email SMTP Gateway', { failureThreshold: 3, resetTimeoutMs: 45000 }));

    // Seed default preferences for standard accounts
    this.seedDefaultPreferences();

    // Start background worker for retries and quiet hours flushing
    this.startBackgroundQueueWorker();
  }

  private seedDefaultPreferences(): void {
    const demoIds = ['usr_demo_terminal', 'usr_demo_1', 'usr_demo_pro', 'admin'];
    for (const id of demoIds) {
      this.userPreferences.set(id, {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        userId: id
      });
    }
  }

  private logEvent(entry: StructuredNotificationLog): void {
    this.structuredLogs.unshift(entry);
    if (this.structuredLogs.length > this.maxLogs) {
      this.structuredLogs.length = this.maxLogs;
    }
  }

  public getStructuredLogs(limit: number = 100): StructuredNotificationLog[] {
    return this.structuredLogs.slice(0, limit);
  }

  // ==========================================
  // PREFERENCES MANAGEMENT
  // ==========================================
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

  // ==========================================
  // ENTITLEMENT CHECKS (Phase 15 / 16 Integration)
  // ==========================================
  public canUseNotificationChannel(user: User | null, channel: NotificationChannel): boolean {
    if (!user) return channel === 'IN_APP';
    if (user.role === 'admin') return true;

    const isPro = Boolean(user.isPro);
    const isTrial = user.trialStatus === 'ACTIVE' && (user.trialEndsAt ? user.trialEndsAt > Date.now() : true);

    if (channel === 'IN_APP') return true;

    // Advanced delivery channels (Web Push, Telegram, Email) are PRO/Trial features
    return isPro || isTrial;
  }

  public canUseAlertType(user: User | null, category: NotificationCategory | UnifiedAlertCategory, symbol?: string): boolean {
    if (!user) {
      // Free guest: only basic BTC/ETH signals & price
      const s = (symbol || '').toUpperCase().replace(/[\/\-_]/g, '');
      const isBtcEth = s === 'BTC' || s === 'BTCUSDT' || s === 'ETH' || s === 'ETHUSDT' || s === '';
      return isBtcEth && (category === 'PRICE' || category === 'SIGNAL' || category === 'Bull Signal');
    }

    if (user.role === 'admin') return true;

    const isPro = Boolean(user.isPro);
    const isTrial = user.trialStatus === 'ACTIVE' && (user.trialEndsAt ? user.trialEndsAt > Date.now() : true);
    if (isPro || isTrial) return true;

    // FREE user: restricted to BTC/ETH and basic categories
    const s = (symbol || '').toUpperCase().replace(/[\/\-_]/g, '');
    const isBtcEth = s === 'BTC' || s === 'BTCUSDT' || s === 'ETH' || s === 'ETHUSDT' || s === '';
    const isBasicCategory =
      category === 'PRICE' ||
      category === 'SIGNAL' ||
      category === 'Bull Signal' ||
      category === 'Bearish Signal' ||
      category === 'RSI' ||
      category === 'VOLUME';

    return isBtcEth && isBasicCategory;
  }

  public getAlertLimits(user: User | null): AlertLimitsConfig {
    const isPro = user ? Boolean(user.isPro) || (user.trialStatus === 'ACTIVE' && (user.trialEndsAt ? user.trialEndsAt > Date.now() : true)) || user.role === 'admin' : false;

    if (isPro) {
      return {
        maxActiveAlerts: 25,
        maxAdvancedAlerts: 25,
        maxWhaleAlerts: 25,
        maxOrderFlowAlerts: 25,
        allowedChannels: ['IN_APP', 'WEB_PUSH', 'TELEGRAM', 'EMAIL']
      };
    }

    return {
      maxActiveAlerts: 3,
      maxAdvancedAlerts: 0,
      maxWhaleAlerts: 0,
      maxOrderFlowAlerts: 0,
      allowedChannels: ['IN_APP']
    };
  }

  // ==========================================
  // IDEMPOTENCY & DEDUPLICATION
  // ==========================================
  public generateDedupeKey(params: {
    userId: string;
    category: string;
    symbol?: string;
    exchange?: string;
    timeframe?: string;
    type?: string;
    bucketWindowMs?: number;
    candleTimestamp?: number;
    txHash?: string;
  }): string {
    const windowMs = params.bucketWindowMs || 15 * 60 * 1000; // 15m default
    const bucket = params.candleTimestamp || Math.floor(Date.now() / windowMs);

    if (params.txHash) {
      return `WHALE:${params.exchange || 'CHAIN'}:${params.txHash}:${params.userId}`;
    }

    const sym = (params.symbol || 'MARKET').toUpperCase().replace(/[\/\-_]/g, '');
    const ex = (params.exchange || 'ALL').toUpperCase();
    const tf = (params.timeframe || '1H').toUpperCase();
    const cat = params.category.toUpperCase().replace(/\s+/g, '_');

    return `${params.userId}:${ex}:${sym}:${tf}:${cat}:${bucket}`;
  }

  public isDuplicate(dedupeKey: string, dedupeWindowMs: number = 15 * 60 * 1000): boolean {
    const lastSeen = this.dedupeCache.get(dedupeKey);
    const now = Date.now();
    if (lastSeen && now - lastSeen < dedupeWindowMs) {
      return true;
    }
    this.dedupeCache.set(dedupeKey, now);

    // Prune stale dedupe entries if cache grows
    if (this.dedupeCache.size > 2000) {
      const cutoff = now - 3600000;
      for (const [k, v] of this.dedupeCache.entries()) {
        if (v < cutoff) this.dedupeCache.delete(k);
      }
    }
    return false;
  }

  // ==========================================
  // QUIET HOURS HANDLING
  // ==========================================
  public isWithinQuietHours(prefs: UserNotificationPreferences, now: Date = new Date()): boolean {
    if (!prefs.quietHoursEnabled) return false;
    try {
      // Evaluate in user timezone or UTC
      const tz = prefs.quietHoursTimezone || 'UTC';
      const timeString = now.toLocaleTimeString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' });
      const [nowH, nowM] = timeString.split(':').map(Number);
      const currentMinutes = nowH * 60 + nowM;

      const [startH, startM] = (prefs.quietHoursStart || '23:00').split(':').map(Number);
      const [endH, endM] = (prefs.quietHoursEnd || '07:00').split(':').map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Across midnight (e.g. 23:00 -> 07:00)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch {
      return false;
    }
  }

  // ==========================================
  // DEEP LINK BUILDER
  // ==========================================
  public buildDeepLink(symbol?: string, exchange?: string, timeframe?: string, category?: string): string {
    const cleanSym = symbol ? symbol.toUpperCase().replace(/[\/\-_]/g, '') : '';
    const ex = exchange ? encodeURIComponent(exchange) : 'Binance';
    const tf = timeframe ? encodeURIComponent(timeframe) : '15m';

    if (cleanSym) {
      if (category === 'WHALE' || category === 'Whale Activity') {
        return `/whales?symbol=${cleanSym}&exchange=${ex}`;
      }
      return `/coin/${cleanSym}?exchange=${ex}&timeframe=${tf}`;
    }

    if (category === 'WHALE' || category === 'Whale Activity') {
      return `/whales?exchange=${ex}`;
    }

    return `/alerts`;
  }

  // ==========================================
  // CENTRAL NOTIFICATION CREATION & DISPATCH
  // ==========================================
  public async createNotification(params: CreateNotificationParams): Promise<{
    notification: Notification | null;
    deduped: boolean;
    suppressedReason?: string;
  }> {
    const now = Date.now();
    const prefs = this.getUserPreferences(params.userId);
    const user = db.getUserById(params.userId) || null;

    // 1. Data Quality Guard: Stale data suppresses alerts requiring live prices
    if (params.isDataFresh === false) {
      this.logEvent({
        timestamp: now,
        event: 'ALERT_SUPPRESSED',
        userId: params.userId,
        symbol: params.symbol,
        exchange: params.exchange,
        message: 'Data quality guard: Source telemetry is stale or unavailable.'
      });
      return { notification: null, deduped: false, suppressedReason: 'STALE_DATA' };
    }

    // 2. Candle Close Confirmation Guard
    if (params.requiresCandleClose && params.isCandleClosed === false) {
      return { notification: null, deduped: false, suppressedReason: 'INCOMPLETE_CANDLE' };
    }

    // 3. User Category Preference Check
    const catUpper = String(params.category).toUpperCase();
    if (
      (catUpper.includes('SIGNAL') && prefs.signalEnabled === false) ||
      (catUpper.includes('PRICE') && prefs.priceEnabled === false) ||
      (catUpper.includes('RSI') && prefs.rsiEnabled === false) ||
      (catUpper.includes('VOLUME') && prefs.volumeEnabled === false) ||
      (catUpper.includes('OI') && prefs.oiEnabled === false) ||
      (catUpper.includes('FUNDING') && prefs.fundingEnabled === false) ||
      (catUpper.includes('WHALE') && prefs.whaleEnabled === false) ||
      (catUpper.includes('ORDER_FLOW') && prefs.orderFlowEnabled === false) ||
      (catUpper.includes('LIQUIDATION') && prefs.liquidationEnabled === false) ||
      (catUpper.includes('BREAKOUT') && prefs.breakoutEnabled === false) ||
      (catUpper.includes('BREAKDOWN') && prefs.breakdownEnabled === false) ||
      (catUpper.includes('SYSTEM') && prefs.systemEnabled === false)
    ) {
      return { notification: null, deduped: false, suppressedReason: 'USER_CATEGORY_DISABLED' };
    }

    // 4. Entitlement Verification (Backend-authoritative)
    if (!this.canUseAlertType(user, params.category, params.symbol)) {
      this.logEvent({
        timestamp: now,
        event: 'ENTITLEMENT_BLOCKED',
        userId: params.userId,
        symbol: params.symbol,
        category: String(params.category),
        message: 'Free user attempted restricted alert/altcoin trigger.'
      });
      return { notification: null, deduped: false, suppressedReason: 'ENTITLEMENT_RESTRICTED' };
    }

    // 5. Deduplication & Idempotency Key
    const dedupeKey = params.dedupeKey || this.generateDedupeKey({
      userId: params.userId,
      category: String(params.category),
      symbol: params.symbol,
      exchange: params.exchange,
      timeframe: params.timeframe,
      type: params.type
    });

    if (this.isDuplicate(dedupeKey)) {
      this.logEvent({
        timestamp: now,
        event: 'NOTIFICATION_DEDUPED',
        userId: params.userId,
        symbol: params.symbol,
        category: String(params.category),
        message: `Deduplicated key: ${dedupeKey}`
      });
      return { notification: null, deduped: true, suppressedReason: 'DEDUPLICATED' };
    }

    // 6. Cooldown Verification per user + symbol + category
    const cooldownKey = `${params.userId}_${params.symbol || 'GEN'}_${params.category}`;
    const lastTrigger = this.alertCooldowns.get(cooldownKey);
    const cooldownMs = (prefs.cooldownMinutes || 15) * 60 * 1000;
    if (lastTrigger && now - lastTrigger < cooldownMs && params.severity !== 'CRITICAL') {
      return { notification: null, deduped: false, suppressedReason: 'COOLDOWN_ACTIVE' };
    }
    this.alertCooldowns.set(cooldownKey, now);

    // 7. Rate Limiter (Alert Storm Guard)
    if (this.rateLimiter.isUserRateLimited(params.userId) && params.severity !== 'CRITICAL') {
      this.logEvent({
        timestamp: now,
        event: 'PROVIDER_RATE_LIMIT',
        userId: params.userId,
        message: 'User alert limit per hour exceeded.'
      });
      return { notification: null, deduped: false, suppressedReason: 'RATE_LIMITED' };
    }

    // 8. Construct Normalized Notification Entity
    const id = `notif_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const deepLink = params.deepLink || this.buildDeepLink(params.symbol, params.exchange, params.timeframe, String(params.category));

    const notification: Notification = {
      id,
      userId: params.userId,
      type: params.type || String(params.category).toUpperCase().replace(/\s+/g, '_'),
      category: params.category,
      title: params.title,
      message: params.message,
      symbol: params.symbol,
      exchange: params.exchange,
      marketType: params.marketType || 'SPOT',
      timeframe: params.timeframe,
      direction: params.direction || 'NEUTRAL',
      severity: params.severity || 'MEDIUM',
      createdAt: now,
      expiresAt: now + (30 * 24 * 60 * 60 * 1000), // 30 day default retention
      source: params.source || 'Notification Reliability Engine',
      sourceId: params.sourceId,
      dedupeKey,
      status: 'QUEUED',
      metadata: params.metadata,
      read: false,
      deepLink,
      snapshot: params.snapshot ? {
        ...params.snapshot,
        timestamp: now
      } : undefined
    };

    // Store in Database
    db.addNotification(notification);

    this.logEvent({
      timestamp: now,
      event: 'NOTIFICATION_QUEUED',
      userId: params.userId,
      notificationId: id,
      symbol: params.symbol,
      exchange: params.exchange,
      category: String(params.category)
    });

    // 9. Dispatch to configured channels asynchronously
    this.dispatchNotification(notification, prefs, user);

    return { notification, deduped: false };
  }

  // ==========================================
  // DISPATCHING & RETRY PIPELINE
  // ==========================================
  private async dispatchNotification(
    notification: Notification,
    prefs: UserNotificationPreferences,
    user: User | null
  ): Promise<void> {
    const isQuiet = this.isWithinQuietHours(prefs);
    const isCritical = notification.severity === 'CRITICAL';

    // In-App channel is always dispatched immediately
    await this.deliverChannel(notification, 'IN_APP', 1);

    // External channels (Web Push, Telegram, Email)
    const externalChannels: NotificationChannel[] = [];
    if (prefs.browserPushEnabled || prefs.pushEnabled) externalChannels.push('WEB_PUSH');
    if (prefs.telegramEnabled) externalChannels.push('TELEGRAM');
    if (prefs.emailEnabled) externalChannels.push('EMAIL');

    for (const channel of externalChannels) {
      // Check entitlement
      if (!this.canUseNotificationChannel(user, channel)) {
        continue;
      }

      // Check quiet hours: if in quiet hours and not critical, defer delivery
      if (isQuiet && !isCritical) {
        this.deferredQueue.push({
          notification,
          channel,
          attemptNumber: 1,
          deliverAt: Date.now() + 60 * 60 * 1000 // Re-evaluate in 1 hour
        });
        continue;
      }

      // Dispatch to provider
      this.deliverChannel(notification, channel, 1);
    }
  }

  public async deliverChannel(
    notification: Notification,
    channel: NotificationChannel,
    attemptNumber: number
  ): Promise<DeliveryAttempt> {
    const provider = this.providers.get(channel);
    const breaker = this.circuitBreakers.get(channel);
    const now = Date.now();

    const attemptId = `att_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const attempt: DeliveryAttempt = {
      id: attemptId,
      notificationId: notification.id,
      userId: notification.userId,
      channel,
      provider: provider?.name || 'Unknown',
      attemptNumber,
      status: 'PENDING',
      queuedAt: now,
      startedAt: now
    };

    // If channel rate limited
    if (this.rateLimiter.isChannelRateLimited(channel)) {
      attempt.status = 'FAILED';
      attempt.errorCode = 'RATE_LIMIT';
      attempt.errorMessage = 'Channel level rate limit exceeded.';
      attempt.completedAt = Date.now();
      db.recordDeliveryAttempt(attempt);
      return attempt;
    }

    // If circuit breaker is OPEN, fail fast or retry later
    if (breaker && !breaker.canExecute()) {
      attempt.status = 'FAILED';
      attempt.errorCode = 'PROVIDER_UNAVAILABLE';
      attempt.errorMessage = `Circuit breaker is OPEN for channel ${channel}. Provider is pausing to recover.`;
      attempt.completedAt = Date.now();
      db.recordDeliveryAttempt(attempt);
      return attempt;
    }

    if (!provider || !provider.isConfigured()) {
      attempt.status = 'FAILED';
      attempt.errorCode = 'CONFIGURATION';
      attempt.errorMessage = `Provider for channel ${channel} is NOT_CONFIGURED.`;
      attempt.completedAt = Date.now();
      db.recordDeliveryAttempt(attempt);
      return attempt;
    }

    this.logEvent({
      timestamp: now,
      event: 'DELIVERY_STARTED',
      userId: notification.userId,
      notificationId: notification.id,
      channel,
      provider: provider.name
    });

    try {
      const result = await provider.send(notification, attempt);
      attempt.completedAt = Date.now();

      if (result.success) {
        attempt.status = 'SUCCESS';
        attempt.providerMessageId = result.providerMessageId;
        breaker?.recordSuccess();

        // Update notification status
        db.updateNotification(notification.userId, notification.id, {
          status: 'DELIVERED'
        });

        this.logEvent({
          timestamp: Date.now(),
          event: 'DELIVERY_SUCCESS',
          userId: notification.userId,
          notificationId: notification.id,
          channel
        });
      } else {
        const classification = (result.errorCode as DeliveryErrorClassification) || 'TRANSIENT';
        attempt.status = 'FAILED';
        attempt.errorCode = classification;
        attempt.errorMessage = result.errorMessage;
        breaker?.recordFailure(classification);

        this.logEvent({
          timestamp: Date.now(),
          event: 'DELIVERY_FAILED',
          userId: notification.userId,
          notificationId: notification.id,
          channel,
          errorCode: classification,
          message: result.errorMessage
        });

        // Retry transient errors with backoff up to 3 attempts
        if (result.shouldRetry && attemptNumber < 3) {
          const delay = calculateNextRetryDelay(attemptNumber);
          attempt.status = 'RETRYING';
          attempt.nextRetryAt = Date.now() + delay;

          this.deferredQueue.push({
            notification,
            channel,
            attemptNumber: attemptNumber + 1,
            deliverAt: Date.now() + delay
          });

          this.logEvent({
            timestamp: Date.now(),
            event: 'DELIVERY_RETRY',
            userId: notification.userId,
            notificationId: notification.id,
            channel,
            message: `Scheduled retry attempt #${attemptNumber + 1} in ${Math.round(delay / 1000)}s`
          });
        }
      }
    } catch (err: any) {
      attempt.completedAt = Date.now();
      const classification = classifyDeliveryError(err);
      attempt.status = 'FAILED';
      attempt.errorCode = classification;
      attempt.errorMessage = err.message || 'Unexpected provider error';
      breaker?.recordFailure(classification);

      if (classification === 'TRANSIENT' && attemptNumber < 3) {
        const delay = calculateNextRetryDelay(attemptNumber);
        attempt.status = 'RETRYING';
        attempt.nextRetryAt = Date.now() + delay;
        this.deferredQueue.push({
          notification,
          channel,
          attemptNumber: attemptNumber + 1,
          deliverAt: Date.now() + delay
        });
      }
    }

    db.recordDeliveryAttempt(attempt);
    return attempt;
  }

  // ==========================================
  // BACKGROUND QUEUE & RETRY WORKER
  // ==========================================
  private startBackgroundQueueWorker(): void {
    setInterval(() => {
      const now = Date.now();
      const pending = this.deferredQueue.filter(item => item.deliverAt <= now);
      this.deferredQueue = this.deferredQueue.filter(item => item.deliverAt > now);

      for (const item of pending) {
        this.deliverChannel(item.notification, item.channel, item.attemptNumber);
      }
    }, 5000);
  }

  // ==========================================
  // READ / UNREAD / QUERY MANAGEMENT
  // ==========================================
  public getUserNotifications(userId: string, filters?: {
    categoryGroup?: string;
    unreadOnly?: boolean;
    limit?: number;
  }): Notification[] {
    let list = db.getNotifications(userId);
    if (filters?.unreadOnly) {
      list = list.filter(n => !n.read);
    }
    if (filters?.categoryGroup && filters.categoryGroup !== 'all') {
      const g = filters.categoryGroup.toLowerCase();
      list = list.filter(n => {
        const cat = String(n.category).toLowerCase();
        if (g === 'signals') return cat.includes('signal') || cat.includes('breakout') || cat.includes('breakdown');
        if (g === 'whale') return cat.includes('whale') || cat.includes('deposit') || cat.includes('withdrawal');
        if (g === 'risk') return cat.includes('risk') || cat.includes('liquidation');
        if (g === 'system') return cat.includes('system') || cat.includes('security');
        return true;
      });
    }
    return list.slice(0, filters?.limit || 100);
  }

  public getUnreadCount(userId: string): number {
    const list = db.getNotifications(userId);
    return list.filter(n => !n.read).length;
  }

  public markRead(userId: string, notificationId: string, read: boolean = true): boolean {
    return db.markNotificationRead(userId, notificationId, read);
  }

  public markAllRead(userId: string): number {
    return db.markAllNotificationsRead(userId);
  }

  public deleteNotification(userId: string, notificationId: string): boolean {
    return db.deleteNotification(userId, notificationId);
  }

  // ==========================================
  // OBSERVABILITY & ADMIN MONITORING
  // ==========================================
  public async getNotificationHealth(): Promise<NotificationHealthSummary> {
    const attempts = db.deliveryAttempts;
    let delivered = 0;
    let failed = 0;
    let retrying = 0;
    let queued = this.deferredQueue.length;

    for (const a of attempts) {
      if (a.status === 'SUCCESS') delivered++;
      else if (a.status === 'FAILED') failed++;
      else if (a.status === 'RETRYING') retrying++;
    }

    const channels: Record<NotificationChannel, ChannelHealthMetric> = {
      IN_APP: await this.buildChannelMetric('IN_APP'),
      WEB_PUSH: await this.buildChannelMetric('WEB_PUSH'),
      TELEGRAM: await this.buildChannelMetric('TELEGRAM'),
      EMAIL: await this.buildChannelMetric('EMAIL')
    };

    const total = delivered + failed;
    const errorRate = total > 0 ? failed / total : 0;

    return {
      totalQueued: queued,
      processing: 0,
      delivered,
      failed,
      retrying,
      expired: 0,
      queueDepth: queued,
      errorRate: Number(errorRate.toFixed(4)),
      channels,
      lastEvaluatedAt: Date.now()
    };
  }

  private async buildChannelMetric(channel: NotificationChannel): Promise<ChannelHealthMetric> {
    const provider = this.providers.get(channel);
    const breaker = this.circuitBreakers.get(channel);
    const stats = breaker?.getStats();
    const health = provider ? await provider.healthCheck() : { status: 'NOT_CONFIGURED' as ProviderHealthState, message: 'Provider not loaded' };

    const channelAttempts = db.deliveryAttempts.filter(a => a.channel === channel);
    const deliveredCount = channelAttempts.filter(a => a.status === 'SUCCESS').length;
    const failedCount = channelAttempts.filter(a => a.status === 'FAILED').length;
    const retryingCount = channelAttempts.filter(a => a.status === 'RETRYING').length;

    const lastDelivered = channelAttempts.find(a => a.status === 'SUCCESS');
    const lastFailed = channelAttempts.find(a => a.status === 'FAILED');

    return {
      channel,
      provider: provider?.name || 'Unknown',
      status: stats?.state === 'CIRCUIT_OPEN' ? 'CIRCUIT_OPEN' : health.status,
      deliveredCount,
      failedCount,
      retryingCount,
      lastDeliveredAt: lastDelivered?.completedAt || null,
      lastFailureAt: lastFailed?.completedAt || null,
      lastError: lastFailed?.errorMessage || null,
      circuitBreakerOpen: stats?.state === 'CIRCUIT_OPEN',
      circuitResetAt: stats?.circuitResetAt || null
    };
  }

  public getFailedDeliveries(limit: number = 50): DeliveryAttempt[] {
    return db.getFailedDeliveryAttempts(limit);
  }

  public async retryDelivery(attemptId: string): Promise<{ success: boolean; message: string }> {
    const attempt = db.deliveryAttempts.find(a => a.id === attemptId);
    if (!attempt) {
      return { success: false, message: 'Delivery attempt not found.' };
    }
    const notif = db.getNotificationById(attempt.userId, attempt.notificationId);
    if (!notif) {
      return { success: false, message: 'Parent notification no longer exists.' };
    }

    // Safe, idempotent manual retry
    const res = await this.deliverChannel(notif, attempt.channel, attempt.attemptNumber + 1);
    return {
      success: res.status === 'SUCCESS',
      message: res.status === 'SUCCESS' ? 'Retried delivery successfully.' : (res.errorMessage || 'Retry failed.')
    };
  }
}

export const notificationService = new NotificationService();
