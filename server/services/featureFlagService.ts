import {
  LaunchMode,
  FeatureFlagKey,
  KillSwitchKey,
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus
} from '../../src/types';
import { db } from '../db/schema';

export class FeatureFlagService {
  private launchMode: LaunchMode = (process.env.LAUNCH_MODE as LaunchMode) || 'SOFT_LAUNCH';

  // Server-authoritative feature flags
  private featureFlags: Map<FeatureFlagKey, boolean> = new Map([
    ['SIGNALS_ENABLED', true],
    ['WHALE_ENABLED', true],
    ['DEX_INTELLIGENCE_ENABLED', true],
    ['AI_TRADER_ENABLED', true],
    ['COMMUNITY_ENABLED', true],
    ['ALERTS_ENABLED', true],
    ['PAYMENTS_ENABLED', true],
    ['TRIAL_ENABLED', true],
    ['NEW_USER_REGISTRATION_ENABLED', true]
  ]);

  // Emergency kill switches (all false by default)
  private killSwitches: Map<KillSwitchKey, boolean> = new Map([
    ['AI_TRADER', false],
    ['ALERT_ENGINE', false],
    ['NOTIFICATIONS', false],
    ['WHALE_PROVIDER', false],
    ['DEX_PROVIDER', false],
    ['PAYMENT_CHECKOUT', false],
    ['COMMUNITY_POSTING', false],
    ['MAINTENANCE_MODE', false]
  ]);

  // Soft Launch Configurable Guardrails
  private softLaunchLimits = {
    maxRegistrations: 1000,
    aiDailyUsageLimit: 100,
    alertsPerUserLimit: 25,
    scannerRequestRatePerMin: 120,
    communityPostingRatePerMin: 10,
    notificationRatePerMin: 60
  };

  // Cost Monitoring Parameters
  private costMonitoring = {
    estimatedAiCostPer1kTokens: 0.00015,
    aiDailyCostWarningThresholdUsd: 15.0,
    aiMonthlyCostWarningThresholdUsd: 250.0,
    totalAiTokensUsedToday: 0,
    totalAiTokensUsedThisMonth: 0,
    externalApiRequestsToday: 0,
    notificationsDeliveredToday: 0
  };

  // Incidents Repository
  private incidents: IncidentRecord[] = [];

  constructor() {
    // Seed baseline operational incident history if none
    this.incidents.push({
      id: 'inc_soft_launch_baseline',
      title: 'Soft Launch Baseline System Initialization',
      severity: 'SEV-4',
      affectedComponent: 'CORE_PLATFORM',
      status: 'RESOLVED',
      createdAt: Date.now() - 86400000,
      resolvedAt: Date.now() - 86400000 + 120000,
      createdBy: 'system_orchestrator',
      resolvedBy: 'system_orchestrator',
      resolutionSummary: 'All quantitative subsystems and external adapters confirmed operational.'
    });
  }

  // ----------------------------------------------------
  // LAUNCH MODE & FEATURE FLAGS
  // ----------------------------------------------------

  public getLaunchMode(): LaunchMode {
    return this.launchMode;
  }

  public setLaunchMode(mode: LaunchMode, actor: string = 'admin'): void {
    const prev = this.launchMode;
    this.launchMode = mode;
    db.addAdminAuditLog(actor, 'UPDATE_LAUNCH_MODE', 'SYSTEM', { previous: prev, new: mode });
  }

  public isFeatureEnabled(flag: FeatureFlagKey): boolean {
    return this.featureFlags.get(flag) ?? true;
  }

  public setFeatureFlag(flag: FeatureFlagKey, enabled: boolean, actor: string = 'admin'): void {
    const prev = this.featureFlags.get(flag);
    this.featureFlags.set(flag, enabled);
    db.addAdminAuditLog(actor, 'UPDATE_FEATURE_FLAG', flag, { previous: prev, new: enabled });
  }

  public getAllFeatureFlags(): Record<FeatureFlagKey, boolean> {
    const obj: any = {};
    for (const [k, v] of this.featureFlags.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  // ----------------------------------------------------
  // KILL SWITCHES
  // ----------------------------------------------------

  public isKillSwitchActive(component: KillSwitchKey): boolean {
    return this.killSwitches.get(component) ?? false;
  }

  public setKillSwitch(
    component: KillSwitchKey,
    active: boolean,
    actor: string = 'admin',
    reason?: string
  ): void {
    const prev = this.killSwitches.get(component);
    this.killSwitches.set(component, active);
    db.addAdminAuditLog(actor, 'TRIGGER_KILL_SWITCH', component, {
      previous: prev,
      active,
      reason: reason || 'Manual admin intervention'
    });
  }

  public getAllKillSwitches(): Record<KillSwitchKey, boolean> {
    const obj: any = {};
    for (const [k, v] of this.killSwitches.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  public isMaintenanceModeActive(): boolean {
    return this.killSwitches.get('MAINTENANCE_MODE') === true;
  }

  public isRegistrationEnabled(): boolean {
    return this.featureFlags.get('NEW_USER_REGISTRATION_ENABLED') === true;
  }

  // ----------------------------------------------------
  // SOFT LAUNCH LIMITS & COST TRACKING
  // ----------------------------------------------------

  public getSoftLaunchLimits() {
    return { ...this.softLaunchLimits };
  }

  public updateSoftLaunchLimits(limits: Partial<typeof this.softLaunchLimits>, actor: string = 'admin') {
    this.softLaunchLimits = { ...this.softLaunchLimits, ...limits };
    db.addAdminAuditLog(actor, 'UPDATE_SOFT_LAUNCH_LIMITS', 'CONFIG', limits);
    return this.softLaunchLimits;
  }

  public recordAiUsage(estimatedTokens: number): {
    tokensToday: number;
    estimatedCostTodayUsd: number;
    dailyWarning: boolean;
  } {
    this.costMonitoring.totalAiTokensUsedToday += estimatedTokens;
    this.costMonitoring.totalAiTokensUsedThisMonth += estimatedTokens;

    const estimatedCostTodayUsd =
      (this.costMonitoring.totalAiTokensUsedToday / 1000) * this.costMonitoring.estimatedAiCostPer1kTokens;
    const dailyWarning = estimatedCostTodayUsd >= this.costMonitoring.aiDailyCostWarningThresholdUsd;

    return {
      tokensToday: this.costMonitoring.totalAiTokensUsedToday,
      estimatedCostTodayUsd: Number(estimatedCostTodayUsd.toFixed(4)),
      dailyWarning
    };
  }

  public getCostMonitoringSummary() {
    const costTodayUsd =
      (this.costMonitoring.totalAiTokensUsedToday / 1000) * this.costMonitoring.estimatedAiCostPer1kTokens;
    const costMonthUsd =
      (this.costMonitoring.totalAiTokensUsedThisMonth / 1000) * this.costMonitoring.estimatedAiCostPer1kTokens;

    return {
      launchMode: this.launchMode,
      aiCostTodayUsd: Number(costTodayUsd.toFixed(4)),
      aiCostThisMonthUsd: Number(costMonthUsd.toFixed(4)),
      dailyWarningThresholdUsd: this.costMonitoring.aiDailyCostWarningThresholdUsd,
      monthlyWarningThresholdUsd: this.costMonitoring.aiMonthlyCostWarningThresholdUsd,
      isDailyWarningActive: costTodayUsd >= this.costMonitoring.aiDailyCostWarningThresholdUsd,
      isMonthlyWarningActive: costMonthUsd >= this.costMonitoring.aiMonthlyCostWarningThresholdUsd,
      totalTokensToday: this.costMonitoring.totalAiTokensUsedToday,
      totalTokensMonth: this.costMonitoring.totalAiTokensUsedThisMonth
    };
  }

  // ----------------------------------------------------
  // INCIDENT MANAGEMENT
  // ----------------------------------------------------

  public recordIncident(params: {
    title: string;
    severity: IncidentSeverity;
    affectedComponent: string;
    actor: string;
  }): IncidentRecord {
    const incident: IncidentRecord = {
      id: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: params.title,
      severity: params.severity,
      affectedComponent: params.affectedComponent,
      status: 'OPEN',
      createdAt: Date.now(),
      resolvedAt: null,
      createdBy: params.actor,
      resolvedBy: null,
      resolutionSummary: null
    };

    this.incidents.unshift(incident);
    db.addAdminAuditLog(params.actor, 'CREATE_INCIDENT', incident.id, {
      title: incident.title,
      severity: incident.severity,
      affectedComponent: incident.affectedComponent
    });

    return incident;
  }

  public resolveIncident(
    incidentId: string,
    resolutionSummary: string,
    actor: string = 'admin'
  ): IncidentRecord | null {
    const inc = this.incidents.find(i => i.id === incidentId);
    if (!inc) return null;

    inc.status = 'RESOLVED';
    inc.resolvedAt = Date.now();
    inc.resolvedBy = actor;
    inc.resolutionSummary = resolutionSummary;

    db.addAdminAuditLog(actor, 'RESOLVE_INCIDENT', incidentId, {
      resolvedAt: inc.resolvedAt,
      resolutionSummary
    });

    return inc;
  }

  public getIncidents(limit: number = 20): IncidentRecord[] {
    return this.incidents.slice(0, limit);
  }
}

export const featureFlagService = new FeatureFlagService();
