// ABOUTME: Unit tests for PrivateKeyWalletAdapter
// ABOUTME: Verifies signing, account derivation, and chain support using a fixed test key

import { describe, it, expect } from 'vitest';
import { PrivateKeyWalletAdapter } from './private-key.js';

// Known test key and expected address (do not use with real funds)
const TEST_PRIVATE_KEY = '0x2cc7b595a1d7b0a8f3e718636d5cf3f4ee6558dbfd5e3a00178d6f03feba5ae6' as `0x${string}`;
const TEST_ADDRESS = '0x06CEd1A4341843D176eD76733aD3f8FcbEF0e606';

describe('PrivateKeyWalletAdapter', () => {
  const adapter = new PrivateKeyWalletAdapter({ privateKey: TEST_PRIVATE_KEY });

  describe('getAccount', () => {
    it('returns the correct address for any chain', async () => {
      const account = await adapter.getAccount('any-wallet', 'eip155:8453');
      expect(account.address).toBe(TEST_ADDRESS);
      expect(account.chainId).toBe('eip155:8453');
    });

    it('reflects the requested chainId', async () => {
      const account = await adapter.getAccount('any-wallet', 'eip155:42431');
      expect(account.chainId).toBe('eip155:42431');
    });
  });

  describe('canSign', () => {
    it('returns true for default EVM chains', async () => {
      expect(await adapter.canSign('eip155:1')).toBe(true);
      expect(await adapter.canSign('eip155:8453')).toBe(true);
      expect(await adapter.canSign('eip155:4217')).toBe(true);
      expect(await adapter.canSign('eip155:42431')).toBe(true);
    });

    it('returns false for unsupported chains', async () => {
      expect(await adapter.canSign('solana:mainnet')).toBe(false);
      expect(await adapter.canSign('eip155:99999')).toBe(false);
    });

    it('respects custom chainIds config', async () => {
      const custom = new PrivateKeyWalletAdapter({
        privateKey: TEST_PRIVATE_KEY,
        chainIds: ['eip155:1'],
      });
      expect(await custom.canSign('eip155:1')).toBe(true);
      expect(await custom.canSign('eip155:8453')).toBe(false);
    });
  });

  describe('signMessage', () => {
    it('returns a hex signature string', async () => {
      const sig = await adapter.signMessage({
        walletId: 'test',
        chainId: 'eip155:1',
        message: 'hello world',
      });
      expect(sig).toMatch(/^0x[0-9a-f]{130}$/i);
    });

    it('signs hex-encoded raw messages', async () => {
      const sig = await adapter.signMessage({
        walletId: 'test',
        chainId: 'eip155:1',
        message: '0xdeadbeef',
        encoding: 'hex',
      });
      expect(sig).toMatch(/^0x[0-9a-f]{130}$/i);
    });

    it('produces deterministic signatures for the same message', async () => {
      const sig1 = await adapter.signMessage({ walletId: 'w', chainId: 'eip155:1', message: 'test' });
      const sig2 = await adapter.signMessage({ walletId: 'w', chainId: 'eip155:1', message: 'test' });
      expect(sig1).toBe(sig2);
    });
  });
});
