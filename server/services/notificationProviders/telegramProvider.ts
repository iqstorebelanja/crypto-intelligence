import {
  DeliveryAttempt,
  Notification,
  NotificationChannel,
  ProviderHealthState
} from '../../../src/types';
import { classifyDeliveryError } from '../circuitBreaker';
import { telegramService } from '../telegramService';
import { NotificationProviderInterface, ProviderDeliveryResult } from './baseProvider';

export class TelegramNotificationProvider implements NotificationProviderInterface {
  public readonly id = 'telegram_bot_bridge';
  public readonly name = 'Telegram Bot Gateway';
  public readonly channel: NotificationChannel = 'TELEGRAM';

  private defaultServerBotToken: string | null = null;

  constructor() {
    this.defaultServerBotToken = process.env.TELEGRAM_BOT_TOKEN || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.defaultServerBotToken);
  }

  public async healthCheck(): Promise<{
    status: ProviderHealthState;
    message: string;
    details?: Record<string, any>;
  }> {
    if (!this.isConfigured()) {
      return {
        status: 'NOT_CONFIGURED',
        message: 'Global Telegram Bot is not configured (TELEGRAM_BOT_TOKEN not set in environment). Individual users may supply personal bot credentials.'
      };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.defaultServerBotToken}/getMe`, {
        signal: AbortSignal.timeout(4000)
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        return {
          status: 'HEALTHY',
          message: `Telegram Bot Gateway online: @${data.result?.username || 'bot'}`,
          details: { botUsername: data.result?.username }
        };
      }
      return {
        status: 'DEGRADED',
        message: `Telegram API responded with error: ${data.description || 'Unknown error'}`
      };
    } catch (err: any) {
      return {
        status: 'DEGRADED',
        message: `Telegram health ping failed: ${err.message}`
      };
    }
  }

  public formatTelegramMessage(notification: Notification): string {
    const symbolStr = notification.symbol ? `<code>${notification.symbol}</code>` : 'MARKET EVENT';
    const exchangeStr = notification.exchange ? ` (${notification.exchange})` : '';
    const timeframeStr = notification.timeframe ? `\n<b>Timeframe:</b> ${notification.timeframe}` : '';
    const dateStr = new Date(notification.createdAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

    return `🚨 <b>[CRYPTO INTELLIGENCE ALERT]</b>\n\n` +
      `<b>Asset:</b> ${symbolStr}${exchangeStr}${timeframeStr}\n` +
      `<b>Type:</b> ${notification.category || notification.type}\n` +
      `<b>Title:</b> ${notification.title}\n` +
      `<b>Details:</b> ${notification.message}\n` +
      `<b>Severity:</b> ${notification.severity}\n` +
      `<b>Timestamp:</b> ${dateStr}\n\n` +
      `<i>Source: Crypto Intelligence AI</i>\n` +
      `<i>DYOR — Analytical tools, not financial advice.</i>`;
  }

  public async send(
    notification: Notification,
    attempt: DeliveryAttempt
  ): Promise<ProviderDeliveryResult> {
    const userConfig = telegramService.getConfig(notification.userId);

    const botToken = userConfig.botToken || this.defaultServerBotToken;
    const chatId = userConfig.chatId;

    if (!botToken || !chatId || !userConfig.enabled) {
      return {
        success: false,
        errorCode: 'CONFIGURATION',
        errorMessage: 'Telegram alert channel is not configured or disabled for this user.',
        shouldRetry: false
      };
    }

    const text = this.formatTelegramMessage(notification);

    try {
      const url = `https://api.telegram.org/bot${encodeURIComponent(botToken.trim())}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text,
          parse_mode: 'HTML'
        }),
        signal: AbortSignal.timeout(6000)
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        return {
          success: true,
          providerMessageId: String(data.result?.message_id || `tg_${Date.now()}`)
        };
      }

      const classification = classifyDeliveryError({
        status: res.status,
        message: data.description
      });

      return {
        success: false,
        errorCode: classification,
        errorMessage: `Telegram API error: ${data.description || res.statusText}`,
        shouldRetry: classification === 'TRANSIENT' || classification === 'RATE_LIMIT'
      };
    } catch (err: any) {
      const classification = classifyDeliveryError(err);
      return {
        success: false,
        errorCode: classification,
        errorMessage: err.message || 'Telegram network request failed',
        shouldRetry: classification === 'TRANSIENT'
      };
    }
  }
}

export const telegramNotificationProvider = new TelegramNotificationProvider();
