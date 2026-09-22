import { AlertEvent, TelegramConfig } from '../../src/types';
import { db } from '../db/schema';

export class TelegramService {
  private userConfigs: Map<string, TelegramConfig> = new Map();

  constructor() {
    // Seed default demo user telegram configuration
    this.userConfigs.set('usr_demo_1', {
      enabled: false,
      botToken: '',
      chatId: '',
      lastTestStatus: null
    });
  }

  public getConfig(userId: string): TelegramConfig {
    return this.userConfigs.get(userId) || {
      enabled: false,
      botToken: '',
      chatId: '',
      lastTestStatus: null
    };
  }

  public saveConfig(userId: string, config: Partial<TelegramConfig>): TelegramConfig {
    const existing = this.getConfig(userId);
    const updated: TelegramConfig = {
      ...existing,
      ...config,
      enabled: config.enabled !== undefined ? config.enabled : existing.enabled
    };
    this.userConfigs.set(userId, updated);
    return updated;
  }

  /**
   * Test Telegram connection by attempting to deliver a test ping
   */
  public async testConnection(botToken: string, chatId: string): Promise<{ success: boolean; message: string }> {
    if (!botToken || !botToken.trim()) {
      return { success: false, message: 'Bot Token is required.' };
    }
    if (!chatId || !chatId.trim()) {
      return { success: false, message: 'Chat ID is required.' };
    }

    const testMessage = `🤖 <b>Crypto Intelligence AI — Telegram Bridge</b>\n\n` +
      `✅ <b>Connection Test Successful!</b>\n` +
      `Your Telegram alert channel is operational and linked to Crypto Intelligence AI.\n\n` +
      `<b>Active Monitoring:</b> Price Alerts, RSI, Bull/Risk Scores, Market Structure Breakouts, Open Interest & Whale Radar.\n\n` +
      `<i>DYOR — Do Your Own Research. Not Financial Advice.</i>`;

    try {
      const url = `https://api.telegram.org/bot${encodeURIComponent(botToken.trim())}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: testMessage,
          parse_mode: 'HTML'
        }),
        signal: AbortSignal.timeout(6000)
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        return { success: true, message: 'Test notification delivered successfully to your Telegram chat!' };
      } else {
        const errorDesc = data.description || `HTTP ${res.status}`;
        return { success: false, message: `Telegram API Error: ${errorDesc}` };
      }
    } catch (err) {
      return { success: false, message: `Connection failed: ${(err as Error).message}` };
    }
  }

  /**
   * Send triggered alert notification to user's Telegram if enabled
   */
  public async sendAlertNotification(userId: string, event: AlertEvent): Promise<boolean> {
    const config = this.getConfig(userId);
    if (!config.enabled || !config.botToken || !config.chatId) {
      return false;
    }

    const priceFormatted = typeof event.triggerPrice === 'number'
      ? `$${event.triggerPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
      : 'N/A';

    const text = `🚨 <b>[CRYPTO INTELLIGENCE ALERT]</b>\n\n` +
      `<b>Asset:</b> <code>${event.symbol}</code> (${event.exchange || 'BINANCE'})\n` +
      `<b>Condition:</b> ${event.conditionType || event.condition}\n` +
      `<b>Detail:</b> ${event.conditionDescription || event.message}\n` +
      `<b>Trigger Price:</b> ${priceFormatted}\n` +
      `<b>Time:</b> ${new Date(event.triggeredAt || Date.now()).toISOString().replace('T', ' ').substring(0, 19)} UTC\n\n` +
      `<i>DYOR — Do Your Own Research. Not Financial Advice.</i>`;

    try {
      const url = `https://api.telegram.org/bot${encodeURIComponent(config.botToken.trim())}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId.trim(),
          text,
          parse_mode: 'HTML'
        }),
        signal: AbortSignal.timeout(5000)
      });
      const data = await res.json();
      return Boolean(data.ok);
    } catch (err) {
      console.warn(`Failed to dispatch Telegram alert for user ${userId}:`, (err as Error).message);
      return false;
    }
  }
}

export const telegramService = new TelegramService();
