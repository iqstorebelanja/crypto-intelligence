import { WhaleEvent } from '../../src/types';

/**
 * PHASE 22: EXTERNAL DEDUPLICATION SERVICE
 *
 * Computes deterministic keys to discard duplicate provider events.
 * Key precedence:
 *   1. ${provider}:${providerEventId}
 *   2. ${blockchain}:${transactionHash}:${asset}:${amount}:${fromAddress}:${toAddress}
 */
export class ExternalDeduplicationService {
  private seenKeys: Map<string, number> = new Map(); // key -> firstSeenTimestamp
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_ENTRIES = 20000;

  // Telemetry metrics
  private totalReceived = 0;
  private totalProcessed = 0;
  private totalDuplicates = 0;
  private totalRejected = 0;

  /**
   * Generates deterministic deduplication key according to Phase 22 Section E
   */
  public generateKey(event: Partial<WhaleEvent>): string {
    const provider = (event.provider || 'unknown').toLowerCase();
    if (event.providerEventId && event.providerEventId.trim().length > 0) {
      return `${provider}:${event.providerEventId.trim()}`;
    }

    const chain = (event.blockchain || 'unknown').toLowerCase();
    const txHash = (event.transactionHash || 'nohash').toLowerCase();
    const asset = (event.asset || 'unknown').toUpperCase();
    const amount = Number(event.amount || 0).toFixed(4);
    const from = (event.fromAddress || 'unknown').toLowerCase();
    const to = (event.toAddress || 'unknown').toLowerCase();

    return `${chain}:${txHash}:${asset}:${amount}:${from}:${to}`;
  }

  /**
   * Checks if an event is duplicate.
   * If duplicate: returns true.
   * If fresh: stores key, updates telemetry, and returns false.
   */
  public isDuplicate(event: Partial<WhaleEvent>): boolean {
    this.totalReceived++;
    const now = Date.now();

    // Check basic schema sanity before keying (Phase 22 Section Z Untrusted Input Guard)
    if (
      !event.asset ||
      (event.amount !== undefined && (isNaN(event.amount) || event.amount <= 0)) ||
      (event.valueUsd !== undefined && (isNaN(event.valueUsd) || event.valueUsd <= 0)) ||
      (event.timestamp !== undefined && event.timestamp > now + 300_000) ||
      (!event.transactionHash && !event.providerEventId)
    ) {
      this.totalRejected++;
      return true; // Malformed event treated as duplicate/rejected
    }

    const key = this.generateKey(event);
    const existing = this.seenKeys.get(key);

    if (existing && now - existing < this.TTL_MS) {
      this.totalDuplicates++;
      return true;
    }

    // Prune buffer if max limit reached
    if (this.seenKeys.size >= this.MAX_ENTRIES) {
      this.pruneExpired(now);
    }

    this.seenKeys.set(key, now);
    this.totalProcessed++;
    return false;
  }

  /**
   * Cleans up expired entries past TTL
   */
  public pruneExpired(now: number = Date.now()): number {
    let pruned = 0;
    for (const [key, timestamp] of this.seenKeys.entries()) {
      if (now - timestamp > this.TTL_MS) {
        this.seenKeys.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  public getStats(): {
    received: number;
    processed: number;
    duplicates: number;
    rejected: number;
    uniqueKeysStored: number;
  } {
    return {
      received: this.totalReceived,
      processed: this.totalProcessed,
      duplicates: this.totalDuplicates,
      rejected: this.totalRejected,
      uniqueKeysStored: this.seenKeys.size
    };
  }

  public clear(): void {
    this.seenKeys.clear();
    this.totalReceived = 0;
    this.totalProcessed = 0;
    this.totalDuplicates = 0;
    this.totalRejected = 0;
  }
}

export const externalDeduplicationService = new ExternalDeduplicationService();
