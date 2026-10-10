import {
  DeliveryErrorClassification,
  NotificationChannel,
  ProviderHealthState
} from '../../src/types';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Consecutive failures before opening circuit
  resetTimeoutMs?: number; // How long to remain open before trying half-open
  sampleWindowMs?: number; // Rolling window for calculating error rate
}

export class CircuitBreaker {
  private state: ProviderHealthState = 'HEALTHY';
  private consecutiveFailures: number = 0;
  private totalAttempts: number = 0;
  private totalFailures: number = 0;
  private lastFailureTime: number = 0;
  private lastSuccessTime: number = 0;
  private nextAttemptAllowedAt: number = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly sampleWindowMs: number;

  constructor(
    public readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000; // 30s
    this.sampleWindowMs = options.sampleWindowMs || 60000; // 60s
  }

  public getState(): ProviderHealthState {
    const now = Date.now();
    if (this.state === 'CIRCUIT_OPEN') {
      if (now >= this.nextAttemptAllowedAt) {
        this.state = 'HALF_OPEN';
      }
    }
    return this.state;
  }

  public canExecute(): boolean {
    const currentState = this.getState();
    return currentState === 'HEALTHY' || currentState === 'HALF_OPEN';
  }

  public recordSuccess(): void {
    this.totalAttempts++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();
    this.state = 'HEALTHY';
  }

  public recordFailure(classification: DeliveryErrorClassification): void {
    this.totalAttempts++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    // Permanent or configuration errors don't trigger circuit breaker trips as they are caller errors,
    // but transient and provider unavailable errors do
    if (classification === 'TRANSIENT' || classification === 'PROVIDER_UNAVAILABLE' || classification === 'RATE_LIMIT') {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.state = 'CIRCUIT_OPEN';
        this.nextAttemptAllowedAt = Date.now() + this.resetTimeoutMs;
      }
    }
  }

  public getStats() {
    return {
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      totalAttempts: this.totalAttempts,
      totalFailures: this.totalFailures,
      errorRate: this.totalAttempts > 0 ? (this.totalFailures / this.totalAttempts) : 0,
      lastSuccessTime: this.lastSuccessTime || null,
      lastFailureTime: this.lastFailureTime || null,
      circuitResetAt: this.state === 'CIRCUIT_OPEN' ? this.nextAttemptAllowedAt : null
    };
  }

  public reset(): void {
    this.state = 'HEALTHY';
    this.consecutiveFailures = 0;
    this.nextAttemptAllowedAt = 0;
  }
}

/**
 * Exponential backoff with jitter calculator for retries
 */
export function calculateNextRetryDelay(attemptNumber: number, baseDelayMs: number = 2000, maxDelayMs: number = 60000): number {
  // Exponential delay: 2s, 4s, 8s, 16s...
  const exponential = baseDelayMs * Math.pow(2, attemptNumber - 1);
  const bounded = Math.min(exponential, maxDelayMs);
  // Full jitter: uniformly distributed between 0 and bounded
  const jitter = Math.floor(Math.random() * (bounded * 0.3));
  return bounded + jitter;
}

/**
 * Classification helper for delivery errors
 */
export function classifyDeliveryError(err: any): DeliveryErrorClassification {
  const msg = (err?.message || String(err)).toLowerCase();
  const status = err?.status || err?.statusCode || 0;

  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'RATE_LIMIT';
  }
  if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('token invalid')) {
    return 'AUTHENTICATION';
  }
  if (msg.includes('not configured') || msg.includes('missing key') || msg.includes('configuration')) {
    return 'CONFIGURATION';
  }
  if (status === 404 || status === 410 || msg.includes('expired') || msg.includes('subscription revoked') || msg.includes('invalid destination')) {
    return 'PERMANENT';
  }
  if (status >= 500 || msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('network') || msg.includes('abort')) {
    return 'PROVIDER_UNAVAILABLE';
  }

  return 'TRANSIENT';
}

/**
 * Alert storm rate limiter
 */
export class AlertRateLimiter {
  private userCounters: Map<string, { count: number; windowStart: number }> = new Map();
  private symbolCounters: Map<string, { count: number; windowStart: number }> = new Map();
  private channelCounters: Map<string, { count: number; windowStart: number }> = new Map();

  constructor(
    private maxPerUserPerHour: number = 50,
    private maxPerSymbolPerHour: number = 20,
    private maxPerChannelPerMin: number = 120
  ) {}

  public isUserRateLimited(userId: string): boolean {
    const now = Date.now();
    const entry = this.userCounters.get(userId);
    if (!entry || now - entry.windowStart > 3600000) {
      this.userCounters.set(userId, { count: 1, windowStart: now });
      return false;
    }
    if (entry.count >= this.maxPerUserPerHour) {
      return true;
    }
    entry.count++;
    return false;
  }

  public isSymbolRateLimited(symbol: string): boolean {
    const now = Date.now();
    const clean = symbol.toUpperCase().replace(/[\/\-_]/g, '');
    const entry = this.symbolCounters.get(clean);
    if (!entry || now - entry.windowStart > 3600000) {
      this.symbolCounters.set(clean, { count: 1, windowStart: now });
      return false;
    }
    if (entry.count >= this.maxPerSymbolPerHour) {
      return true;
    }
    entry.count++;
    return false;
  }

  public isChannelRateLimited(channel: NotificationChannel): boolean {
    const now = Date.now();
    const entry = this.channelCounters.get(channel);
    if (!entry || now - entry.windowStart > 60000) {
      this.channelCounters.set(channel, { count: 1, windowStart: now });
      return false;
    }
    if (entry.count >= this.maxPerChannelPerMin) {
      return true;
    }
    entry.count++;
    return false;
  }
}
