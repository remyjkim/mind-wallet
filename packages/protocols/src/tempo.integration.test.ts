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
    // gas is provided to skip eth_estimateGas — the test wallet has no USD balance on the
    // testnet, but we can still verify that createCredential produces a valid signed credential.
    method = createTempoMethod({ account, rpcUrl: process.env['TEMPO_RPC_URL']!, gas: 200_000n });
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
        currency: '0x20c0000000000000000000000000000000000000',
        hasDigestBinding: false,
      },
      // request fields mirror the on-chain MPP challenge structure:
      // amount    — transfer amount in token base units (string)
      // recipient — payee address (0x-prefixed)
      // currency  — ERC-20 token contract address on the Tempo chain
      // chainId   — 42431 = Moderato testnet; omit for mainnet (4217)
      raw: {
        realm: 'https://api.example.com',
        method: 'tempo',
        intent: 'charge',
        amount: '1000000',
        recipient: '0x0000000000000000000000000000000000000001' as `0x${string}`,
        currency: '0x20c0000000000000000000000000000000000000' as `0x${string}`,
        chainId: 42431,
      },
      eligible: true,
    };

    const headers = await method.createCredential({ candidate, wallet: null as any });
    expect(headers['Authorization']).toBeDefined();
    expect(typeof headers['Authorization']).toBe('string');
    expect((headers['Authorization'] as string).length).toBeGreaterThan(10);
  });

  it('supports chainId nested under methodDetails for charge intents', async () => {
    const candidate = {
      id: 'c2',
      protocol: 'mpp' as const,
      method,
      normalized: {
        realm: 'https://api.example.com',
        protocol: 'mpp' as const,
        method: 'tempo',
        intent: 'charge' as const,
        amount: 1_000_000n,
        currency: '0x20c0000000000000000000000000000000000000',
        hasDigestBinding: false,
      },
      raw: {
        realm: 'https://api.example.com',
        method: 'tempo',
        intent: 'charge',
        amount: '1000000',
        recipient: '0x0000000000000000000000000000000000000001' as `0x${string}`,
        currency: '0x20c0000000000000000000000000000000000000' as `0x${string}`,
        methodDetails: {
          chainId: 42431,
        },
      },
      eligible: true,
    };

    const headers = await method.createCredential({ candidate, wallet: null as any });
    expect(headers['Authorization']).toBeDefined();
    expect(typeof headers['Authorization']).toBe('string');
    expect((headers['Authorization'] as string).length).toBeGreaterThan(10);
  });
});
