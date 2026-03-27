// packages/core/src/wallet/ows.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWallet, listWallets } from '@open-wallet-standard/core';
import { OwsWalletAdapter } from './ows.js';

// Skip entire suite when OWS_PASSPHRASE is not set.
// Run locally with: OWS_PASSPHRASE=test-passphrase bun x vitest run src/wallet/ows.integration.test.ts
const skip = !process.env.OWS_PASSPHRASE;

describe.skipIf(skip)('OwsWalletAdapter — local vault integration', () => {
  let vaultPath: string;

  beforeAll(() => {
    // Create an isolated temp vault for this test run
    vaultPath = mkdtempSync(join(tmpdir(), 'mindwallet-ows-test-'));
    // Create a test wallet using the real OWS Node SDK
    createWallet('test-wallet', undefined, 12, vaultPath);
  });

  afterAll(() => {
    // Clean up temp vault — contains no real funds
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('wallet is visible in listWallets after creation', () => {
    const wallets = listWallets(vaultPath);
    const found = (wallets as Array<{ name: string }>).find(w => w.name === 'test-wallet');
    expect(found).toBeDefined();
  });

  it('signMessage returns a valid EVM signature (0x + 130 hex chars)', async () => {
    const adapter = new OwsWalletAdapter({
      walletId: 'test-wallet',
      vaultPath,
      // No agentToken — uses OWS_PASSPHRASE env var
    });

    const sig = await adapter.signMessage({
      walletId: 'test-wallet',
      chainId: 'eip155:8453',
      message: 'hello from mindwallet integration test',
    });

    // EVM personal_sign produces a 65-byte signature: 0x + 130 hex chars
    expect(sig).toMatch(/^0x[0-9a-fA-F]{130}$/);
  });

  it('getAccount returns a checksummed EVM address for Base', async () => {
    const adapter = new OwsWalletAdapter({
      walletId: 'test-wallet',
      vaultPath,
    });

    const account = await adapter.getAccount('test-wallet', 'eip155:8453');
    expect(account.chainId).toBe('eip155:8453');
    // EVM address: 0x + 40 hex chars
    expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('signing with the same wallet twice produces a deterministic signature', async () => {
    const adapter = new OwsWalletAdapter({ walletId: 'test-wallet', vaultPath });
    const msg = 'determinism check';

    const sig1 = await adapter.signMessage({ walletId: 'test-wallet', chainId: 'eip155:8453', message: msg });
    const sig2 = await adapter.signMessage({ walletId: 'test-wallet', chainId: 'eip155:8453', message: msg });

    // EVM ECDSA signing is deterministic for the same key + message
    expect(sig1).toBe(sig2);
  });

  it('throws when wallet does not exist in vault', async () => {
    const adapter = new OwsWalletAdapter({ walletId: 'nonexistent-wallet', vaultPath });

    await expect(
      adapter.getAccount('nonexistent-wallet', 'eip155:8453')
    ).rejects.toThrow();
  });

  it('canSign is independent of vault — returns true for supported chains regardless', async () => {
    const adapter = new OwsWalletAdapter({ walletId: 'test-wallet', vaultPath });
    // canSign does not call OWS — verified here for completeness alongside real adapter
    expect(await adapter.canSign('eip155:8453')).toBe(true);
    expect(await adapter.canSign('eip155:1')).toBe(false);
  });
});
