import { StickerItem, StickerPack } from '../../src/types';

export class StickerService {
  private cryptoPack: StickerPack = {
    id: 'pack_crypto_curated',
    name: 'Crypto Intelligence Curated Pack',
    description: 'Official terminal stickers for professional community interactions',
    active: true,
    stickers: [
      { id: 'stk_bull', packId: 'pack_crypto_curated', name: 'Bull', emoji: '🐂', label: 'BULLISH RUN', active: true, createdAt: Date.now() },
      { id: 'stk_bear', packId: 'pack_crypto_curated', name: 'Bear', emoji: '🐻', label: 'BEAR MARKET', active: true, createdAt: Date.now() },
      { id: 'stk_whale', packId: 'pack_crypto_curated', name: 'Whale', emoji: '🐋', label: 'WHALE INCOMING', active: true, createdAt: Date.now() },
      { id: 'stk_moon', packId: 'pack_crypto_curated', name: 'Moon', emoji: '🚀', label: 'TO THE MOON', active: true, createdAt: Date.now() },
      { id: 'stk_rekt', packId: 'pack_crypto_curated', name: 'Rekt', emoji: '💥', label: 'REKT ALERT', active: true, createdAt: Date.now() },
      { id: 'stk_gm', packId: 'pack_crypto_curated', name: 'GM', emoji: '☕', label: 'GM TRADERS', active: true, createdAt: Date.now() },
      { id: 'stk_gn', packId: 'pack_crypto_curated', name: 'GN', emoji: '🌙', label: 'GN FAMILY', active: true, createdAt: Date.now() },
      { id: 'stk_pump', packId: 'pack_crypto_curated', name: 'Pump', emoji: '📈', label: 'PUMP IT', active: true, createdAt: Date.now() },
      { id: 'stk_dump', packId: 'pack_crypto_curated', name: 'Dump', emoji: '📉', label: 'DUMP IT', active: true, createdAt: Date.now() },
      { id: 'stk_fomo', packId: 'pack_crypto_curated', name: 'FOMO', emoji: '😱', label: 'MAX FOMO', active: true, createdAt: Date.now() },
      { id: 'stk_dyor', packId: 'pack_crypto_curated', name: 'DYOR', emoji: '🔍', label: 'DYOR ALWAYS', active: true, createdAt: Date.now() },
      { id: 'stk_diamond_hands', packId: 'pack_crypto_curated', name: 'Diamond Hands', emoji: '💎', label: 'DIAMOND HANDS', active: true, createdAt: Date.now() },
      { id: 'stk_paper_hands', packId: 'pack_crypto_curated', name: 'Paper Hands', emoji: '🧻', label: 'PAPER HANDS', active: true, createdAt: Date.now() },
      { id: 'stk_liquidated', packId: 'pack_crypto_curated', name: 'Liquidated', emoji: '⚡', label: 'LIQUIDATED', active: true, createdAt: Date.now() },
      { id: 'stk_lfg', packId: 'pack_crypto_curated', name: 'LFG', emoji: '🔥', label: 'LFG TRADERS', active: true, createdAt: Date.now() }
    ]
  };

  public getPacks(): StickerPack[] {
    return [this.cryptoPack];
  }

  public getStickerById(stickerId: string): StickerItem | null {
    for (const s of this.cryptoPack.stickers) {
      if (s.id === stickerId && s.active) return s;
    }
    return null;
  }

  public isValidSticker(stickerId: string): boolean {
    return this.getStickerById(stickerId) !== null;
  }

  public toggleSticker(stickerId: string, active: boolean): boolean {
    const s = this.cryptoPack.stickers.find(item => item.id === stickerId);
    if (s) {
      s.active = active;
      return true;
    }
    return false;
  }
}

export const stickerService = new StickerService();
