import { db } from '../db/schema';

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SESSION_REVOKED'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_CHANGED'
  | 'ACCOUNT_DELETED'
  | 'UNAUTHORIZED_ACCESS'
  | 'RATE_LIMITED'
  | 'ADMIN_ACCESS'
  | 'ENTITLEMENT_DENIED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'USER_PLAN_CHANGED'
  | 'ADMIN_PRO_GRANTED'
  | 'ADMIN_PRO_REVOKED'
  | 'CONFIG_CHANGED'
  | 'ALERT_CONFIG_CHANGED'
  | 'EXCHANGE_CONFIG_CHANGED'
  | 'PROVIDER_CONFIG_CHANGED'
  | 'USER_SUSPENDED'
  | 'USER_UNSUSPENDED';

export interface SecurityEventRecord {
  id: string;
  type: SecurityEventType;
  actor: string; // userId or IP or 'anonymous'
  target?: string;
  timestamp: number;
  ip?: string;
  action: string;
  result: 'SUCCESS' | 'DENIED' | 'FAILED' | 'FLAGGED';
  metadata?: Record<string, any>;
}

export class SecurityAuditService {
  private events: SecurityEventRecord[] = [];
  private readonly maxEvents = 1000;

  // Suspicious activity tracking
  private failedLoginTracker: Map<string, { count: number; windowStart: number; lockedUntil?: number }> = new Map();
  private suspiciousActors: Map<string, { flag: 'FLAGGED' | 'RATE_LIMITED' | 'TEMPORARILY_RESTRICTED'; reason: string; timestamp: number }> = new Map();

  /**
   * Sanitizes object to prevent accidental logging of sensitive credentials
   */
  public redactSecrets(input: any): any {
    if (!input || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map(item => this.redactSecrets(item));

    const redacted: Record<string, any> = {};
    for (const [key, val] of Object.entries(input)) {
      if (/password|token|secret|key|authorization|bearer|botToken|apiKey|private/i.test(key)) {
        redacted[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        redacted[key] = this.redactSecrets(val);
      } else {
        redacted[key] = val;
      }
    }
    return redacted;
  }

  /**
   * Logs a structured security audit event
   */
  public log(event: Omit<SecurityEventRecord, 'id' | 'timestamp'>): SecurityEventRecord {
    const record: SecurityEventRecord = {
      ...event,
      id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      metadata: event.metadata ? this.redactSecrets(event.metadata) : undefined
    };

    this.events.unshift(record);
    if (this.events.length > this.maxEvents) {
      this.events.length = this.maxEvents;
    }

    // Mirror to system logs for unified observability
    db.addSystemLog(
      event.result === 'FAILED' || event.result === 'DENIED' ? 'WARNING' : 'INFO',
      'AUTH',
      `[SECURITY] ${event.type}: ${event.action} (${event.actor}) - ${event.result}`,
      event.target || '/api',
      record.metadata
    );

    return record;
  }

  /**
   * Track failed login attempts for brute force mitigation
   */
  public recordFailedLogin(identifier: string, ip?: string): { locked: boolean; remainingAttempts: number; lockedUntil?: number } {
    const now = Date.now();
    const key = `${identifier.toLowerCase()}:${ip || 'unknown'}`;
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const maxAttempts = 5;

    let tracker = this.failedLoginTracker.get(key);
    if (!tracker || now - tracker.windowStart > windowMs) {
      tracker = { count: 1, windowStart: now };
    } else {
      tracker.count++;
    }

    if (tracker.count >= maxAttempts) {
      tracker.lockedUntil = now + (15 * 60 * 1000); // 15-minute temporary lockout
      this.failedLoginTracker.set(key, tracker);

      this.log({
        type: 'SUSPICIOUS_ACTIVITY',
        actor: identifier,
        ip,
        action: 'BRUTE_FORCE_THRESHOLD_REACHED',
        result: 'FLAGGED',
        metadata: { attempts: tracker.count, lockedDurationMin: 15 }
      });

      return { locked: true, remainingAttempts: 0, lockedUntil: tracker.lockedUntil };
    }

    this.failedLoginTracker.set(key, tracker);
    return {
      locked: false,
      remainingAttempts: maxAttempts - tracker.count
    };
  }

  public isLoginLocked(identifier: string, ip?: string): { locked: boolean; lockedUntil?: number } {
    const key = `${identifier.toLowerCase()}:${ip || 'unknown'}`;
    const tracker = this.failedLoginTracker.get(key);
    if (!tracker || !tracker.lockedUntil) return { locked: false };

    if (Date.now() < tracker.lockedUntil) {
      return { locked: true, lockedUntil: tracker.lockedUntil };
    }

    // Lockout expired
    tracker.lockedUntil = undefined;
    tracker.count = 0;
    this.failedLoginTracker.set(key, tracker);
    return { locked: false };
  }

  public clearFailedLogins(identifier: string, ip?: string): void {
    const key = `${identifier.toLowerCase()}:${ip || 'unknown'}`;
    this.failedLoginTracker.delete(key);
  }

  public getEvents(limit: number = 100, type?: SecurityEventType): SecurityEventRecord[] {
    let result = this.events;
    if (type) {
      result = result.filter(e => e.type === type);
    }
    return result.slice(0, limit);
  }
}

export const securityAuditService = new SecurityAuditService();
