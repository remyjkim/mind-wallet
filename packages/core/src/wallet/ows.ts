// ABOUTME: WalletAdapter implementation backed by Open Wallet Standard Node.js bindings
// ABOUTME: passphrase is optional; omit it to use OWS_PASSPHRASE env var (e.g. in tests)

import {
  signMessage,
  signTransaction,
  getWallet,
} from '@open-wallet-standard/core';
import type {
  WalletAdapter, WalletAccount, SignRequest, MessageRequest
} from '../types/wallet.js';

// Chains this adapter is permitted to sign for.
const SUPPORTED_CHAINS = new Set([
  'eip155:8453',          // Base
  'eip155:65536',         // Tempo
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana mainnet
]);

export interface OwsAdapterConfig {
  walletId: string;
  vaultPath: string;    // e.g. ~/.minds/wallet/vault
  passphrase?: string;  // wallet passphrase; if omitted, OWS reads OWS_PASSPHRASE env var
}

export class OwsWalletAdapter implements WalletAdapter {
  constructor(private readonly config: OwsAdapterConfig) {}

  async sign(request: SignRequest): Promise<string> {
    const result = signTransaction(
      request.walletId,
      request.chainId,
      String(request.transaction),
      this.config.passphrase,
      0,
      this.config.vaultPath,
    );
    const hex = result.signature;
    return hex.startsWith('0x') ? hex : `0x${hex}`;
  }

  async signMessage(request: MessageRequest): Promise<string> {
    const result = signMessage(
      request.walletId,
      request.chainId,
      request.message,
      this.config.passphrase,
      request.encoding ?? 'utf8',
      request.accountIndex ?? 0,
      this.config.vaultPath,
    );
    const hex = result.signature;
    return hex.startsWith('0x') ? hex : `0x${hex}`;
  }

  async getAccount(walletId: string, chainId: string): Promise<WalletAccount> {
    const wallet = getWallet(walletId, this.config.vaultPath);
    // Try exact match first; fall back to same CAIP-2 namespace (e.g. any eip155:* for Base/Tempo)
    const namespace = chainId.split(':')[0];
    const account =
      wallet.accounts.find(a => a.chainId === chainId) ??
      wallet.accounts.find(a => a.chainId.startsWith(`${namespace}:`));
    if (!account) {
      throw new Error(`No account for chain ${chainId} in wallet ${walletId}`);
    }
    // Return with the requested chainId so callers see the chain they asked for
    return { chainId, address: account.address };
  }

  async canSign(chainId: string): Promise<boolean> {
    return SUPPORTED_CHAINS.has(chainId);
  }
}
