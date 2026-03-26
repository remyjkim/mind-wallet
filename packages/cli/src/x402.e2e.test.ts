// ABOUTME: End-to-end test for x402 payment flow using a local test server
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and TEST_PRIVATE_KEY are set

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrivateKeyWalletAdapter, createMemoryStore, createRouter, wrapFetch } from '@mindwallet/core';
import { privateKeyToAccount } from 'viem/accounts';
import { createX402Method } from '@mindwallet/protocols';
import { startTestServer, type TestServerHandle } from '@mindwallet/test-server';

const skip =
  !process.env['RUN_INTEGRATION_TESTS'] ||
  !process.env['TEST_PRIVATE_KEY'];

describe.skipIf(skip)('x402 e2e (local test server)', () => {
  let server: TestServerHandle;

  beforeAll(async () => {
    server = await startTestServer({
      x402PayTo: '0x0000000000000000000000000000000000000001',
      mppRecipient: '0x0000000000000000000000000000000000000001',
      mppWaitForConfirmation: false,
    });
  });

  afterAll(async () => {
    await server?.close();
  });

  it('completes a full x402 payment flow and returns 200', async () => {
    const privateKey = process.env['TEST_PRIVATE_KEY'] as `0x${string}`;
    const account = privateKeyToAccount(privateKey);
    const x402Method = createX402Method({ account });
    const wallet = new PrivateKeyWalletAdapter({ privateKey });
    const state = createMemoryStore();
    const router = createRouter({ methods: [x402Method], state, policy: [] });
    const fetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });

    const response = await fetch(`${server.url}/x402/data`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { data: string };
    expect(body.data).toBe('paid x402 content');

    // Verify receipt
    const receipt = response.headers.get('payment-receipt');
    expect(receipt).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(receipt!, 'base64url').toString('utf8'));
    expect(decoded.status).toBe('success');
    expect(decoded.transaction).toBeDefined();
  });
});
