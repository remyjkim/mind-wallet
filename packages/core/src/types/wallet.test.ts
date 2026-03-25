// packages/core/src/types/wallet.test.ts
import { describe, it, expect } from 'vitest';
import type { WalletAdapter, WalletAccount, SignRequest, MessageRequest } from './wallet.js';

describe('WalletAdapter', () => {
  it('is satisfied by a mock object with the required methods', () => {
    const account: WalletAccount = {
      chainId: 'eip155:8453',
      address: '0xabc',
    };

    const adapter: WalletAdapter = {
      sign: async (_req: SignRequest) => '0xsig',
      signMessage: async (_req: MessageRequest) => '0xmessagesig',
      getAccount: async (_walletId: string, _chainId: string) => account,
      canSign: async (_chainId: string) => true,
    };

    expect(adapter).toBeDefined();
    expect(account.chainId).toBe('eip155:8453');
  });
});
