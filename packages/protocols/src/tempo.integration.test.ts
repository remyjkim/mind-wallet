// ABOUTME: Integration test for createTempoMethod.createCredential with a real viem account + Tempo RPC
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1, TEST_PRIVATE_KEY, and TEMPO_RPC_URL are set

import { describe, it, expect, beforeAll } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { createTempoMethod } from './tempo.js';

const skip =
  !process.env['RUN_INTEGRATION_TESTS'] ||
  !process.env['TEST_PRIVATE_KEY'] ||
  !process.env['TEMPO_RPC_URL'];

describe.skipIf(skip)('createTempoMethod — createCredential (integration)', () => {
  let method: ReturnType<typeof createTempoMethod>;

  beforeAll(() => {
    const account = privateKeyToAccount(process.env['TEST_PRIVATE_KEY'] as `0x${string}`);
    method = createTempoMethod({ account, rpcUrl: process.env['TEMPO_RPC_URL']! });
  });

  it('returns an Authorization header for a charge intent', async () => {
    const candidate = {
      id: 'c1',
      protocol: 'mpp' as const,
      method,
      normalized: {
        realm: 'https://api.example.com',
        protocol: 'mpp' as const,
        method: 'tempo',
        intent: 'charge' as const,
        amount: 1_000_000n,
        currency: 'USDC',
        hasDigestBinding: false,
      },
      raw: {
        realm: 'https://api.example.com',
        method: 'tempo',
        intent: 'charge',
        amount: '1000000',
        currency: 'USDC',
      },
      eligible: true,
    };

    const headers = await method.createCredential({ candidate, wallet: null as any });
    expect(headers['Authorization']).toBeDefined();
    expect(typeof headers['Authorization']).toBe('string');
    expect((headers['Authorization'] as string).length).toBeGreaterThan(10);
  });
});
