import { Response } from 'express';
import {
  CommunityChannel,
  CommunityChannelId,
  CommunityMessage,
  CommunityReport,
  CommunitySettings,
  DailyCleanupStatus,
  User
} from '../../src/types';
import { stickerService } from './stickerService';
import { communityModerationEngine } from '../engine/communityModerationEngine';

export class CommunityStore {
  // Predefined channels
  public channels: CommunityChannel[] = [
    { id: 'general', name: 'General', description: 'General market dialogue and macro discussion', icon: 'MessageSquare', order: 1 },
    { id: 'bitcoin', name: 'Bitcoin', description: 'BTC price action, hash rate, and halving context', icon: 'CircleDollarSign', order: 2 },
    { id: 'ethereum', name: 'Ethereum', description: 'ETH, Layer 2s, staking yields, and gas dynamics', icon: 'Layers', order: 3 },
    { id: 'altcoins', name: 'Altcoins', description: 'High-beta altcoins, ecosystem rotation, and narratives', icon: 'Coins', order: 4 },
    { id: 'technical-analysis', name: 'Technical Analysis', description: 'Chart setups, market structure, RSI/MA confluence', icon: 'TrendingUp', order: 5 },
    { id: 'trading-setup', name: 'Trading Setup', description: 'Risk-managed trade ideas with defined invalidation', icon: 'Crosshair', order: 6 },
    { id: 'whale-watch', name: 'Whale Watch', description: 'Large on-chain transfers, exchange inflows, and clustering', icon: 'Waves', order: 7 },
    { id: 'market-news', name: 'Market News', description: 'Macro announcements, CPI, FOMC, and regulatory updates', icon: 'Newspaper', order: 8 },
    { id: 'market-discussion', name: 'Market Discussion', description: 'Derivatives, open interest, and funding rate analysis', icon: 'BarChart2', order: 9 },
    { id: 'crypto-memes', name: 'Crypto Meme / Sticker', description: 'Crypto culture, sticker reactions, and community humor', icon: 'Sparkles', order: 10 }
  ];

  // In-memory messages: messageId -> CommunityMessage
  private messages: Map<string, CommunityMessage> = new Map();

  // Channel index: channelId -> array of messageIds
  private channelMessageIndex: Map<CommunityChannelId, string[]> = new Map();

  // Reports list
  private reports: Map<string, CommunityReport> = new Map();

  // Settings
  public settings: CommunitySettings = {
    maxMessageLength: 1000,
    rateLimitMsgsPerMin: 20,
    floodThresholdSeconds: 10,
    warningThreshold: 2,
    muteDurationMinutes: 15,
    tempBanDurationHours: 24,
    maxLinksPerMessage: 2,
    maxMentionsPerMessage: 5,
    aiModerationEnabled: true,
    aiModerationThreshold: 75,
    retentionHours: 24
  };

  // Daily cleanup telemetry & tracking
  public cleanupStatus: DailyCleanupStatus = {
    lastCleanupAt: null,
    lastCleanupDateUTC: null,
    status: 'PENDING',
    nextCleanupAt: 0,
    deletedMessagesCount: 0,
    errorMessage: null,
    retriedCount: 0
  };

  // SSE Realtime connected clients
  private sseClients: Set<Response> = new Set();

  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    for (const c of this.channels) {
      this.channelMessageIndex.set(c.id, []);
    }
    this.scheduleNextUtcCleanup();
    this.seedInitialMessages();
  }

  /**
   * Calculates current server-side UTC Day string 'YYYY-MM-DD'
   */
  public getCurrentDayKeyUTC(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Seeds organic demo messages for current UTC day
   */
  private seedInitialMessages() {
    const today = this.getCurrentDayKeyUTC();
    const now = Date.now();

    const seeds: Partial<CommunityMessage>[] = [
      {
        channelId: 'general',
        userId: 'usr_pro_seed1',
        userName: 'SatoshiStacker',
        userRole: 'user',
        userTier: 'PRO',
        content: 'Welcome to the PRO Exclusive Community Forum. High quality market alpha only. DYOR as always.',
        createdAt: now - 3600000,
        dayKeyUTC: today,
        reactions: { '🚀': ['usr_pro_seed2', 'usr_admin_master'], '💎': ['usr_pro_seed1'] },
        mentions: [],
        moderationStatus: 'SAFE'
      },
      {
        channelId: 'bitcoin',
        userId: 'usr_pro_seed2',
        userName: 'OrderFlowPro',
        userRole: 'user',
        userTier: 'PRO',
        content: 'BTC 4H CVD is showing steady buying expansion despite funding rate staying in neutral territory. Keep an eye on $67.2k resistance.',
        createdAt: now - 2400000,
        dayKeyUTC: today,
        stickerId: 'stk_bull',
        reactions: { '🐂': ['usr_pro_seed1'] },
        mentions: [],
        moderationStatus: 'SAFE'
      },
      {
        channelId: 'technical-analysis',
        userId: 'usr_admin_master',
        userName: 'System Administrator',
        userRole: 'admin',
        userTier: 'ADMIN',
        content: 'Reminder: Ephemeral chat history automatically resets daily at 00:00 UTC. Important notes should be kept in your personal journal.',
        createdAt: now - 1800000,
        dayKeyUTC: today,
        reactions: { '👍': ['usr_pro_seed1', 'usr_pro_seed2'] },
        mentions: [],
        moderationStatus: 'SAFE'
      },
      {
        channelId: 'crypto-memes',
        userId: 'usr_pro_seed1',
        userName: 'SatoshiStacker',
        userRole: 'user',
        userTier: 'PRO',
        content: 'When the 15m liquidation cascade hits the exact cluster band predicted by the engine:',
        createdAt: now - 1200000,
        dayKeyUTC: today,
        stickerId: 'stk_lfg',
        reactions: { '🔥': ['usr_pro_seed2'] },
        mentions: [],
        moderationStatus: 'SAFE'
      }
    ];

    for (const s of seeds) {
      const id = `msg_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
      const msg: CommunityMessage = {
        id,
        channelId: s.channelId as CommunityChannelId,
        userId: s.userId!,
        userName: s.userName!,
        userRole: s.userRole!,
        userTier: s.userTier!,
        content: s.content!,
        createdAt: s.createdAt!,
        dayKeyUTC: s.dayKeyUTC!,
        stickerId: s.stickerId,
        reactions: s.reactions || {},
        mentions: s.mentions || [],
        moderationStatus: 'SAFE'
      };
      this.messages.set(id, msg);
      this.channelMessageIndex.get(msg.channelId)?.push(id);
    }
  }

  /**
   * Retrieves messages for a specific channel, filtering hidden messages for normal users
   */
  public getMessages(channelId: CommunityChannelId, options?: { limit?: number; beforeId?: string; includeHidden?: boolean }): CommunityMessage[] {
    const ids = this.channelMessageIndex.get(channelId) || [];
    const limit = options?.limit || 50;

    let list = ids
      .map(id => this.messages.get(id))
      .filter((m): m is CommunityMessage => Boolean(m && !m.isDeleted));

    if (!options?.includeHidden) {
      list = list.filter(m => m.moderationStatus !== 'HIDDEN');
    }

    if (options?.beforeId) {
      const idx = list.findIndex(m => m.id === options.beforeId);
      if (idx > 0) {
        list = list.slice(0, idx);
      }
    }

    // Return the latest messages
    return list.slice(-limit);
  }

  /**
   * Searches messages across channels
   */
  public searchMessages(query: string, channelId?: CommunityChannelId): CommunityMessage[] {
    const q = (query || '').toLowerCase().trim();
    if (!q) return [];

    let all = Array.from(this.messages.values()).filter(m => !m.isDeleted && m.moderationStatus !== 'HIDDEN');
    if (channelId) {
      all = all.filter(m => m.channelId === channelId);
    }

    return all
      .filter(m => m.content.toLowerCase().includes(q) || m.userName.toLowerCase().includes(q))
      .slice(-30);
  }

  /**
   * Posts a new community message
   */
  public async postMessage(params: {
    channelId: CommunityChannelId;
    user: User;
    content: string;
    stickerId?: string;
    replyToId?: string;
  }): Promise<{ message: CommunityMessage | null; error?: string; moderationResult?: any }> {
    const { channelId, user, content, stickerId, replyToId } = params;

    // 1. Check user mute / ban status
    const modStatus = communityModerationEngine.getUserModerationStatus(user.id);
    if (modStatus.status === 'BANNED') {
      return { message: null, error: 'Your account is temporarily suspended from community chat.' };
    }
    if (modStatus.status === 'MUTED' && modStatus.muteUntil && modStatus.muteUntil > Date.now()) {
      const remainingMin = Math.ceil((modStatus.muteUntil - Date.now()) / 60000);
      return { message: null, error: `You are temporarily muted for community guideline violation. (${remainingMin}m remaining)` };
    }

    // 2. Validate sticker if present
    if (stickerId && !stickerService.isValidSticker(stickerId)) {
      return { message: null, error: 'Invalid or inactive sticker identifier.' };
    }

    // 3. LAYER 1: Fast Local Rule Moderation
    const localViolation = communityModerationEngine.evaluateLocalRules(user.id, content, {
      maxMessageLength: this.settings.maxMessageLength,
      maxLinks: this.settings.maxLinksPerMessage,
      maxMentions: this.settings.maxMentionsPerMessage
    });

    if (localViolation) {
      const { updatedStatus } = communityModerationEngine.applyViolation(user.id, localViolation);
      return {
        message: null,
        error: `Message blocked: ${localViolation.reason}`,
        moderationResult: localViolation
      };
    }

    // 4. Resolve reply-to context if provided
    let replyToMessage: { id: string; userName: string; content: string } | undefined;
    if (replyToId) {
      const parent = this.messages.get(replyToId);
      if (parent) {
        replyToMessage = {
          id: parent.id,
          userName: parent.userName,
          content: parent.content.slice(0, 100)
        };
      }
    }

    // 5. Extract mentions (@username)
    const mentionMatches = (content || '').match(/@[a-zA-Z0-9_-]+/g) || [];
    const mentions = Array.from(new Set(mentionMatches.map(m => m.substring(1))));

    // 6. Construct new message entity
    const now = Date.now();
    const id = `msg_${Math.random().toString(36).substring(2, 10)}_${now}`;
    const dayKeyUTC = this.getCurrentDayKeyUTC();

    const newMessage: CommunityMessage = {
      id,
      channelId,
      userId: user.id,
      userName: user.name || user.email.split('@')[0],
      userRole: user.role || 'user',
      userTier: (user.role === 'admin' ? 'ADMIN' : 'PRO'),
      content: content.trim(),
      createdAt: now,
      dayKeyUTC,
      replyToId,
      replyToMessage,
      stickerId,
      reactions: {},
      mentions,
      moderationStatus: 'SAFE'
    };

    // 7. Store in memory and index
    this.messages.set(id, newMessage);
    const channelList = this.channelMessageIndex.get(channelId);
    if (channelList) {
      channelList.push(id);
    }

    // 8. Realtime Broadcast to connected PRO users via SSE
    this.broadcastEvent('NEW_MESSAGE', newMessage);

    return { message: newMessage };
  }

  /**
   * Edits an existing message (allowed within 15 minutes of creation)
   */
  public editMessage(messageId: string, userId: string, newContent: string): { success: boolean; message?: CommunityMessage; error?: string } {
    const msg = this.messages.get(messageId);
    if (!msg) return { success: false, error: 'Message not found.' };

    if (msg.userId !== userId) {
      return { success: false, error: 'You can only edit your own messages.' };
    }

    // 15-minute edit window check
    const ageMs = Date.now() - msg.createdAt;
    if (ageMs > 15 * 60 * 1000) {
      return { success: false, error: 'Messages can only be edited within 15 minutes of posting.' };
    }

    const localViolation = communityModerationEngine.evaluateLocalRules(userId, newContent, {
      maxMessageLength: this.settings.maxMessageLength
    });
    if (localViolation) {
      return { success: false, error: `Edit rejected: ${localViolation.reason}` };
    }

    msg.content = newContent.trim();
    msg.updatedAt = Date.now();
    msg.isEdited = true;

    this.broadcastEvent('EDIT_MESSAGE', msg);
    return { success: true, message: msg };
  }

  /**
   * Deletes a message (owner or admin)
   */
  public deleteMessage(messageId: string, user: User): { success: boolean; error?: string } {
    const msg = this.messages.get(messageId);
    if (!msg) return { success: false, error: 'Message not found.' };

    if (msg.userId !== user.id && user.role !== 'admin') {
      return { success: false, error: 'Unauthorized to delete this message.' };
    }

    msg.isDeleted = true;
    msg.content = '[This message was deleted]';

    this.broadcastEvent('DELETE_MESSAGE', { id: messageId, channelId: msg.channelId });
    return { success: true };
  }

  /**
   * Toggles a reaction emoji on a message
   */
  public toggleReaction(messageId: string, userId: string, emoji: string): CommunityMessage | null {
    const msg = this.messages.get(messageId);
    if (!msg || msg.isDeleted) return null;

    if (!msg.reactions[emoji]) {
      msg.reactions[emoji] = [];
    }

    const userList = msg.reactions[emoji];
    const existingIdx = userList.indexOf(userId);

    if (existingIdx >= 0) {
      userList.splice(existingIdx, 1);
      if (userList.length === 0) {
        delete msg.reactions[emoji];
      }
    } else {
      userList.push(userId);
    }

    this.broadcastEvent('REACTION_UPDATE', { messageId, reactions: msg.reactions });
    return msg;
  }

  /**
   * Reports a message and invokes Layer 2 AI Moderation in the background
   */
  public async reportMessage(params: {
    messageId: string;
    reportedByUser: User;
    reason: CommunityReport['reason'];
    details?: string;
  }): Promise<{ success: boolean; report: CommunityReport | null; error?: string }> {
    const { messageId, reportedByUser, reason, details } = params;
    const msg = this.messages.get(messageId);
    if (!msg) return { success: false, report: null, error: 'Message not found.' };

    const reportId = `rep_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    // Invoke Layer 2 AI Moderation Assistant in background
    let aiResult = undefined;
    if (this.settings.aiModerationEnabled) {
      aiResult = await communityModerationEngine.evaluateAIModeration(msg.content, {
        reportedReason: reason,
        channelId: msg.channelId
      });
      // If AI recommends hiding and confidence is above threshold, hide message pending review
      if (aiResult.recommendedAction === 'HIDE' && aiResult.confidence >= this.settings.aiModerationThreshold) {
        msg.moderationStatus = 'HIDDEN';
        msg.moderationReason = `Flagged: ${aiResult.reason}`;
        this.broadcastEvent('DELETE_MESSAGE', { id: msg.id, channelId: msg.channelId });
      }
    }

    const report: CommunityReport = {
      id: reportId,
      messageId: msg.id,
      channelId: msg.channelId,
      reportedUserId: msg.userId,
      reportedByUserId: reportedByUser.id,
      reportedByUserName: reportedByUser.name || reportedByUser.email,
      reason,
      details,
      createdAt: Date.now(),
      status: 'PENDING',
      messageSnippet: msg.content.slice(0, 150),
      aiModerationResult: aiResult
    };

    this.reports.set(reportId, report);
    return { success: true, report };
  }

  public getReports(status?: CommunityReport['status']): CommunityReport[] {
    const list = Array.from(this.reports.values());
    if (status) return list.filter(r => r.status === status);
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  public actionReport(reportId: string, action: 'DISMISS' | 'HIDE_MESSAGE' | 'RESTORE_MESSAGE' | 'WARN_USER' | 'MUTE_USER' | 'BAN_USER'): boolean {
    const report = this.reports.get(reportId);
    if (!report) return false;

    report.status = action === 'DISMISS' ? 'DISMISSED' : 'ACTIONED';
    const msg = this.messages.get(report.messageId);

    if (action === 'HIDE_MESSAGE' && msg) {
      msg.moderationStatus = 'HIDDEN';
      this.broadcastEvent('DELETE_MESSAGE', { id: msg.id, channelId: msg.channelId });
    } else if (action === 'RESTORE_MESSAGE' && msg) {
      msg.moderationStatus = 'SAFE';
      this.broadcastEvent('NEW_MESSAGE', msg);
    } else if (action === 'WARN_USER') {
      communityModerationEngine.adminAction(report.reportedUserId, 'WARN');
    } else if (action === 'MUTE_USER') {
      communityModerationEngine.adminAction(report.reportedUserId, 'MUTE_1H');
    } else if (action === 'BAN_USER') {
      communityModerationEngine.adminAction(report.reportedUserId, 'BAN');
    }

    return true;
  }

  /**
   * ==========================================
   * EPHEMERAL DAILY CLEANUP (00:00 UTC)
   * ==========================================
   */
  public scheduleNextUtcCleanup() {
    if (this.cleanupTimer) clearTimeout(this.cleanupTimer);

    const now = new Date();
    // Next 00:00 UTC
    const nextUtc = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));

    const delayMs = nextUtc.getTime() - now.getTime();
    this.cleanupStatus.nextCleanupAt = nextUtc.getTime();

    this.cleanupTimer = setTimeout(() => {
      this.triggerDailyCleanup();
      this.scheduleNextUtcCleanup();
    }, delayMs);
  }

  /**
   * Executes the idempotent daily cleanup job.
   * Purges all messages from previous UTC days while strictly retaining the current UTC day.
   */
  public triggerDailyCleanup(force: boolean = false): { purgedCount: number; currentDayKey: string; status: string } {
    this.cleanupStatus.status = 'RUNNING';
    const currentDayKey = this.getCurrentDayKeyUTC();
    let purgedCount = 0;

    try {
      const messagesToDelete: string[] = [];
      for (const [id, msg] of this.messages.entries()) {
        // Ephemeral rule: Delete messages created before today's UTC dayKey
        if (msg.dayKeyUTC < currentDayKey) {
          messagesToDelete.push(id);
        }
      }

      for (const id of messagesToDelete) {
        const msg = this.messages.get(id);
        if (msg) {
          // Remove from channel index
          const list = this.channelMessageIndex.get(msg.channelId);
          if (list) {
            const idx = list.indexOf(id);
            if (idx >= 0) list.splice(idx, 1);
          }
          this.messages.delete(id);
          purgedCount++;
        }
      }

      this.cleanupStatus.lastCleanupAt = Date.now();
      this.cleanupStatus.lastCleanupDateUTC = currentDayKey;
      this.cleanupStatus.deletedMessagesCount += purgedCount;
      this.cleanupStatus.status = 'SUCCESS';
      this.cleanupStatus.errorMessage = null;

      // Broadcast cleanup notification to connected clients
      this.broadcastEvent('DAILY_CLEANUP', {
        purgedCount,
        dayKeyUTC: currentDayKey,
        timestamp: Date.now()
      });

      return { purgedCount, currentDayKey, status: 'SUCCESS' };
    } catch (err) {
      this.cleanupStatus.status = 'FAILED';
      this.cleanupStatus.errorMessage = (err as Error).message;
      this.cleanupStatus.retriedCount++;
      return { purgedCount, currentDayKey, status: 'FAILED' };
    }
  }

  /**
   * ==========================================
   * SSE REALTIME CONNECTION MANAGEMENT
   * ==========================================
   */
  public addSseClient(res: Response) {
    this.sseClients.add(res);
  }

  public removeSseClient(res: Response) {
    this.sseClients.delete(res);
  }

  public getConnectedCount(): number {
    return this.sseClients.size;
  }

  private broadcastEvent(eventType: string, data: any) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch (err) {
        this.sseClients.delete(client);
      }
    }
  }

  /**
   * Counts total messages posted today
   */
  public getTodayMessageCount(): number {
    const today = this.getCurrentDayKeyUTC();
    let count = 0;
    for (const msg of this.messages.values()) {
      if (msg.dayKeyUTC === today && !msg.isDeleted) count++;
    }
    return count;
  }
}

export const communityStore = new CommunityStore();
