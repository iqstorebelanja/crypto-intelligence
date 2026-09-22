import { NextFunction, Request, Response } from 'express';
import { db } from '../db/schema';

interface RateLimitRecord {
  timestamps: number[];
}

export class RateLimiterService {
  private windows: Map<string, RateLimitRecord> = new Map();

  // Clean stale records every 5 minutes
  constructor() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.windows.entries()) {
        record.timestamps = record.timestamps.filter(t => now - t < 120000);
        if (record.timestamps.length === 0) {
          this.windows.delete(key);
        }
      }
    }, 300000);
  }

  public checkLimit(
    category: 'AUTH' | 'AI' | 'SCANNER' | 'COIN_DETAIL' | 'ALERT' | 'ADMIN',
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; retryAfterSec: number } {
    const key = `${category}:${identifier}`;
    const now = Date.now();
    let record = this.windows.get(key);

    if (!record) {
      record = { timestamps: [] };
      this.windows.set(key, record);
    }

    // Keep only timestamps within window
    record.timestamps = record.timestamps.filter(t => now - t < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: maxRequests - record.timestamps.length,
      retryAfterSec: 0
    };
  }

  public createMiddleware(
    category: 'AUTH' | 'AI' | 'SCANNER' | 'COIN_DETAIL' | 'ALERT' | 'ADMIN',
    maxRequests: number,
    windowMs: number = 60000
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Identifier: prioritize auth token / user ID, fallback to client IP
      const authHeader = req.headers.authorization;
      let identifier = req.ip || req.socket.remoteAddress || 'anonymous';
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const sess = db.getSession(token);
        if (sess) {
          identifier = sess.userId;
        } else {
          identifier = token.slice(0, 16);
        }
      }

      const result = this.checkLimit(category, identifier, maxRequests, windowMs);

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfterSec.toString());
        db.addSystemLog(
          'WARNING',
          category === 'AI' ? 'AI' : category === 'AUTH' ? 'AUTH' : 'SYSTEM',
          `Rate limit exceeded for category ${category} (identifier: ${identifier.slice(0, 12)}).`,
          req.originalUrl,
          { retryAfterSec: result.retryAfterSec }
        );

        return res.status(429).json({
          error: 'Rate limit exceeded. Please slow down and try again.',
          category,
          retryAfterSec: result.retryAfterSec
        });
      }

      next();
    };
  }
}

export const rateLimiter = new RateLimiterService();

// Pre-configured middlewares
export const authRateLimit = rateLimiter.createMiddleware('AUTH', 15, 60000); // 15 req/min
export const aiRateLimit = rateLimiter.createMiddleware('AI', 20, 60000); // 20 req/min (anti-burst)
export const scannerRateLimit = rateLimiter.createMiddleware('SCANNER', 45, 60000); // 45 req/min
export const coinDetailRateLimit = rateLimiter.createMiddleware('COIN_DETAIL', 60, 60000); // 60 req/min
export const alertRateLimit = rateLimiter.createMiddleware('ALERT', 30, 60000); // 30 req/min
export const adminRateLimit = rateLimiter.createMiddleware('ADMIN', 60, 60000); // 60 req/min
