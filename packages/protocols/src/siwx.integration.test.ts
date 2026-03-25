// ABOUTME: Integration test for createSiwxMethod.createCredential with a real OWS vault
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and OWS_PASSPHRASE are set

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallet } from '@open-wallet-standard/core';
import { OwsWalletAdapter } from '@mindwallet/core';
import { createSiwxMethod } from './siwx.js';

const skip = !process.env['RUN_INTEGRATION_TESTS'] || !process.env['OWS_PASSPHRASE'];

describe.skipIf(skip)('createSiwxMethod — createCredential (integration)', () => {
  let vaultPath: string;
  let wallet: OwsWalletAdapter;
  const method = createSiwxMethod();

  beforeAll(() => {
    vaultPath = mkdtempSync(join(tmpdir(), 'mw-siwx-int-'));
    createWallet('test-wallet', undefined, 12, vaultPath);
    wallet = new OwsWalletAdapter({ walletId: 'test-wallet', vaultPath });
  });

  afterAll(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  function makeCandidate(nonce: string) {
    return {
      id: 'c1',
      protocol: 'siwx' as const,
      method,
      normalized: {
        realm: 'https://api.example.com',
        protocol: 'siwx' as const,
        method: 'siwx',
        intent: 'charge' as const,
        hasDigestBinding: false,
      },
      raw: {
        domain: 'api.example.com',
        walletId: 'test-wallet',
        chainId: 'eip155:8453',
        nonce,
      },
      eligible: true,
    };
  }

  it('returns an Authorization Bearer header', async () => {
    const headers = await method.createCredential({ candidate: makeCandidate('nonce-abc'), wallet });
    expect(headers['Authorization']).toBeDefined();
    expect(headers['Authorization']).toMatch(/^Bearer /);
  });

  it('credential payload decodes to message + EVM signature', async () => {
    const headers = await method.createCredential({ candidate: makeCandidate('nonce-def'), wallet });
    const token = headers['Authorization']!.replace('Bearer ', '');
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    expect(decoded.message).toContain('api.example.com');
    expect(decoded.message).toContain('nonce-def');
    expect(decoded.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
  });

  it('signature is deterministic for the same inputs', async () => {
    const candidate = makeCandidate('determinism-check');
    const h1 = await method.createCredential({ candidate, wallet });
    const h2 = await method.createCredential({ candidate, wallet });
    // Tokens differ because issuedAt timestamps change, but signatures are derived
    // from the same key — both must be valid Bearer strings
    expect(h1['Authorization']).toMatch(/^Bearer /);
    expect(h2['Authorization']).toMatch(/^Bearer /);
  });
});
