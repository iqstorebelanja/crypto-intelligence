import {
  DeliveryAttempt,
  Notification,
  NotificationChannel,
  ProviderHealthState
} from '../../../src/types';
import { db } from '../../db/schema';
import { NotificationProviderInterface, ProviderDeliveryResult } from './baseProvider';

export class InAppNotificationProvider implements NotificationProviderInterface {
  public readonly id = 'in_app_core';
  public readonly name = 'Internal In-App Notification Engine';
  public readonly channel: NotificationChannel = 'IN_APP';

  public isConfigured(): boolean {
    return true; // Always configured and ready
  }

  public async healthCheck(): Promise<{
    status: ProviderHealthState;
    message: string;
    details?: Record<string, any>;
  }> {
    return {
      status: 'HEALTHY',
      message: 'In-app notification storage and queue are fully operational.',
      details: {
        totalDelivered: db.notifications.size
      }
    };
  }

  public async send(
    notification: Notification,
    attempt: DeliveryAttempt
  ): Promise<ProviderDeliveryResult> {
    try {
      // Ensure in-app notification is persisted in database
      const existing = db.getNotificationById(notification.userId, notification.id);
      if (!existing) {
        db.addNotification({
          ...notification,
          status: 'DELIVERED'
        });
      } else {
        db.updateNotification(notification.userId, notification.id, {
          status: 'DELIVERED'
        });
      }

      return {
        success: true,
        providerMessageId: `inapp_${notification.id}_${Date.now()}`
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'TRANSIENT',
        errorMessage: err.message || 'Failed to save in-app notification',
        shouldRetry: true
      };
    }
  }
}

export const inAppNotificationProvider = new InAppNotificationProvider();
