import { ExternalEvidence, ExternalEvidenceCategory } from '../../src/types';

export class EvidenceStore {
  private store: Map<string, ExternalEvidence[]> = new Map(); // asset -> ExternalEvidence[]
  private readonly MAX_PER_ASSET = 50;

  public addEvidence(evidence: ExternalEvidence): void {
    const list = this.store.get(evidence.asset) || [];
    // Deduplicate by ID
    const exists = list.some(e => e.id === evidence.id);
    if (!exists) {
      list.unshift(evidence);
      if (list.length > this.MAX_PER_ASSET) {
        list.length = this.MAX_PER_ASSET;
      }
      this.store.set(evidence.asset, list);
    }
  }

  public addBatch(evidences: ExternalEvidence[]): void {
    for (const ev of evidences) {
      this.addEvidence(ev);
    }
  }

  public getEvidenceForAsset(
    asset: string,
    category?: ExternalEvidenceCategory,
    minConfidence: number = 50
  ): ExternalEvidence[] {
    const clean = asset.toUpperCase();
    const list = this.store.get(clean) || [];
    return list.filter(e => {
      if (category && e.category !== category) return false;
      if (e.confidence < minConfidence) return false;
      return true;
    });
  }

  public getAllRecent(limit: number = 30): ExternalEvidence[] {
    const all: ExternalEvidence[] = [];
    for (const list of this.store.values()) {
      all.push(...list);
    }
    all.sort((a, b) => b.timestamp - a.timestamp);
    return all.slice(0, limit);
  }

  public clear(): void {
    this.store.clear();
  }
}

export const evidenceStore = new EvidenceStore();
