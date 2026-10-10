import { Router, Request, Response } from 'express';
import { communityStore } from '../services/communityStore';
import { communityModerationEngine } from '../engine/communityModerationEngine';
import { entitlementService, requireProAuth } from '../services/entitlementService';
import { stickerService } from '../services/stickerService';
import { db } from '../db/schema';
import { CommunityChannelId } from '../../src/types';
import { securityAuditService } from '../services/securityAuditService';

export const communityRouter = Router();

// Helper to get authenticated user from token without blocking
const getOptionalUser = (req: Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  const session = db.getSession(token);
  if (!session) return null;
  return db.users.get(session.userId) || null;
};

// 1. Get channel list
communityRouter.get('/channels', (req: Request, res: Response) => {
  res.json({
    channels: communityStore.channels,
    onlineMembers: Math.max(1, communityStore.getConnectedCount())
  });
});

// 2. Check PRO Entitlement status
communityRouter.get('/entitlement', (req: Request, res: Response) => {
  const user = getOptionalUser(req);
  const entitlement = entitlementService.checkEntitlement(user);
  res.json({
    user: user ? { id: user.id, email: user.email, name: user.name, role: user.role, isPro: user.isPro, tier: user.tier } : null,
    entitlement
  });
});

// 3. Test toggle: Grant or Revoke PRO entitlement for development / testing
communityRouter.post('/test-grant-pro', (req: Request, res: Response) => {
  const user = getOptionalUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Please sign in to toggle PRO entitlement.' });
  }

  // Reject unauthorized privilege escalation in production
  if (process.env.NODE_ENV === 'production' && user.role.toLowerCase() !== 'admin') {
    securityAuditService.log({
      type: 'UNAUTHORIZED_ACCESS',
      actor: user.id,
      action: 'SELF_PRO_ELEVATION_ATTEMPT',
      result: 'DENIED',
      metadata: { role: user.role }
    });
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  }

  const { grant, durationDays } = req.body;
  const targetUser = grant
    ? entitlementService.grantPro(user.id, durationDays || 30)
    : entitlementService.revokePro(user.id);

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  securityAuditService.log({
    type: grant ? 'ADMIN_PRO_GRANTED' : 'ADMIN_PRO_REVOKED',
    actor: user.id,
    target: targetUser.id,
    action: grant ? 'GRANT_PRO' : 'REVOKE_PRO',
    result: 'SUCCESS',
    metadata: { durationDays }
  });

  res.json({
    success: true,
    user: targetUser,
    entitlement: entitlementService.checkEntitlement(targetUser)
  });
});

// 4. Get stickers
communityRouter.get('/stickers', (req: Request, res: Response) => {
  res.json({
    packs: stickerService.getPacks()
  });
});

// 5. Protected: Get Messages for a channel (Strict PRO Required)
communityRouter.get('/messages', requireProAuth, (req: Request, res: Response) => {
  const channelId = (req.query.channelId as CommunityChannelId) || 'general';
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const beforeId = req.query.beforeId as string | undefined;

  const messages = communityStore.getMessages(channelId, { limit, beforeId });
  res.json({
    channelId,
    count: messages.length,
    dayKeyUTC: communityStore.getCurrentDayKeyUTC(),
    messages
  });
});

// 6. Protected: Search messages
communityRouter.get('/search', requireProAuth, (req: Request, res: Response) => {
  const q = (req.query.q as string) || '';
  const channelId = req.query.channelId as CommunityChannelId | undefined;
  const results = communityStore.searchMessages(q, channelId);
  res.json({ query: q, results });
});

// 7. Protected: Post Message (Strict PRO Required)
communityRouter.post('/messages', requireProAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { channelId, content, stickerId, replyToId } = req.body;

  if (!channelId) {
    return res.status(400).json({ error: 'channelId is required.' });
  }

  if (!content && !stickerId) {
    return res.status(400).json({ error: 'Message content or sticker is required.' });
  }

  const result = await communityStore.postMessage({
    channelId,
    user,
    content: content || '',
    stickerId,
    replyToId
  });

  if (result.error || !result.message) {
    return res.status(400).json({
      error: result.error,
      moderationResult: result.moderationResult
    });
  }

  res.status(201).json({
    success: true,
    message: result.message
  });
});

// 8. Protected: Edit Message (within 15 minutes)
communityRouter.put('/messages/:id', requireProAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Updated content cannot be empty.' });
  }

  const result = communityStore.editMessage(id, user.id, content);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, message: result.message });
});

// 9. Protected: Delete Message
communityRouter.delete('/messages/:id', requireProAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;

  const result = communityStore.deleteMessage(id, user);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, messageId: id });
});

// 10. Protected: Toggle Reaction
communityRouter.post('/messages/:id/reactions', requireProAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { emoji } = req.body;

  if (!emoji) {
    return res.status(400).json({ error: 'Emoji is required.' });
  }

  const updated = communityStore.toggleReaction(id, user.id, emoji);
  if (!updated) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  res.json({ success: true, reactions: updated.reactions });
});

// 11. Protected: Report Message
communityRouter.post('/messages/:id/report', requireProAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { reason, details } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Report reason is required.' });
  }

  const result = await communityStore.reportMessage({
    messageId: id,
    reportedByUser: user,
    reason,
    details
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, report: result.report });
});

// 12. Protected: SSE Realtime Event Stream
communityRouter.get('/events', requireProAuth, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial handshake
  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ timestamp: Date.now(), dayKeyUTC: communityStore.getCurrentDayKeyUTC() })}\n\n`);

  communityStore.addSseClient(res);

  req.on('close', () => {
    communityStore.removeSseClient(res);
  });
});

// ==========================================
// ADMIN COMMUNITY FORUM & MODERATION ROUTES
// ==========================================

const requireAdmin = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Admin authentication required.' });
  const token = authHeader.replace('Bearer ', '').trim();
  const session = db.getSession(token);
  if (!session) return res.status(401).json({ error: 'Invalid admin session.' });
  const user = db.users.get(session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required.' });
  }
  (req as any).user = user;
  next();
};

// Admin: Community Overview Telemetry
communityRouter.get('/admin/overview', requireAdmin, (req: Request, res: Response) => {
  const users = Array.from(db.users.values());
  const proMembers = users.filter(u => u.isPro || u.tier === 'PRO' || u.role === 'admin').length;
  const reports = communityStore.getReports('PENDING');

  res.json({
    activeProMembers: proMembers,
    onlineUsers: Math.max(1, communityStore.getConnectedCount()),
    messagesToday: communityStore.getTodayMessageCount(),
    messagesPerHour: Math.round(communityStore.getTodayMessageCount() / Math.max(1, (new Date().getUTCHours() + 1))),
    pendingReportsCount: reports.length,
    cleanupStatus: communityStore.cleanupStatus,
    moderationTelemetry: communityModerationEngine.telemetry,
    settings: communityStore.settings
  });
});

// Admin: Get Moderation Reports Queue
communityRouter.get('/admin/reports', requireAdmin, (req: Request, res: Response) => {
  const status = req.query.status as any;
  const reports = communityStore.getReports(status);
  res.json({ count: reports.length, reports });
});

// Admin: Action a Report
communityRouter.post('/admin/reports/:id/action', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Action is required.' });
  }

  const success = communityStore.actionReport(id, action);
  res.json({ success, reportId: id, action });
});

// Admin: Run Ephemeral Daily Cleanup immediately
communityRouter.post('/admin/daily-cleanup', requireAdmin, (req: Request, res: Response) => {
  const result = communityStore.triggerDailyCleanup(true);
  res.json({
    success: result.status === 'SUCCESS',
    ...result,
    statusInfo: communityStore.cleanupStatus
  });
});

// Admin: Get / Update Community Settings
communityRouter.get('/admin/settings', requireAdmin, (req: Request, res: Response) => {
  res.json(communityStore.settings);
});

communityRouter.put('/admin/settings', requireAdmin, (req: Request, res: Response) => {
  const updates = req.body;
  communityStore.settings = { ...communityStore.settings, ...updates };
  res.json({ success: true, settings: communityStore.settings });
});

// Admin: Get User Moderation Statuses
communityRouter.get('/admin/users-moderation', requireAdmin, (req: Request, res: Response) => {
  const statuses = communityModerationEngine.getAllStatuses();
  res.json(statuses);
});

// Admin: Moderate User directly
communityRouter.post('/admin/users/:id/moderate', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { action } = req.body;
  const updated = communityModerationEngine.adminAction(id, action);
  res.json({ success: true, status: updated });
});

// Admin: Grant or Revoke PRO entitlement for a user
communityRouter.post('/admin/users/:id/entitlement', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, durationDays } = req.body; // action: 'GRANT' | 'REVOKE'

  const updatedUser = action === 'GRANT'
    ? entitlementService.grantPro(id, durationDays || 30)
    : entitlementService.revokePro(id);

  if (!updatedUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json({
    success: true,
    user: updatedUser,
    entitlement: entitlementService.checkEntitlement(updatedUser)
  });
});
