// ABOUTME: WalletAdapter backed by a raw EVM private key via viem
// ABOUTME: Useful for testing and programmatic use where an OWS vault is not available

import { privateKeyToAccount } from 'viem/accounts';
import type { LocalAccount } from 'viem';
import type { WalletAdapter, WalletAccount, SignRequest, MessageRequest } from '../types/wallet.js';

export interface PrivateKeyAdapterConfig {
  privateKey: `0x${string}`;
  /** CAIP-2 chain IDs this adapter will sign for. Defaults to common EVM chains. */
  chainIds?: string[];
}

const DEFAULT_CHAIN_IDS = [
  'eip155:1',     // Ethereum mainnet
  'eip155:8453',  // Base
  'eip155:4217',  // Tempo mainnet
  'eip155:42431', // Tempo Moderato testnet
];

export class PrivateKeyWalletAdapter implements WalletAdapter {
  private readonly account: LocalAccount;
  private readonly supportedChains: Set<string>;

  constructor(config: PrivateKeyAdapterConfig) {
    this.account = privateKeyToAccount(config.privateKey);
    this.supportedChains = new Set(config.chainIds ?? DEFAULT_CHAIN_IDS);
  }

  async sign(request: SignRequest): Promise<string> {
    return this.account.signTransaction(request.transaction as any);
  }

  async signMessage(request: MessageRequest): Promise<string> {
    const message =
      request.encoding === 'hex'
        ? { raw: request.message as `0x${string}` }
        : request.message;
    return this.account.signMessage({ message });
  }

  async getAccount(_walletId: string, chainId: string): Promise<WalletAccount> {
    return { chainId, address: this.account.address };
  }

  async canSign(chainId: string): Promise<boolean> {
    return this.supportedChains.has(chainId);
  }
}
