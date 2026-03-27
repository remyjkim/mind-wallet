// ABOUTME: End-to-end test for wrapFetch against local x402 and MPP payment-gated endpoints
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and TEST_PRIVATE_KEY are set

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetch } from './adapter.js';
import { createRouter } from '../router.js';
import { createMemoryStore } from '../state/memory.js';
import { PrivateKeyWalletAdapter } from '../wallet/private-key.js';
import { createX402Method } from '@mindpass/protocols';
import { startTestServer, type TestServerHandle } from '@mindpass/test-server';

const RUN = process.env['RUN_INTEGRATION_TESTS'] === '1';
const PRIVATE_KEY = process.env['TEST_PRIVATE_KEY'] as `0x${string}` | undefined;

describe.skipIf(!RUN || !PRIVATE_KEY)('wrapFetch e2e (local test server)', () => {
  let server: TestServerHandle;
  let wrappedFetch: typeof globalThis.fetch;
  let state: ReturnType<typeof createMemoryStore>;

  beforeAll(async () => {
    const account = privateKeyToAccount(PRIVATE_KEY!);
    const x402Method = createX402Method({ account });
    const wallet = new PrivateKeyWalletAdapter({ privateKey: PRIVATE_KEY! });

    server = await startTestServer({
      x402PayTo: '0x0000000000000000000000000000000000000001',
      mppRecipient: '0x0000000000000000000000000000000000000001',
      mppWaitForConfirmation: false,
    });

    state = createMemoryStore();
    const router = createRouter({ methods: [x402Method], state, policy: [] });
    wrappedFetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });
  });

  afterAll(async () => {
    await server?.close();
  });

  it('resolves an x402 payment challenge and returns 200', async () => {
    const response = await wrappedFetch(`${server.url}/x402/data`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: string };
    expect(body.data).toBe('paid x402 content');
  });

  it('includes a Payment-Receipt header on successful x402 response', async () => {
    const response = await wrappedFetch(`${server.url}/x402/data`);
    expect(response.status).toBe(200);

    const receipt = response.headers.get('payment-receipt');
    expect(receipt).toBeTruthy();

    const decoded = JSON.parse(Buffer.from(receipt!, 'base64url').toString('utf8'));
    expect(decoded.status).toBe('success');
  });
});
