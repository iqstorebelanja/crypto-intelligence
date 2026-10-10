import crypto from 'crypto';
import { db } from '../db/schema';
import { User, Alert, AlertEvent, Notification } from '../../src/types';

export interface DatabaseBackupRecord {
  backupId: string;
  version: string;
  timestamp: number;
  createdAt: string;
  triggeredBy: string;
  recordCounts: {
    users: number;
    watchlists: number;
    alerts: number;
    alertEvents: number;
    notifications: number;
    auditLogs: number;
  };
  checksum: string;
  payload: {
    users: User[];
    watchlists: Array<{ userId: string; symbols: string[] }>;
    alerts: Array<{ userId: string; alerts: Alert[] }>;
    alertEvents: Array<{ userId: string; events: AlertEvent[] }>;
    notifications: Notification[];
    trialSettings: any;
    subscriptionConfig: any;
  };
}

export interface BackupSummary {
  backupId: string;
  version: string;
  timestamp: number;
  createdAt: string;
  triggeredBy: string;
  recordCounts: {
    users: number;
    watchlists: number;
    alerts: number;
    alertEvents: number;
    notifications: number;
    auditLogs: number;
  };
  checksum: string;
  sizeBytes: number;
}

export class DatabaseBackupService {
  private backups: Map<string, DatabaseBackupRecord> = new Map();
  private maxRetainedBackups: number = 10;
  private backupTimer: NodeJS.Timeout | null = null;
  private isBackupRunning: boolean = false;

  constructor() {
    // Generate initial baseline backup on service startup
    try {
      this.createBackup('system_startup');
    } catch {
      // Graceful fallback
    }
  }

  /**
   * Start scheduled automated backup cycle (default: every 6 hours)
   */
  public startScheduledBackups(intervalMs: number = 6 * 60 * 60 * 1000): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
    this.backupTimer = setInterval(() => {
      try {
        this.createBackup('scheduled_cron');
      } catch (err: any) {
        console.error('[BackupService] Scheduled backup error:', err.message);
      }
    }, intervalMs);
  }

  /**
   * Stop scheduled backups on graceful shutdown
   */
  public stopScheduledBackups(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }

  /**
   * Create an instantaneous, consistent snapshot of database state
   */
  public createBackup(triggeredBy: string = 'admin'): DatabaseBackupRecord {
    if (this.isBackupRunning) {
      throw new Error('A database backup operation is already in progress.');
    }
    this.isBackupRunning = true;

    try {
      const usersList: User[] = Array.from(db.users.values()).map(u => ({ ...u }));
      
      const watchlistsList: Array<{ userId: string; symbols: string[] }> = [];
      for (const [userId, set] of db.watchlists.entries()) {
        watchlistsList.push({ userId, symbols: Array.from(set) });
      }

      const alertsList: Array<{ userId: string; alerts: Alert[] }> = [];
      for (const [userId, aList] of db.alerts.entries()) {
        alertsList.push({ userId, alerts: aList.map(a => ({ ...a })) });
      }

      const alertEventsList: Array<{ userId: string; events: AlertEvent[] }> = [];
      for (const [userId, eList] of db.alertEvents.entries()) {
        alertEventsList.push({ userId, events: eList.map(e => ({ ...e })) });
      }

      const notifsList: Notification[] = [];
      for (const list of db.notifications.values()) {
        notifsList.push(...list.map(n => ({ ...n })));
      }
      const trialSettings = db.getTrialSettings();
      const subscriptionConfig = db.getSubscriptionConfig();
      const subscriptionsList = Array.from(db.subscriptions.values()).map(s => ({ ...s }));
      const paymentEventsList = Array.from(db.paymentEvents.values()).map(pe => ({ ...pe }));

      const payload = {
        users: usersList,
        watchlists: watchlistsList,
        alerts: alertsList,
        alertEvents: alertEventsList,
        notifications: notifsList,
        trialSettings,
        subscriptionConfig,
        subscriptions: subscriptionsList,
        paymentEvents: paymentEventsList
      };

      const serialized = JSON.stringify(payload);
      const checksum = crypto.createHash('sha256').update(serialized).digest('hex');

      const now = Date.now();
      const backupId = `bkp_${now}_${Math.random().toString(36).substring(2, 6)}`;

      const record: DatabaseBackupRecord = {
        backupId,
        version: '1.0.0',
        timestamp: now,
        createdAt: new Date(now).toISOString(),
        triggeredBy,
        recordCounts: {
          users: usersList.length,
          watchlists: watchlistsList.length,
          alerts: alertsList.length,
          alertEvents: alertEventsList.length,
          notifications: notifsList.length,
          auditLogs: db.getAdminAuditLogs(100).length
        },
        checksum,
        payload
      };

      this.backups.set(backupId, record);

      // Enforce retention policy: prune oldest backups beyond limit
      if (this.backups.size > this.maxRetainedBackups) {
        const sorted = Array.from(this.backups.values()).sort((a, b) => a.timestamp - b.timestamp);
        const toDeleteCount = sorted.length - this.maxRetainedBackups;
        for (let i = 0; i < toDeleteCount; i++) {
          this.backups.delete(sorted[i].backupId);
        }
      }

      db.addAdminAuditLog(
        triggeredBy,
        'CREATE_DATABASE_BACKUP',
        backupId,
        {
          backupId,
          recordCounts: record.recordCounts,
          checksum: record.checksum
        }
      );

      return record;
    } finally {
      this.isBackupRunning = false;
    }
  }

  /**
   * List all available backups with summary telemetry
   */
  public listBackups(): BackupSummary[] {
    const list = Array.from(this.backups.values()).sort((a, b) => b.timestamp - a.timestamp);
    return list.map(b => ({
      backupId: b.backupId,
      version: b.version,
      timestamp: b.timestamp,
      createdAt: b.createdAt,
      triggeredBy: b.triggeredBy,
      recordCounts: b.recordCounts,
      checksum: b.checksum,
      sizeBytes: JSON.stringify(b.payload).length
    }));
  }

  /**
   * Get specific backup by ID
   */
  public getBackup(backupId: string): DatabaseBackupRecord | null {
    return this.backups.get(backupId) || null;
  }

  /**
   * Restore database from snapshot with strict verification
   */
  public restoreBackup(backupId: string, performedBy: string = 'admin'): {
    success: boolean;
    restoredAt: number;
    recordCounts: DatabaseBackupRecord['recordCounts'];
    message: string;
  } {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup record ${backupId} not found in repository.`);
    }

    // Integrity check
    const serialized = JSON.stringify(backup.payload);
    const calculatedChecksum = crypto.createHash('sha256').update(serialized).digest('hex');
    if (calculatedChecksum !== backup.checksum) {
      throw new Error('Backup integrity failure: checksum mismatch. Restore operation aborted.');
    }

    // Apply users
    if (Array.isArray(backup.payload.users)) {
      for (const user of backup.payload.users) {
        db.users.set(user.id, user);
        db.idx_users_by_email.set(user.email.toLowerCase(), user.id);
        if (user.username) {
          db.idx_users_by_username.set(user.username.toLowerCase(), user.id);
        }
      }
    }

    // Apply watchlists
    if (Array.isArray(backup.payload.watchlists)) {
      for (const w of backup.payload.watchlists) {
        db.watchlists.set(w.userId, new Set(w.symbols));
      }
    }

    // Apply alerts
    if (Array.isArray(backup.payload.alerts)) {
      for (const a of backup.payload.alerts) {
        db.alerts.set(a.userId, a.alerts);
      }
    }

    // Apply alert events
    if (Array.isArray(backup.payload.alertEvents)) {
      for (const e of backup.payload.alertEvents) {
        db.alertEvents.set(e.userId, e.events);
      }
    }

    // Apply notifications
    if (Array.isArray(backup.payload.notifications)) {
      for (const n of backup.payload.notifications) {
        db.addNotification(n);
      }
    }

    // Apply trial settings & subscription config
    if (backup.payload.trialSettings) {
      db.updateTrialSettings(backup.payload.trialSettings, performedBy);
    }
    if (backup.payload.subscriptionConfig) {
      db.updateSubscriptionConfig(backup.payload.subscriptionConfig, performedBy);
    }

    // Apply subscriptions & paymentEvents
    if (Array.isArray((backup.payload as any).subscriptions)) {
      for (const s of (backup.payload as any).subscriptions) {
        db.saveSubscription(s);
      }
    }
    if (Array.isArray((backup.payload as any).paymentEvents)) {
      for (const pe of (backup.payload as any).paymentEvents) {
        db.savePaymentEvent(pe);
      }
    }

    db.addAdminAuditLog(
      performedBy,
      'RESTORE_DATABASE_BACKUP',
      backupId,
      {
        backupId,
        restoredRecords: backup.recordCounts,
        checksum: backup.checksum
      }
    );

    return {
      success: true,
      restoredAt: Date.now(),
      recordCounts: backup.recordCounts,
      message: `Database successfully restored from snapshot ${backupId}.`
    };
  }

  /**
   * Health status for monitoring
   */
  public getHealth(): {
    status: 'HEALTHY' | 'DEGRADED';
    totalBackups: number;
    latestBackup: BackupSummary | null;
    retentionLimit: number;
    schedulerActive: boolean;
  } {
    const list = this.listBackups();
    return {
      status: 'HEALTHY',
      totalBackups: list.length,
      latestBackup: list.length > 0 ? list[0] : null,
      retentionLimit: this.maxRetainedBackups,
      schedulerActive: Boolean(this.backupTimer)
    };
  }
}

export const databaseBackupService = new DatabaseBackupService();
