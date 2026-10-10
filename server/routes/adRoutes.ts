import { Router, Request, Response } from 'express';
import { rewardedAdService } from '../services/rewardedAdService';
import { aiQuotaService } from '../services/aiQuotaService';
import { db } from '../db/schema';
import { User } from '../../src/types';

export const adRouter = Router();

// Helper to authenticate user from Bearer token
export const getAuthUser = (req: Request): User | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  const session = db.getSession(token);
  if (!session) return null;
  return db.users.get(session.userId) || null;
};

// 1. Get user AI quota and ad status
adRouter.get('/quota', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const quota = aiQuotaService.getQuota(user);
  res.json({
    quota,
    adConfig: {
      adDurationSeconds: rewardedAdService.getConfig().adDurationSeconds,
      testMode: rewardedAdService.getConfig().testMode,
      adAvailability: rewardedAdService.getConfig().adAvailability
    }
  });
});

// 2. Create rewarded ad session for Free user
adRouter.post('/session/create', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required to initialize rewarded ad session.' });
  }

  const result = await rewardedAdService.createSession(user);
  if (!result.success) {
    return res.status(400).json({ error: result.error, code: result.code });
  }

  res.json({
    success: true,
    session: result.session,
    creative: result.creative
  });
});

// 3. Mark ad started
adRouter.post('/session/start', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const result = rewardedAdService.startAd(sessionId, user.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true });
});

// 4. Server-side verify completion of the 15-second rewarded ad
adRouter.post('/session/verify', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { sessionId, verificationToken } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const result = await rewardedAdService.verifyReward(sessionId, user.id, verificationToken);
  if (!result.success) {
    return res.status(400).json({ error: result.error, code: result.code });
  }

  res.json({
    success: true,
    session: result.session,
    message: 'Reward verified successfully. One AI Trader request unlocked.'
  });
});

// 5. Get provider status
adRouter.get('/provider/status', (req: Request, res: Response) => {
  const provider = rewardedAdService.getProvider();
  res.json(provider.getProviderStatus());
});

// 6. Admin: Get Monetization & AI usage telemetry
adRouter.get('/admin/monetization/metrics', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  res.json({
    metrics: rewardedAdService.getMetrics(),
    config: rewardedAdService.getConfig(),
    providerStatus: rewardedAdService.getProvider().getProviderStatus()
  });
});

// 7. Admin: Update monetization configuration
adRouter.post('/admin/monetization/config', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  const updated = rewardedAdService.updateConfig(req.body);
  res.json({ success: true, config: updated });
});
