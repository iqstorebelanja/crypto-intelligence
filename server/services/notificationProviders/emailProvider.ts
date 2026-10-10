import {
  DeliveryAttempt,
  Notification,
  NotificationChannel,
  ProviderHealthState
} from '../../../src/types';
import { NotificationProviderInterface, ProviderDeliveryResult } from './baseProvider';

export class EmailNotificationProvider implements NotificationProviderInterface {
  public readonly id = 'email_smtp_gateway';
  public readonly name = 'Transactional Email Engine (SMTP)';
  public readonly channel: NotificationChannel = 'EMAIL';

  private smtpHost: string | null = null;
  private smtpUser: string | null = null;

  constructor() {
    this.smtpHost = process.env.SMTP_HOST || null;
    this.smtpUser = process.env.SMTP_USER || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.smtpHost && this.smtpUser);
  }

  public async healthCheck(): Promise<{
    status: ProviderHealthState;
    message: string;
    details?: Record<string, any>;
  }> {
    if (!this.isConfigured()) {
      return {
        status: 'NOT_CONFIGURED',
        message: 'Email provider is disabled (SMTP_HOST / SMTP_USER credentials not configured in environment).'
      };
    }

    return {
      status: 'HEALTHY',
      message: `Email provider configured with host: ${this.smtpHost}`,
      details: { host: this.smtpHost, user: this.smtpUser }
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
        errorMessage: 'Email provider is not configured. Notification not dispatched.',
        shouldRetry: false
      };
    }

    // In a real environment with SMTP credentials, SMTP connection is made here.
    return {
      success: false,
      errorCode: 'CONFIGURATION',
      errorMessage: 'SMTP transport not initialized.',
      shouldRetry: false
    };
  }
}

export const emailNotificationProvider = new EmailNotificationProvider();
