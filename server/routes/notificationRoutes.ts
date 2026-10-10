import { Router, Request, Response } from 'express';
import { db } from '../db/schema';
import { notificationService } from '../services/notificationService';
import { WebPushSubscriptionRecord, User, NotificationCategory } from '../../src/types';
import { InputValidator } from '../services/inputValidator';
import { securityAuditService } from '../services/securityAuditService';

export const notificationRouter = Router();

function getStrictAuthUser(req: Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const session = db.getSession(token);
  if (!session || session.expiresAt < Date.now()) return null;
  const user = db.users.get(session.userId) || null;
  if (!user || user.status === 'DISABLED') return null;
  return user;
}

// Middleware: require authenticated user
function requireNotificationAuth(req: Request, res: Response, next: () => void) {
  const user = getStrictAuthUser(req);
  if (!user) {
    securityAuditService.log({
      type: 'UNAUTHORIZED_ACCESS',
      actor: req.ip || 'anonymous',
      target: req.originalUrl,
      action: 'NOTIFICATION_AUTH_CHECK',
      result: 'DENIED'
    });
    return res.status(401).json({ error: 'Authentication required. Please sign in to manage notifications.' });
  }
  (req as any).user = user;
  next();
}

// Middleware: require admin user
function requireAdminAuth(req: Request, res: Response, next: () => void) {
  const user = getStrictAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (user.role.toUpperCase() !== 'ADMIN') {
    securityAuditService.log({
      type: 'UNAUTHORIZED_ACCESS',
      actor: user.email,
      target: req.originalUrl,
      action: 'ADMIN_NOTIFICATION_HEALTH_ACCESS',
      result: 'DENIED'
    });
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  }
  (req as any).user = user;
  next();
}

// ==========================================
// USER NOTIFICATIONS API (Strict IDOR Protected)
// ==========================================

// Get user notifications with category filtering and unread status
notificationRouter.get('/', (req: Request, res: Response) => {
  const user = getStrictAuthUser(req);
  if (!user) {
    return res.json({
      notifications: [],
      unreadCount: 0,
      timestamp: Date.now()
    });
  }

  const categoryGroup = req.query.categoryGroup ? InputValidator.sanitizeSearch(req.query.categoryGroup as string, 30) : undefined;
  const unreadOnly = req.query.unreadOnly === 'true';
  const limit = InputValidator.validateLimit(req.query.limit, 50, 150);

  const notifications = notificationService.getUserNotifications(user.id, {
    categoryGroup,
    unreadOnly,
    limit
  });

  res.json({
    notifications,
    unreadCount: notificationService.getUnreadCount(user.id),
    timestamp: Date.now()
  });
});

// Fast unread count for header bell badge
notificationRouter.get('/unread-count', (req: Request, res: Response) => {
  const user = getStrictAuthUser(req);
  if (!user) {
    return res.json({ unreadCount: 0 });
  }
  const count = notificationService.getUnreadCount(user.id);
  res.json({ unreadCount: count });
});

// Mark single notification as read / unread (IDOR verification: user owns the notification)
notificationRouter.put('/:id/read', requireNotificationAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const notifId = req.params.id;
  const read = req.body.read !== undefined ? Boolean(req.body.read) : true;

  // Verify ownership before modifying
  const existing = db.getNotificationById(user.id, notifId);
  if (!existing) {
    return res.status(404).json({ error: 'Notification not found or access denied.' });
  }

  const success = notificationService.markRead(user.id, notifId, read);
  res.json({
    success,
    notificationId: notifId,
    read,
    unreadCount: notificationService.getUnreadCount(user.id)
  });
});

// Mark all notifications read
notificationRouter.post('/mark-all-read', requireNotificationAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const updatedCount = notificationService.markAllRead(user.id);
  res.json({
    success: true,
    updatedCount,
    unreadCount: 0
  });
});

// Delete / archive single notification (IDOR verified)
notificationRouter.delete('/:id', requireNotificationAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const notifId = req.params.id;

  const existing = db.getNotificationById(user.id, notifId);
  if (!existing) {
    return res.status(404).json({ error: 'Notification not found or access denied.' });
  }

  const deleted = notificationService.deleteNotification(user.id, notifId);
  res.json({ success: deleted });
});

// ==========================================
// USER PREFERENCES API
// ==========================================

notificationRouter.get('/preferences', requireNotificationAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const prefs = notificationService.getUserPreferences(user.id);
  const limits = notificationService.getAlertLimits(user);

  // Redact raw botToken for security
  const safePrefs = {
    ...prefs,
    telegramBotToken: prefs.telegramBotToken ? '••••••••' : '',
    hasTelegramBotToken: Boolean(prefs.telegramBotToken)
  };

  res.json({
    preferences: safePrefs,
    limits
  });
});

notificationRouter.put('/preferences', requireNotificationAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const body = req.body || {};

  // If user passed placeholder masked token, don't overwrite real token
  if (body.telegramBotToken === '••••••••') {
    delete body.telegramBotToken;
  }

  const updated = notificationService.saveUserPreferences(user.id, body);
  res.json({
    success: true,
    preferences: {
      ...updated,
      telegramBotToken: updated.telegramBotToken ? '••••••••' : '',
      hasTelegramBotToken: Boolean(updated.telegramBotToken)
    }
  });
});

// ==========================================
// WEB PUSH SUBSCRIPTION API (Strict Ownership)
// ==========================================

notificationRouter.post('/push/subscribe', requireNotificationAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { endpoint, keys, browserMetadata } = req.body;

  if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    return res.status(400).json({ error: 'Valid HTTPS Web Push endpoint required.' });
  }

  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
    return res.status(400).json({ error: 'Invalid Web Push cryptographic keys payload.' });
  }

  const record: WebPushSubscriptionRecord = {
    id: `wps_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: user.id, // Enforce logged-in user ID
    endpoint: endpoint.trim(),
    keys: {
      p256dh: keys.p256dh.trim(),
      auth: keys.auth.trim()
    },
    browserMetadata: browserMetadata ? InputValidator.sanitizeSearch(String(browserMetadata), 200) : undefined,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    status: 'ACTIVE'
  };

  db.saveWebPushSubscription(record);
  res.json({ success: true, message: 'Web Push subscription registered.' });
});

notificationRouter.post('/push/unsubscribe', requireNotificationAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { endpoint } = req.body;

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Endpoint is required for unsubscription.' });
  }

  const removed = db.removeWebPushSubscription(user.id, endpoint.trim());
  res.json({ success: removed });
});

// ==========================================
// ALERT DELIVERY HISTORY
// ==========================================

notificationRouter.get('/history', requireNotificationAuth, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const notifs = db.getNotifications(user.id);

  const history = notifs.map(n => {
    const attempts = db.getDeliveryAttempts(n.id);
    return {
      id: n.id,
      timestamp: n.createdAt,
      symbol: n.symbol || 'SYSTEM',
      exchange: n.exchange || 'BINANCE',
      timeframe: n.timeframe || '1H',
      category: n.category,
      type: n.type,
      title: n.title,
      triggerPrice: n.snapshot?.triggerPrice,
      status: n.status,
      deepLink: n.deepLink,
      deliveryAttempts: attempts.map(a => ({
        channel: a.channel,
        status: a.status,
        provider: a.provider,
        completedAt: a.completedAt,
        errorMessage: a.errorMessage
      }))
    };
  });

  res.json({ history });
});

// ==========================================
// ADMIN NOTIFICATION MONITOR & HEALTH (Protected with requireAdminAuth)
// ==========================================

notificationRouter.get('/admin/health', requireAdminAuth, async (req: Request, res: Response) => {
  const health = await notificationService.getNotificationHealth();
  const logs = notificationService.getStructuredLogs(50);
  res.json({ health, logs });
});

notificationRouter.get('/admin/failures', requireAdminAuth, (req: Request, res: Response) => {
  const limit = InputValidator.validateLimit(req.query.limit, 50, 100);
  const failures = notificationService.getFailedDeliveries(limit);
  res.json({ failures });
});

notificationRouter.post('/admin/retry', requireAdminAuth, async (req: Request, res: Response) => {
  const { attemptId } = req.body;
  if (!attemptId || typeof attemptId !== 'string') {
    return res.status(400).json({ error: 'attemptId string is required' });
  }

  const result = await notificationService.retryDelivery(attemptId.trim());
  res.json(result);
});

// Test dispatch through notification reliability pipeline
notificationRouter.post('/test', requireNotificationAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const category = (InputValidator.sanitizeSearch(req.body.category || 'PRICE', 30) as NotificationCategory);
  const symbolRes = InputValidator.validateSymbol(req.body.symbol || 'BTC');
  const exchange = InputValidator.validateExchange(req.body.exchange, 'BINANCE');

  const result = await notificationService.createNotification({
    userId: user.id,
    category,
    title: `${symbolRes.symbol} Test Alert [Pipeline Test]`,
    message: `Test notification dispatched through centralized reliability engine at ${new Date().toISOString()}`,
    symbol: symbolRes.symbol,
    exchange,
    severity: 'MEDIUM',
    source: 'Manual Verification Test',
    isDataFresh: true,
    snapshot: {
      triggerPrice: 65400,
      indicatorSnapshot: { rsi: 54.2 }
    }
  });

  res.json({
    success: Boolean(result.notification),
    notification: result.notification,
    deduped: result.deduped,
    suppressedReason: result.suppressedReason
  });
});
