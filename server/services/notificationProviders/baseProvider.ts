import {
  DeliveryAttempt,
  DeliveryErrorClassification,
  Notification,
  NotificationChannel,
  ProviderHealthState
} from '../../../src/types';

export interface ProviderDeliveryResult {
  success: boolean;
  providerMessageId?: string;
  errorCode?: DeliveryErrorClassification | string;
  errorMessage?: string;
  shouldRetry?: boolean;
}

export interface NotificationProviderInterface {
  readonly id: string;
  readonly name: string;
  readonly channel: NotificationChannel;

  isConfigured(): boolean;
  healthCheck(): Promise<{
    status: ProviderHealthState;
    message: string;
    details?: Record<string, any>;
  }>;
  send(
    notification: Notification,
    attempt: DeliveryAttempt
  ): Promise<ProviderDeliveryResult>;
}
