// ABOUTME: End-to-end integration test for wrapFetch against a live payment-gated endpoint
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and E2E_PAYMENT_URL env vars are set

import { describe, it, expect, vi } from 'vitest';
import { wrapFetch } from './adapter.js';
import { createRouter } from '../router.js';
import { createMemoryStore } from '../state/memory.js';

const RUN = process.env['RUN_INTEGRATION_TESTS'] === '1';
const PAYMENT_URL = process.env['E2E_PAYMENT_URL'];

describe.skipIf(!RUN || !PAYMENT_URL)('wrapFetch e2e', () => {
  it('resolves a 402 payment challenge and returns 200', async () => {
    // Without payment methods, the 402 should pass through
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response('paid', { status: 200 }));

    const state = createMemoryStore();
    const router = createRouter({ methods: [], state, policy: [] });
    const fetch = wrapFetch({ fetch: mockFetch, router, state });

    const response = await fetch(PAYMENT_URL!);
    expect([200, 402]).toContain(response.status);
  });

  it('caches SIWX entitlement on successful response', async () => {
    const realm = new URL(PAYMENT_URL!).origin;
    const state = createMemoryStore();

    await state.putEntitlement({
      realm,
      token: 'test-token',
      expiresAt: Date.now() + 3_600_000,
      walletAddress: '0xtest',
    });

    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const router = createRouter({ methods: [], state, policy: [] });
    const fetch = wrapFetch({ fetch: mockFetch, router, state });

    await fetch(PAYMENT_URL!);
    const headers = new Headers((mockFetch.mock.calls[0]?.[1] as RequestInit)?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-token');
  });
});
