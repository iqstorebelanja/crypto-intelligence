import { GoogleGenAI } from '@google/genai';
import {
  AIModerationResult,
  CommunityMessage,
  ModerationAction,
  ModerationCategory,
  ModerationSeverity,
  UserModerationStatus
} from '../../src/types';

// Banned offensive and abusive patterns
const BANNED_PATTERNS = [
  /\b(kill\s*yourself|kys)\b/i,
  /\b(die\s*in\s*a\s*fire)\b/i,
  /\b(n[i1]gg[ae3]r|f[a4]gg[o0]t)\b/i
];

// Obvious scam and phishing phrases
const SCAM_PATTERNS = [
  /send\s*(\d+(\.\d+)?)\s*(btc|eth|sol|usdt).*get\s*(\d+(\.\d+)?)/i,
  /double\s*your\s*(crypto|btc|eth|money)/i,
  /guaranteed\s*(100x|1000x|10x|50x|profit|returns)/i,
  /t\.me\/(joinchat|pump_signals|vip_crypto|leaks_free)/i,
  /free\s*airdrop\s*claim\s*now\s*at/i,
  /private\s*key|seed\s*phrase/i,
  /dm\s*me\s*for\s*(pump|insider|signals)/i,
  /whatsapp:\s*\+?\d{8,}/i
];

// Malicious link detection
const SUSPICIOUS_DOMAINS = [
  /bit\.ly\/[a-zA-Z0-9_-]+/i,
  /tinyurl\.com\/[a-zA-Z0-9_-]+/i,
  /t\.me\/[a-zA-Z0-9_]+/i,
  /wa\.me\/[a-zA-Z0-9_]+/i,
  /airdrop-[a-z0-9-]+\.(xyz|top|cc|pw|ru)/i,
  /claim-[a-z0-9-]+\.(xyz|top|cc|pw|ru)/i
];

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

export class CommunityModerationEngine {
  // Tracking user posting history for flood & duplicate detection
  private userRecentPosts: Map<string, Array<{ content: string; timestamp: number }>> = new Map();

  // User moderation statuses: userId -> UserModerationStatus
  private userModerationStatuses: Map<string, UserModerationStatus> = new Map();

  // Separate telemetry tracking (strictly separated from AI Trader)
  public telemetry = {
    moderationRequestsToday: 0,
    moderationTokensToday: 0,
    estimatedModerationCostUsd: 0,
    spamBlockedToday: 0,
    linksBlockedToday: 0,
    activeMutesCount: 0,
    activeBansCount: 0
  };

  /**
   * Retrieves or initializes moderation status for a user
   */
  public getUserModerationStatus(userId: string): UserModerationStatus {
    let status = this.userModerationStatuses.get(userId);
    if (!status) {
      status = {
        userId,
        warningCount: 0,
        violationCount: 0,
        muteUntil: null,
        banUntil: null,
        status: 'ACTIVE',
        lastViolationAt: null,
        moderationScore: 100, // Starts at 100 (clean)
        updatedAt: Date.now()
      };
      this.userModerationStatuses.set(userId, status);
    }

    // Check expiration of temporary mutes/bans
    const now = Date.now();
    if (status.status === 'MUTED' && status.muteUntil && status.muteUntil <= now) {
      status.status = 'ACTIVE';
      status.muteUntil = null;
      status.updatedAt = now;
    }
    if (status.status === 'BANNED' && status.banUntil && status.banUntil <= now) {
      status.status = 'ACTIVE';
      status.banUntil = null;
      status.updatedAt = now;
    }

    return status;
  }

  /**
   * LAYER 1: Fast Local Rule Engine (0ms latency, 0 AI tokens)
   */
  public evaluateLocalRules(
    userId: string,
    content: string,
    options?: { maxMessageLength?: number; maxLinks?: number; maxMentions?: number }
  ): AIModerationResult | null {
    const trimmed = (content || '').trim();
    const maxLen = options?.maxMessageLength || 1000;
    const maxLinks = options?.maxLinks ?? 2;
    const maxMentions = options?.maxMentions ?? 5;

    // 1. Length check
    if (trimmed.length > maxLen) {
      this.telemetry.spamBlockedToday++;
      return {
        category: 'FLOOD',
        severity: 'LOW',
        confidence: 100,
        reason: `Message exceeds maximum allowed length of ${maxLen} characters.`,
        recommendedAction: 'HIDE',
        detectedBy: 'LOCAL_RULE_ENGINE',
        timestamp: Date.now()
      };
    }

    // 2. Flood & Duplicate detection
    const now = Date.now();
    let history = this.userRecentPosts.get(userId) || [];
    // Keep only last 60 seconds
    history = history.filter(p => now - p.timestamp < 60000);

    // Burst rate: > 5 messages in 10 seconds
    const last10s = history.filter(p => now - p.timestamp < 10000);
    if (last10s.length >= 5) {
      this.telemetry.spamBlockedToday++;
      return {
        category: 'FLOOD',
        severity: 'MEDIUM',
        confidence: 95,
        reason: 'Rate limit violation: Burst of more than 5 messages in 10 seconds detected.',
        recommendedAction: 'MUTE',
        detectedBy: 'LOCAL_RULE_ENGINE',
        timestamp: now
      };
    }

    // Duplicate message within 2 minutes
    const duplicate = history.find(p => p.content.toLowerCase() === trimmed.toLowerCase() && now - p.timestamp < 120000);
    if (duplicate) {
      this.telemetry.spamBlockedToday++;
      return {
        category: 'SPAM',
        severity: 'LOW',
        confidence: 90,
        reason: 'Duplicate identical message posted within 2 minutes.',
        recommendedAction: 'HIDE',
        detectedBy: 'LOCAL_RULE_ENGINE',
        timestamp: now
      };
    }

    // 3. Mentions check
    const mentions = (trimmed.match(/@[a-zA-Z0-9_-]+/g) || []).length;
    if (mentions > maxMentions) {
      this.telemetry.spamBlockedToday++;
      return {
        category: 'SPAM',
        severity: 'LOW',
        confidence: 95,
        reason: `Excessive mentions detected (${mentions} mentions; max is ${maxMentions}).`,
        recommendedAction: 'HIDE',
        detectedBy: 'LOCAL_RULE_ENGINE',
        timestamp: now
      };
    }

    // 4. Link & Suspicious URL check
    const linkMatches = trimmed.match(/https?:\/\/[^\s]+/gi) || [];
    if (linkMatches.length > maxLinks) {
      this.telemetry.linksBlockedToday++;
      return {
        category: 'SPAM',
        severity: 'MEDIUM',
        confidence: 95,
        reason: `Excessive hyperlinks detected (${linkMatches.length} links; max allowed is ${maxLinks}).`,
        recommendedAction: 'HIDE',
        detectedBy: 'LOCAL_RULE_ENGINE',
        timestamp: now
      };
    }

    for (const pattern of SUSPICIOUS_DOMAINS) {
      if (pattern.test(trimmed)) {
        this.telemetry.linksBlockedToday++;
        return {
          category: 'MALICIOUS_LINK',
          severity: 'HIGH',
          confidence: 92,
          reason: 'Suspicious URL redirector or known scam link pattern detected.',
          recommendedAction: 'HIDE',
          detectedBy: 'LOCAL_RULE_ENGINE',
          timestamp: now
        };
      }
    }

    // 5. Obvious scam phrase matches
    for (const pattern of SCAM_PATTERNS) {
      if (pattern.test(trimmed)) {
        this.telemetry.spamBlockedToday++;
        return {
          category: 'SCAM',
          severity: 'CRITICAL',
          confidence: 96,
          reason: 'Known crypto phishing/scam scheme pattern identified.',
          recommendedAction: 'HIDE',
          detectedBy: 'LOCAL_RULE_ENGINE',
          timestamp: now
        };
      }
    }

    // 6. Banned abusive words
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          category: 'ABUSIVE_LANGUAGE',
          severity: 'HIGH',
          confidence: 98,
          reason: 'Prohibited abusive / hate-speech keyword pattern detected.',
          recommendedAction: 'HIDE',
          detectedBy: 'LOCAL_RULE_ENGINE',
          timestamp: now
        };
      }
    }

    // 7. Excessive Caps check (>80% uppercase with length > 20)
    if (trimmed.length > 20) {
      const letters = trimmed.replace(/[^a-zA-Z]/g, '');
      if (letters.length > 15) {
        const uppers = trimmed.replace(/[^A-Z]/g, '');
        if (uppers.length / letters.length > 0.85) {
          return {
            category: 'SPAM',
            severity: 'LOW',
            confidence: 80,
            reason: 'Excessive uppercase characters (shouting / visual noise).',
            recommendedAction: 'WARN',
            detectedBy: 'LOCAL_RULE_ENGINE',
            timestamp: now
          };
        }
      }
    }

    // Record valid post into recent posts buffer
    history.push({ content: trimmed, timestamp: now });
    this.userRecentPosts.set(userId, history);

    return null; // Passes local rules
  }

  /**
   * LAYER 2: Background AI Moderation Assistant (Invoked only for ambiguous/reported content)
   */
  public async evaluateAIModeration(
    content: string,
    context?: { reportedReason?: string; channelId?: string }
  ): Promise<AIModerationResult> {
    this.telemetry.moderationRequestsToday++;

    const client = getGemini();
    const prompt = `You are a strict, objective, and neutral background crypto community moderation assistant.
Analyze the following user chat message and determine if it violates community safety guidelines (spam, harassment, abusive language, scams, malicious links, phishing, pump-and-dump promotion).

Reported Reason: ${context?.reportedReason || 'Ambiguous Pattern / Routine Check'}
Message Content: "${content.replace(/"/g, '\\"')}"

Respond STRICTLY in JSON format matching this schema:
{
  "category": "SAFE" | "SPAM" | "ABUSIVE_LANGUAGE" | "HARASSMENT" | "SCAM" | "PHISHING" | "MALICIOUS_LINK" | "FLOOD" | "PROMOTION" | "OTHER",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "confidence": <integer from 0 to 100>,
  "reason": "<concise explanation of violation or safety confirmation>",
  "recommendedAction": "ALLOW" | "WARN" | "HIDE" | "MUTE" | "TEMP_BAN" | "ADMIN_REVIEW"
}`;

    if (client) {
      try {
        const response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });

        // Approximate token tracking
        const estTokens = Math.ceil((prompt.length + (response.text?.length || 0)) / 4);
        this.telemetry.moderationTokensToday += estTokens;
        this.telemetry.estimatedModerationCostUsd += (estTokens / 1_000_000) * 0.15;

        const raw = response.text?.trim() || '{}';
        const parsed = JSON.parse(raw);

        return {
          category: parsed.category || 'SAFE',
          severity: parsed.severity || 'LOW',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 80,
          reason: parsed.reason || 'AI evaluated message context.',
          recommendedAction: parsed.recommendedAction || 'ALLOW',
          detectedBy: 'AI_MODERATION_ASSISTANT',
          timestamp: Date.now()
        };
      } catch (err) {
        // Fallback to contextual heuristic if AI API is unavailable
      }
    }

    // Fallback AI simulation heuristic
    const lower = content.toLowerCase();
    const estTokens = Math.ceil(prompt.length / 4);
    this.telemetry.moderationTokensToday += estTokens;

    if (lower.includes('dm me') || lower.includes('signals group') || lower.includes('guaranteed')) {
      return {
        category: 'PROMOTION',
        severity: 'MEDIUM',
        confidence: 85,
        reason: 'Unsolicited VIP group promotional pattern detected in chat context.',
        recommendedAction: 'HIDE',
        detectedBy: 'AI_MODERATION_ASSISTANT',
        timestamp: Date.now()
      };
    }

    return {
      category: 'SAFE',
      severity: 'LOW',
      confidence: 90,
      reason: 'Standard organic user trading commentary.',
      recommendedAction: 'ALLOW',
      detectedBy: 'AI_MODERATION_ASSISTANT',
      timestamp: Date.now()
    };
  }

  /**
   * Applies violation progression rules based on moderation action
   */
  public applyViolation(
    userId: string,
    result: AIModerationResult
  ): { updatedStatus: UserModerationStatus; penaltyApplied: string } {
    const status = this.getUserModerationStatus(userId);
    const now = Date.now();
    status.lastViolationAt = now;
    status.updatedAt = now;

    let penaltyApplied = 'NONE';

    if (result.recommendedAction === 'WARN') {
      status.warningCount++;
      status.moderationScore = Math.max(0, status.moderationScore - 10);
      status.status = 'WARNED';
      penaltyApplied = 'WARNING';
    } else if (result.recommendedAction === 'HIDE' || result.recommendedAction === 'MUTE') {
      status.violationCount++;
      status.moderationScore = Math.max(0, status.moderationScore - 25);

      if (status.violationCount === 1) {
        // First violation: 15-minute mute
        status.muteUntil = now + 15 * 60 * 1000;
        status.status = 'MUTED';
        this.telemetry.activeMutesCount++;
        penaltyApplied = 'MUTED_15_MIN';
      } else if (status.violationCount === 2) {
        // Second violation: 2-hour mute
        status.muteUntil = now + 2 * 3600 * 1000;
        status.status = 'MUTED';
        this.telemetry.activeMutesCount++;
        penaltyApplied = 'MUTED_2_HOURS';
      } else {
        // Repeated serious violations: 24-hour temp ban
        status.banUntil = now + 24 * 3600 * 1000;
        status.status = 'BANNED';
        this.telemetry.activeBansCount++;
        penaltyApplied = 'TEMP_BAN_24_HOURS';
      }
    } else if (result.recommendedAction === 'TEMP_BAN') {
      status.violationCount++;
      status.banUntil = now + 24 * 3600 * 1000;
      status.status = 'BANNED';
      this.telemetry.activeBansCount++;
      penaltyApplied = 'TEMP_BAN_24_HOURS';
    } else if (result.recommendedAction === 'ADMIN_REVIEW') {
      status.violationCount++;
      status.muteUntil = now + 60 * 60 * 1000; // Mute pending review
      status.status = 'MUTED';
      penaltyApplied = 'FLAGGED_FOR_ADMIN_REVIEW';
    }

    return { updatedStatus: status, penaltyApplied };
  }

  /**
   * Admin override action
   */
  public adminAction(
    userId: string,
    action: 'DISMISS' | 'WARN' | 'MUTE_15M' | 'MUTE_1H' | 'MUTE_24H' | 'BAN' | 'UNMUTE' | 'UNBAN'
  ): UserModerationStatus {
    const status = this.getUserModerationStatus(userId);
    const now = Date.now();
    status.updatedAt = now;

    if (action === 'UNMUTE' || action === 'UNBAN' || action === 'DISMISS') {
      status.status = 'ACTIVE';
      status.muteUntil = null;
      status.banUntil = null;
    } else if (action === 'WARN') {
      status.warningCount++;
      status.status = 'WARNED';
    } else if (action === 'MUTE_15M') {
      status.muteUntil = now + 15 * 60 * 1000;
      status.status = 'MUTED';
    } else if (action === 'MUTE_1H') {
      status.muteUntil = now + 3600 * 1000;
      status.status = 'MUTED';
    } else if (action === 'MUTE_24H') {
      status.muteUntil = now + 24 * 3600 * 1000;
      status.status = 'MUTED';
    } else if (action === 'BAN') {
      status.status = 'BANNED';
      status.banUntil = now + 86400000 * 365; // Admin indefinite ban
    }

    return status;
  }

  public getAllStatuses(): UserModerationStatus[] {
    return Array.from(this.userModerationStatuses.values());
  }
}

export const communityModerationEngine = new CommunityModerationEngine();
