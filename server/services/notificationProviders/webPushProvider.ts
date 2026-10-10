import {
  DeliveryAttempt,
  Notification,
  NotificationChannel,
  ProviderHealthState
} from '../../../src/types';
import { db } from '../../db/schema';
import { classifyDeliveryError } from '../circuitBreaker';
import { NotificationProviderInterface, ProviderDeliveryResult } from './baseProvider';

export class WebPushNotificationProvider implements NotificationProviderInterface {
  public readonly id = 'web_push_engine';
  public readonly name = 'Browser Web Push Engine (VAPID)';
  public readonly channel: NotificationChannel = 'WEB_PUSH';

  private vapidPublicKey: string | null = null;
  private vapidPrivateKey: string | null = null;
  private vapidSubject: string | null = null;

  constructor() {
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || null;
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || null;
    this.vapidSubject = process.env.VAPID_SUBJECT || 'mailto:alerts@cryptointelligence.ai';
  }

  public isConfigured(): boolean {
    return Boolean(this.vapidPublicKey && this.vapidPrivateKey);
  }

  public getPublicKey(): string | null {
    return this.vapidPublicKey;
  }

  public async healthCheck(): Promise<{
    status: ProviderHealthState;
    message: string;
    details?: Record<string, any>;
  }> {
    if (!this.isConfigured()) {
      return {
        status: 'NOT_CONFIGURED',
        message: 'Web Push is disabled: VAPID keys (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) are not provisioned in environment.'
      };
    }

    return {
      status: 'HEALTHY',
      message: 'Web Push provider configured with valid VAPID keys.',
      details: {
        publicKeyAvailable: Boolean(this.vapidPublicKey),
        subject: this.vapidSubject
      }
    };
  }

  public async send(
    notification: Notification,
    attempt: DeliveryAttempt
  ): Promise<ProviderDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        errorCode: 'CONFIGURATION',
        errorMessage: 'Web Push provider not configured (Missing VAPID keys). Notification held in queue.',
        shouldRetry: false
      };
    }

    // Retrieve active subscriptions for user
    const subscriptions = db.getWebPushSubscriptions(notification.userId);
    if (!subscriptions || subscriptions.length === 0) {
      return {
        success: false,
        errorCode: 'PERMANENT',
        errorMessage: 'No active Web Push browser subscriptions registered for user.',
        shouldRetry: false
      };
    }

    let deliveredCount = 0;
    let lastError: any = null;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      icon: '/favicon.ico',
      badge: '/badge-72x72.png',
      data: {
        notificationId: notification.id,
        symbol: notification.symbol,
        exchange: notification.exchange,
        deepLink: notification.deepLink || `/coin/${notification.symbol || 'BTC'}`
      }
    });

    for (const sub of subscriptions) {
      try {
        // Standard Web Push endpoint dispatch
        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TTL': '86400',
            'Urgency': notification.severity === 'CRITICAL' ? 'high' : 'normal'
          },
          body: payload,
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok || response.status === 201) {
          deliveredCount++;
          sub.lastSeenAt = Date.now();
        } else if (response.status === 404 || response.status === 410) {
          // Permanently invalid or revoked subscription
          sub.status = 'REVOKED';
        } else {
          lastError = new Error(`Push service returned HTTP ${response.status}`);
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (deliveredCount > 0) {
      return {
        success: true,
        providerMessageId: `push_${notification.id}_${deliveredCount}`
      };
    }

    const classification = classifyDeliveryError(lastError);
    return {
      success: false,
      errorCode: classification,
      errorMessage: lastError?.message || 'Failed to dispatch to browser endpoints.',
      shouldRetry: classification === 'TRANSIENT' || classification === 'RATE_LIMIT'
    };
  }
}

export const webPushNotificationProvider = new WebPushNotificationProvider();
