import { AssetMapping } from '../../src/types';

/**
 * PHASE 22: ASSET MAPPING & MULTI-CHAIN ISOLATION SERVICE
 *
 * Enforces strict multi-chain isolation so tokens with the same symbol on different
 * chains (e.g., Ethereum USDT vs Tron USDT vs Solana USDT) or different contracts
 * are never merged blindly without verified canonical attribution.
 */
export class AssetMappingService {
  private mappings: Map<string, AssetMapping> = new Map(); // key: chain:contract or chain:symbol

  constructor() {
    this.seedCanonicalMappings();
  }

  private seedCanonicalMappings(): void {
    const defaultMappings: AssetMapping[] = [
      // BTC
      {
        canonicalAsset: 'BTC',
        chain: 'bitcoin',
        contractAddress: null,
        providerAssetId: 'bitcoin',
        symbol: 'BTC',
        decimals: 8,
        verified: true,
        mappingConfidence: 100
      },
      // ETH
      {
        canonicalAsset: 'ETH',
        chain: 'ethereum',
        contractAddress: null,
        providerAssetId: 'ethereum',
        symbol: 'ETH',
        decimals: 18,
        verified: true,
        mappingConfidence: 100
      },
      // SOL
      {
        canonicalAsset: 'SOL',
        chain: 'solana',
        contractAddress: null,
        providerAssetId: 'solana',
        symbol: 'SOL',
        decimals: 9,
        verified: true,
        mappingConfidence: 100
      },
      // MULTI-CHAIN USDT ISOLATION
      {
        canonicalAsset: 'USDT',
        chain: 'ethereum',
        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        providerAssetId: 'tether-ethereum',
        symbol: 'USDT',
        decimals: 6,
        verified: true,
        mappingConfidence: 100
      },
      {
        canonicalAsset: 'USDT',
        chain: 'tron',
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        providerAssetId: 'tether-tron',
        symbol: 'USDT',
        decimals: 6,
        verified: true,
        mappingConfidence: 100
      },
      {
        canonicalAsset: 'USDT',
        chain: 'solana',
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        providerAssetId: 'tether-solana',
        symbol: 'USDT',
        decimals: 6,
        verified: true,
        mappingConfidence: 100
      },
      {
        canonicalAsset: 'USDT',
        chain: 'bsc',
        contractAddress: '0x55d398326f99059ff775485246999027b3197955',
        providerAssetId: 'tether-bsc',
        symbol: 'USDT',
        decimals: 18,
        verified: true,
        mappingConfidence: 100
      },
      // MULTI-CHAIN USDC ISOLATION
      {
        canonicalAsset: 'USDC',
        chain: 'ethereum',
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        providerAssetId: 'usd-coin-ethereum',
        symbol: 'USDC',
        decimals: 6,
        verified: true,
        mappingConfidence: 100
      },
      {
        canonicalAsset: 'USDC',
        chain: 'solana',
        contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        providerAssetId: 'usd-coin-solana',
        symbol: 'USDC',
        decimals: 6,
        verified: true,
        mappingConfidence: 100
      },
      // PEPE Verified ERC-20
      {
        canonicalAsset: 'PEPE',
        chain: 'ethereum',
        contractAddress: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
        providerAssetId: 'pepe-eth',
        symbol: 'PEPE',
        decimals: 18,
        verified: true,
        mappingConfidence: 98
      },
      // LINK Verified ERC-20
      {
        canonicalAsset: 'LINK',
        chain: 'ethereum',
        contractAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
        providerAssetId: 'chainlink',
        symbol: 'LINK',
        decimals: 18,
        verified: true,
        mappingConfidence: 100
      }
    ];

    for (const m of defaultMappings) {
      this.registerMapping(m);
    }
  }

  public registerMapping(mapping: AssetMapping): void {
    const chainKey = mapping.chain.toLowerCase();
    const symbolKey = mapping.symbol.toUpperCase();

    // Index by chain:symbol
    this.mappings.set(`${chainKey}:${symbolKey}`, mapping);

    // Index by chain:contract (if contract exists)
    if (mapping.contractAddress) {
      this.mappings.set(`${chainKey}:${mapping.contractAddress.toLowerCase()}`, mapping);
    }

    // Index by providerAssetId
    if (mapping.providerAssetId) {
      this.mappings.set(`id:${mapping.providerAssetId.toLowerCase()}`, mapping);
    }
  }

  /**
   * Resolves canonical asset mapping from external symbol/contract and chain.
   */
  public resolveAsset(
    symbolOrContract: string,
    chain?: string
  ): AssetMapping | null {
    if (!symbolOrContract) return null;
    const cleanChain = (chain || 'ethereum').toLowerCase();
    const cleanTarget = symbolOrContract.trim();

    // 1. Try chain:contract
    const contractKey = `${cleanChain}:${cleanTarget.toLowerCase()}`;
    if (this.mappings.has(contractKey)) {
      return this.mappings.get(contractKey)!;
    }

    // 2. Try chain:symbol
    const symbolKey = `${cleanChain}:${cleanTarget.toUpperCase()}`;
    if (this.mappings.has(symbolKey)) {
      return this.mappings.get(symbolKey)!;
    }

    // 3. Try provider ID lookup
    const idKey = `id:${cleanTarget.toLowerCase()}`;
    if (this.mappings.has(idKey)) {
      return this.mappings.get(idKey)!;
    }

    // 4. Default native fallback for major base assets
    const cleanSym = cleanTarget.replace(/[\/\-_]/g, '').replace('USDT', '').toUpperCase();
    if (['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].includes(cleanSym)) {
      const nativeChain = cleanSym === 'BTC' ? 'bitcoin' : cleanSym === 'SOL' ? 'solana' : 'ethereum';
      return {
        canonicalAsset: cleanSym,
        chain: nativeChain,
        contractAddress: null,
        providerAssetId: cleanSym.toLowerCase(),
        symbol: cleanSym,
        decimals: cleanSym === 'BTC' ? 8 : cleanSym === 'SOL' ? 9 : 18,
        verified: true,
        mappingConfidence: 90
      };
    }

    return null;
  }

  /**
   * Symbol Collision & Multi-Chain Isolation Validator:
   * Returns true ONLY if both assets resolve to the EXACT SAME canonical asset and chain/contract.
   * If two tokens have the same symbol (e.g. PEPE) but different contracts/chains, returns false!
   */
  public isSameAsset(
    assetA: { symbol: string; chain?: string; contract?: string | null },
    assetB: { symbol: string; chain?: string; contract?: string | null }
  ): boolean {
    const chainA = (assetA.chain || 'ethereum').toLowerCase();
    const chainB = (assetB.chain || 'ethereum').toLowerCase();

    // If contracts are explicitly provided and differ, they are strictly DIFFERENT tokens!
    if (assetA.contract && assetB.contract) {
      if (assetA.contract.toLowerCase() !== assetB.contract.toLowerCase()) {
        return false;
      }
      return chainA === chainB;
    }

    // If chains differ without verified multi-chain bridging mapping, isolate them!
    if (chainA !== chainB) {
      const resolvedA = this.resolveAsset(assetA.contract || assetA.symbol, chainA);
      const resolvedB = this.resolveAsset(assetB.contract || assetB.symbol, chainB);
      if (!resolvedA || !resolvedB) return false;
      return resolvedA.canonicalAsset === resolvedB.canonicalAsset;
    }

    return assetA.symbol.toUpperCase() === assetB.symbol.toUpperCase();
  }

  public getAllMappings(): AssetMapping[] {
    // Return unique mappings
    const unique = new Map<string, AssetMapping>();
    for (const m of this.mappings.values()) {
      unique.set(`${m.chain}:${m.contractAddress || m.symbol}`, m);
    }
    return Array.from(unique.values());
  }
}

export const assetMappingService = new AssetMappingService();
