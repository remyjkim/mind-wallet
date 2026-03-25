// packages/core/src/wallet/ows.test.ts
import { describe, it, expect } from 'vitest';
import { OwsWalletAdapter } from './ows.js';

// Unit tests cover only pure logic that does not call OWS.
// Real OWS vault integration tests live in ows.integration.test.ts (Task 7b).

describe('OwsWalletAdapter — canSign', () => {
  const adapter = new OwsWalletAdapter({
    walletId: 'test-wallet',
    vaultPath: '/tmp/does-not-matter-for-this-test',
    // passphrase omitted intentionally — not needed for canSign
  });

  it('returns true for Base (eip155:8453)', async () => {
    expect(await adapter.canSign('eip155:8453')).toBe(true);
  });

  it('returns true for Tempo (eip155:65536)', async () => {
    expect(await adapter.canSign('eip155:65536')).toBe(true);
  });

  it('returns true for Solana mainnet', async () => {
    expect(await adapter.canSign('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBe(true);
  });

  it('returns false for Ethereum mainnet (not in allowed set)', async () => {
    expect(await adapter.canSign('eip155:1')).toBe(false);
  });

  it('returns false for an unknown chain', async () => {
    expect(await adapter.canSign('cosmos:cosmoshub-4')).toBe(false);
  });
});

describe('OwsWalletAdapter — implements WalletAdapter interface', () => {
  it('has all required methods', () => {
    const adapter = new OwsWalletAdapter({ walletId: 'w', vaultPath: '/tmp/v' });
    expect(typeof adapter.sign).toBe('function');
    expect(typeof adapter.signMessage).toBe('function');
    expect(typeof adapter.getAccount).toBe('function');
    expect(typeof adapter.canSign).toBe('function');
  });
});
