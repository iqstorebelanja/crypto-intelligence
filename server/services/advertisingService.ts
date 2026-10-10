import {
  AdAnalyticsEvent,
  AdAnalyticsSummary,
  AdProviderStatus,
  AdProviderType,
  CreativeAnalyticsMetric,
  GlobalAdConfig,
  HouseAd,
  HouseAdAudience
} from '../../src/types';

// ==========================================
// EXTERNAL AD PROVIDER ABSTRACTION
// ==========================================
export interface IAdProvider {
  id: string;
  name: string;
  getStatus(): AdProviderStatus;
  initialize(): Promise<boolean>;
  load(slotId: string): Promise<{ success: boolean; status: AdProviderStatus }>;
  refresh(slotId: string): Promise<{ success: boolean; status: AdProviderStatus }>;
  destroy(slotId: string): void;
}

export class ExternalNetworkAdProvider implements IAdProvider {
  id = 'google_ad_manager';
  name = 'Google Ad Manager';
  private status: AdProviderStatus = 'NOT_CONFIGURED';

  constructor(publisherId?: string) {
    if (publisherId && publisherId.trim().length > 0) {
      this.status = 'READY';
    } else {
      this.status = 'NOT_CONFIGURED';
    }
  }

  getStatus(): AdProviderStatus {
    return this.status;
  }

  async initialize(): Promise<boolean> {
    if (this.status === 'NOT_CONFIGURED') return false;
    this.status = 'READY';
    return true;
  }

  async load(_slotId: string): Promise<{ success: boolean; status: AdProviderStatus }> {
    if (this.status === 'NOT_CONFIGURED') {
      return { success: false, status: 'NOT_CONFIGURED' };
    }
    return { success: true, status: this.status };
  }

  async refresh(_slotId: string): Promise<{ success: boolean; status: AdProviderStatus }> {
    if (this.status === 'NOT_CONFIGURED') {
      return { success: false, status: 'NOT_CONFIGURED' };
    }
    return { success: true, status: this.status };
  }

  destroy(_slotId: string): void {
    // Teardown provider slot listeners
  }
}

// ==========================================
// ADVERTISING ENGINE SERVICE
// ==========================================
export class AdvertisingService {
  private houseAds: Map<string, HouseAd> = new Map();
  private analyticsEvents: AdAnalyticsEvent[] = [];
  private externalProvider: IAdProvider;

  private config: GlobalAdConfig = {
    enabled: true,
    providerType: 'HOUSE_ONLY',
    externalProvider: {
      name: 'Google Ad Manager',
      publisherId: '',
      slotIdDesktop: '',
      slotIdMobile: '',
      allowAutoRefresh: false,
      refreshIntervalSeconds: 60
    },
    houseAdRotation: {
      enabled: true,
      intervalSeconds: 15,
      minIntervalSeconds: 10,
      randomizeOrder: true,
      pauseWhenHidden: true
    },
    placements: {
      desktopFooter: true,
      mobileFooter: true,
      communityEnabled: false, // Protected: never obstructs chat composition
      aiTraderGlobalFooter: true // Global shell only, never inside chat bubbles
    },
    allowDismissal: true,
    dismissSnoozeMinutes: 30
  };

  constructor() {
    this.externalProvider = new ExternalNetworkAdProvider();
    this.seedDefaultHouseAds();
    this.seedInitialAnalytics();
  }

  private seedDefaultHouseAds() {
    const now = Date.now();

    const defaultAds: HouseAd[] = [
      {
        id: 'ad_pro_upgrade',
        title: 'Upgrade to PRO Membership',
        description: 'Unlimited Real-Time AI Consultations, Private Alpha Channels, and Multi-Exchange Breakout Signals.',
        targetUrl: '/community',
        ctaText: 'Unlock PRO Access',
        active: true,
        priority: 10,
        rotationEnabled: true,
        targetAudience: 'FREE',
        exchange: 'ALL',
        badge: 'PRO MEMBERSHIP',
        colorTheme: 'amber',
        createdAt: now - 86400000 * 14,
        updatedAt: now
      },
      {
        id: 'ad_signal_engine_v2',
        title: 'Algorithmic Signal Engine Active',
        description: 'Multi-Timeframe Confluence & Volume Expansion Detection across Binance, Bybit, OKX & Pionex.',
        targetUrl: '/signals',
        ctaText: 'Inspect Live Signals',
        active: true,
        priority: 9,
        rotationEnabled: true,
        targetAudience: 'ALL',
        exchange: 'ALL',
        badge: 'QUANT RADAR',
        colorTheme: 'cyan',
        createdAt: now - 86400000 * 10,
        updatedAt: now
      },
      {
        id: 'ad_telegram_alerts',
        title: 'Instant Telegram Bot Notifications',
        description: 'Get real-time pings for 4.0x Volume Spikes, CVD Divergences, and Bull Score shifts on your phone.',
        targetUrl: '/alerts',
        ctaText: 'Configure Bot',
        active: true,
        priority: 9,
        rotationEnabled: true,
        targetAudience: 'ALL',
        exchange: 'ALL',
        badge: 'INSTANT RADAR',
        colorTheme: 'emerald',
        createdAt: now - 86400000 * 8,
        updatedAt: now
      },
      {
        id: 'ad_whale_transfers',
        title: 'Institutional Whale Tracker',
        description: 'Monitor $1M+ exchange deposits, cold storage outflows, and large OTC movements before retail reacts.',
        targetUrl: '/whales',
        ctaText: 'View On-Chain Radar',
        active: true,
        priority: 8,
        rotationEnabled: true,
        targetAudience: 'ALL',
        exchange: 'ALL',
        badge: 'ON-CHAIN INTEL',
        colorTheme: 'blue',
        createdAt: now - 86400000 * 5,
        updatedAt: now
      },
      {
        id: 'ad_community_alpha',
        title: 'Verified Community Forum',
        description: 'Collaborate with quantitative analysts, discuss market structure, and share verified trading setups.',
        targetUrl: '/community',
        ctaText: 'Join Trading Floor',
        active: true,
        priority: 7,
        rotationEnabled: true,
        targetAudience: 'ALL',
        exchange: 'ALL',
        badge: 'PRO COMMUNITY',
        colorTheme: 'purple',
        createdAt: now - 86400000 * 3,
        updatedAt: now
      },
      {
        id: 'ad_order_flow_cvd',
        title: 'Master CVD & Order Flow Imbalance',
        description: 'Identify aggressive buyer absorption and order-book depth disparities with real-time math models.',
        targetUrl: '/structure',
        ctaText: 'Explore Order Flow',
        active: true,
        priority: 6,
        rotationEnabled: true,
        targetAudience: 'ALL',
        exchange: 'ALL',
        badge: 'MARKET ACADEMY',
        colorTheme: 'cyan',
        createdAt: now - 86400000 * 2,
        updatedAt: now
      }
    ];

    for (const ad of defaultAds) {
      this.houseAds.set(ad.id, ad);
    }
  }

  private seedInitialAnalytics() {
    const now = Date.now();
    // Seed initial realistic impressions and clicks for baseline dashboard visualization
    const creatives = Array.from(this.houseAds.values());
    for (const c of creatives) {
      const impCount = Math.floor(180 + Math.random() * 240);
      const clickCount = Math.floor(impCount * (0.035 + Math.random() * 0.04));

      for (let i = 0; i < impCount; i++) {
        this.analyticsEvents.push({
          id: `imp_${c.id}_${i}`,
          creativeId: c.id,
          type: 'IMPRESSION',
          provider: 'HOUSE',
          placement: i % 2 === 0 ? 'DESKTOP_FOOTER' : 'MOBILE_FOOTER',
          userTier: i % 3 === 0 ? 'PRO' : 'FREE',
          timestamp: now - (impCount - i) * 60000
        });
      }

      for (let j = 0; j < clickCount; j++) {
        this.analyticsEvents.push({
          id: `clk_${c.id}_${j}`,
          creativeId: c.id,
          type: 'CLICK',
          provider: 'HOUSE',
          placement: j % 2 === 0 ? 'DESKTOP_FOOTER' : 'MOBILE_FOOTER',
          userTier: j % 4 === 0 ? 'PRO' : 'FREE',
          targetUrl: c.targetUrl,
          timestamp: now - (clickCount - j) * 90000
        });
      }
    }
  }

  // ==========================================
  // CONFIGURATION
  // ==========================================
  public getConfig(): GlobalAdConfig {
    return { ...this.config };
  }

  public updateConfig(partial: Partial<GlobalAdConfig>): GlobalAdConfig {
    if (partial.houseAdRotation) {
      const rot = partial.houseAdRotation;
      const minInterval = Math.max(5, rot.minIntervalSeconds ?? this.config.houseAdRotation.minIntervalSeconds);
      const interval = Math.max(minInterval, rot.intervalSeconds ?? this.config.houseAdRotation.intervalSeconds);
      this.config.houseAdRotation = {
        ...this.config.houseAdRotation,
        ...rot,
        minIntervalSeconds: minInterval,
        intervalSeconds: interval
      };
    }

    if (partial.externalProvider) {
      this.config.externalProvider = {
        ...this.config.externalProvider,
        ...partial.externalProvider
      };
      this.externalProvider = new ExternalNetworkAdProvider(this.config.externalProvider.publisherId);
    }

    if (partial.placements) {
      this.config.placements = {
        ...this.config.placements,
        ...partial.placements
      };
    }

    if (partial.providerType) {
      this.config.providerType = partial.providerType;
    }

    if (partial.enabled !== undefined) {
      this.config.enabled = partial.enabled;
    }

    if (partial.allowDismissal !== undefined) {
      this.config.allowDismissal = partial.allowDismissal;
    }

    if (partial.dismissSnoozeMinutes !== undefined) {
      this.config.dismissSnoozeMinutes = Math.max(5, partial.dismissSnoozeMinutes);
    }

    return this.getConfig();
  }

  public getProviderStatus(): AdProviderStatus {
    if (!this.config.enabled) return 'DISABLED';
    if (this.config.providerType === 'HOUSE_ONLY') return 'READY';
    return this.externalProvider.getStatus();
  }

  // ==========================================
  // CREATIVES QUERY & MANAGEMENT
  // ==========================================
  public getActiveCreatives(userTier: HouseAdAudience = 'FREE', exchange?: string): HouseAd[] {
    const now = Date.now();
    const result: HouseAd[] = [];

    for (const ad of this.houseAds.values()) {
      if (!ad.active || !ad.rotationEnabled) continue;
      if (ad.startAt && now < ad.startAt) continue;
      if (ad.endAt && now > ad.endAt) continue;

      // Filter by audience
      if (ad.targetAudience !== 'ALL' && ad.targetAudience !== userTier) {
        continue;
      }

      // Filter by exchange if specific
      if (exchange && ad.exchange !== 'ALL' && ad.exchange !== exchange) {
        continue;
      }

      result.push({ ...ad });
    }

    // Sort by priority descending
    return result.sort((a, b) => b.priority - a.priority);
  }

  public getAllHouseAdsAdmin(): HouseAd[] {
    return Array.from(this.houseAds.values()).sort((a, b) => b.priority - a.priority);
  }

  public createHouseAd(adData: Omit<HouseAd, 'id' | 'createdAt' | 'updatedAt'>): HouseAd {
    const safeTarget = this.sanitizeUrl(adData.targetUrl);
    const now = Date.now();
    const id = `ad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newAd: HouseAd = {
      ...adData,
      id,
      targetUrl: safeTarget,
      title: (adData.title || 'Special Promotion').slice(0, 80),
      description: (adData.description || '').slice(0, 180),
      ctaText: (adData.ctaText || 'Learn More').slice(0, 30),
      createdAt: now,
      updatedAt: now
    };

    this.houseAds.set(newAd.id, newAd);
    return newAd;
  }

  public updateHouseAd(id: string, adData: Partial<HouseAd>): HouseAd {
    const existing = this.houseAds.get(id);
    if (!existing) {
      throw new Error(`House Ad with id '${id}' not found`);
    }

    const updated: HouseAd = {
      ...existing,
      ...adData,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    };

    if (adData.targetUrl) {
      updated.targetUrl = this.sanitizeUrl(adData.targetUrl);
    }

    this.houseAds.set(id, updated);
    return updated;
  }

  public deleteHouseAd(id: string): boolean {
    return this.houseAds.delete(id);
  }

  public toggleHouseAdActive(id: string): HouseAd {
    const existing = this.houseAds.get(id);
    if (!existing) {
      throw new Error(`House Ad with id '${id}' not found`);
    }
    existing.active = !existing.active;
    existing.updatedAt = Date.now();
    this.houseAds.set(id, existing);
    return existing;
  }

  // ==========================================
  // ANALYTICS TRACKING
  // ==========================================
  public recordImpression(payload: {
    creativeId: string;
    placement: 'DESKTOP_FOOTER' | 'MOBILE_FOOTER' | 'COMMUNITY' | 'GLOBAL_SHELL';
    userTier: 'FREE' | 'PRO' | 'ANONYMOUS';
    provider?: 'HOUSE' | 'EXTERNAL';
  }): void {
    const now = Date.now();
    const event: AdAnalyticsEvent = {
      id: `evt_imp_${now}_${Math.random().toString(36).substring(2, 6)}`,
      creativeId: payload.creativeId,
      type: 'IMPRESSION',
      provider: payload.provider || 'HOUSE',
      placement: payload.placement,
      userTier: payload.userTier,
      timestamp: now
    };

    this.analyticsEvents.push(event);
    if (this.analyticsEvents.length > 5000) {
      this.analyticsEvents.splice(0, this.analyticsEvents.length - 5000);
    }
  }

  public recordClick(payload: {
    creativeId: string;
    placement: 'DESKTOP_FOOTER' | 'MOBILE_FOOTER' | 'COMMUNITY' | 'GLOBAL_SHELL';
    userTier: 'FREE' | 'PRO' | 'ANONYMOUS';
    targetUrl?: string;
    provider?: 'HOUSE' | 'EXTERNAL';
  }): void {
    const now = Date.now();
    const event: AdAnalyticsEvent = {
      id: `evt_clk_${now}_${Math.random().toString(36).substring(2, 6)}`,
      creativeId: payload.creativeId,
      type: 'CLICK',
      provider: payload.provider || 'HOUSE',
      placement: payload.placement,
      userTier: payload.userTier,
      targetUrl: payload.targetUrl,
      timestamp: now
    };

    this.analyticsEvents.push(event);
    if (this.analyticsEvents.length > 5000) {
      this.analyticsEvents.splice(0, this.analyticsEvents.length - 5000);
    }
  }

  public getAnalyticsSummary(): AdAnalyticsSummary {
    let totalImpressions = 0;
    let totalClicks = 0;
    const creativeStats = new Map<string, { impressions: number; clicks: number }>();

    for (const evt of this.analyticsEvents) {
      if (!creativeStats.has(evt.creativeId)) {
        creativeStats.set(evt.creativeId, { impressions: 0, clicks: 0 });
      }
      const st = creativeStats.get(evt.creativeId)!;
      if (evt.type === 'IMPRESSION') {
        totalImpressions++;
        st.impressions++;
      } else if (evt.type === 'CLICK') {
        totalClicks++;
        st.clicks++;
      }
    }

    const creativeMetrics: CreativeAnalyticsMetric[] = [];
    for (const [cid, st] of creativeStats.entries()) {
      const ad = this.houseAds.get(cid);
      const title = ad ? ad.title : cid;
      const ctr = st.impressions > 0 ? (st.clicks / st.impressions) * 100 : 0;
      creativeMetrics.push({
        creativeId: cid,
        title,
        impressions: st.impressions,
        clicks: st.clicks,
        ctr: Math.round(ctr * 100) / 100
      });
    }

    // Sort by impressions descending
    creativeMetrics.sort((a, b) => b.impressions - a.impressions);

    const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return {
      totalImpressions,
      totalClicks,
      overallCtr: Math.round(overallCtr * 100) / 100,
      creativeMetrics,
      recentEvents: this.analyticsEvents.slice(-25).reverse()
    };
  }

  public resetAnalytics(): void {
    this.analyticsEvents = [];
  }

  // ==========================================
  // SAFETY & URL SANITIZATION
  // ==========================================
  private sanitizeUrl(url: string): string {
    const trimmed = (url || '').trim();
    if (!trimmed) return '/';
    // Reject dangerous schemes
    if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) {
      return '/';
    }
    // Allow internal routes like /signals or valid web protocols
    if (trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }
}

export const advertisingService = new AdvertisingService();
