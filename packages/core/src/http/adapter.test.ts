// packages/core/src/http/adapter.test.ts
import { describe, it, expect, vi } from 'vitest';
import { wrapFetch } from './adapter.js';
import { createRouter } from '../router.js';
import { createMemoryStore } from '../state/memory.js';

function makeRouter() {
  return createRouter({ methods: [], state: createMemoryStore(), policy: [] });
}

describe('wrapFetch', () => {
  it('passes through 200 responses without payment', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const fetch = wrapFetch({ fetch: mockFetch, router: makeRouter(), state: createMemoryStore() });
    const response = await fetch('https://api.example.com/data');
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns 402 when no compatible method found', async () => {
    const body = JSON.stringify({});
    const mock402 = new Response(body, {
      status: 402,
      headers: { 'Content-Type': 'application/json' },
    });
    const mockFetch = vi.fn().mockResolvedValue(mock402);
    const fetch = wrapFetch({ fetch: mockFetch, router: makeRouter(), state: createMemoryStore() });
    const response = await fetch('https://api.example.com/paid');
    expect(response.status).toBe(402);
    expect(mockFetch).toHaveBeenCalledTimes(1); // no retry
  });

  it('uses cached SIWX entitlement before triggering 402', async () => {
    const state = createMemoryStore();
    await state.putEntitlement({
      realm: 'https://api.example.com',
      token: 'cached-token',
      expiresAt: Date.now() + 3_600_000,
      walletAddress: '0xabc',
    });

    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrappedFetch = wrapFetch({
      fetch: mockFetch,
      router: makeRouter(),
      state,
    });

    await wrappedFetch('https://api.example.com/protected');
    const call = mockFetch.mock.calls[0];
    const headers = new Headers((call?.[1] as RequestInit)?.headers);
    expect(headers.get('authorization')).toBe('Bearer cached-token');
  });
});
