import {
  AlertSeverity,
  Notification,
  NotificationHealthSummary,
  UserNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES
} from '../types';

export interface AlertHistoryItem {
  id: string;
  timestamp: number;
  symbol: string;
  exchange: string;
  timeframe: string;
  category: string;
  type: string;
  title: string;
  triggerPrice?: number;
  status: string;
  deepLink?: string;
  deliveryAttempts: Array<{
    channel: string;
    status: string;
    provider: string;
    completedAt?: number;
    errorMessage?: string;
  }>;
}

export class ClientNotificationService {
  /**
   * Fetches user notifications
   */
  public async getNotifications(
    token?: string | null,
    filters?: { categoryGroup?: string; unreadOnly?: boolean; limit?: number }
  ): Promise<{ notifications: Notification[]; unreadCount: number }> {
    try {
      const params = new URLSearchParams();
      if (filters?.categoryGroup) params.set('categoryGroup', filters.categoryGroup);
      if (filters?.unreadOnly) params.set('unreadOnly', 'true');
      if (filters?.limit) params.set('limit', String(filters.limit));

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/notifications?${params.toString()}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return { notifications: [], unreadCount: 0 };
    }
  }

  /**
   * Fast unread count poll
   */
  public async getUnreadCount(token?: string | null): Promise<number> {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/notifications/unread-count', { headers });
      if (res.ok) {
        const data = await res.json();
        return data.unreadCount ?? 0;
      }
    } catch {
      // fallback
    }
    return 0;
  }

  /**
   * Mark single notification read / unread
   */
  public async markRead(token: string | null, id: string, read: boolean = true): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ read })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Mark all read
   */
  public async markAllRead(token?: string | null): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete / archive notification
   */
  public async deleteNotification(token: string | null, id: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Preferences
   */
  public async getPreferences(token?: string | null): Promise<UserNotificationPreferences> {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/notifications/preferences', { headers });
      if (res.ok) {
        const data = await res.json();
        return data.preferences || data;
      }
    } catch {
      // fallback
    }
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  public async savePreferences(
    token: string | null,
    updates: Partial<UserNotificationPreferences>
  ): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Web Push Registration
   */
  public async registerWebPush(
    token: string | null,
    subscription: PushSubscription,
    browserMetadata?: string
  ): Promise<boolean> {
    try {
      const jsonSub = subscription.toJSON();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: jsonSub.keys,
          browserMetadata: browserMetadata || navigator.userAgent
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Web Push Unregistration
   */
  public async unregisterWebPush(
    token: string | null,
    endpoint: string
  ): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/notifications/push/unsubscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ endpoint })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Alert History
   */
  public async getHistory(token?: string | null): Promise<AlertHistoryItem[]> {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/notifications/history', { headers });
      if (res.ok) {
        const data = await res.json();
        return data.history || [];
      }
    } catch {
      // fallback
    }
    return [];
  }

  /**
   * Admin Health
   */
  public async getAdminHealth(token: string | null): Promise<{
    health: NotificationHealthSummary | null;
    logs: any[];
  }> {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/admin/notifications/health', { headers });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback
    }
    return { health: null, logs: [] };
  }

  /**
   * Admin Failed Deliveries
   */
  public async getAdminFailures(token: string | null): Promise<any[]> {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/admin/notifications/failures', { headers });
      if (res.ok) {
        const data = await res.json();
        return data.failures || [];
      }
    } catch {
      // fallback
    }
    return [];
  }

  /**
   * Admin Retry
   */
  public async retryDelivery(token: string | null, attemptId: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/admin/notifications/retry', {
        method: 'POST',
        headers,
        body: JSON.stringify({ attemptId })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Test dispatch
   */
  public async sendTest(token: string | null, category?: string, symbol?: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers,
        body: JSON.stringify({ category, symbol })
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const clientNotificationService = new ClientNotificationService();
