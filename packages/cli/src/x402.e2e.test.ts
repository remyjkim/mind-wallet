// ABOUTME: Mainnet end-to-end test for x402 payment flow using a real funded account
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1, TEST_PRIVATE_KEY, and E2E_X402_URL are set

import { describe, it, expect } from 'vitest';
import { PrivateKeyWalletAdapter, createMemoryStore, createRouter, wrapFetch } from '@mindwallet/core';
import { privateKeyToAccount } from 'viem/accounts';
import { createX402Method } from '@mindwallet/protocols';

// Test wallet: 0x06CEd1A4341843D176eD76733aD3f8FcbEF0e606
// Fund this address with USDC on Base before running the mainnet e2e test.
// Private key: stored in TEST_PRIVATE_KEY env var (never commit real keys)

const skip =
  !process.env['RUN_INTEGRATION_TESTS'] ||
  !process.env['TEST_PRIVATE_KEY'] ||
  !process.env['E2E_X402_URL'];

describe.skipIf(skip)('x402 mainnet e2e', () => {
  it('completes a real x402 payment and returns 200', async () => {
    const privateKey = process.env['TEST_PRIVATE_KEY'] as `0x${string}`;
    const url = process.env['E2E_X402_URL']!;

    const account = privateKeyToAccount(privateKey);
    const x402Method = createX402Method({ account });
    const wallet = new PrivateKeyWalletAdapter({ privateKey });
    const state = createMemoryStore();
    const router = createRouter({ methods: [x402Method], state, policy: [] });
    const fetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });

    const response = await fetch(url);
    expect(response.status).toBe(200);
  });
});
