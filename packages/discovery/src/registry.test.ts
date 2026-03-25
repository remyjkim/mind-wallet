// packages/discovery/src/registry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { searchRegistry } from './registry.js';

describe('searchRegistry', () => {
  it('returns empty array on network error', async () => {
    const failFetch = vi.fn().mockRejectedValue(new Error('Network Error'));
    const results = await searchRegistry({}, failFetch);
    expect(results).toEqual([]);
  });

  it('returns empty array on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const results = await searchRegistry({}, mockFetch);
    expect(results).toEqual([]);
  });

  it('parses array response', async () => {
    const records = [
      { origin: 'https://api.example.com', protocols: ['mpp'] },
      { origin: 'https://other.example.com', protocols: ['x402'] },
    ];
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(records), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const results = await searchRegistry({}, mockFetch);
    expect(results).toHaveLength(2);
    expect(results[0]?.origin).toBe('https://api.example.com');
  });

  it('parses {origins: [...]} response shape', async () => {
    const records = { origins: [{ origin: 'https://api.example.com', protocols: ['siwx'] }] };
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(records), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const results = await searchRegistry({}, mockFetch);
    expect(results).toHaveLength(1);
  });

  it('passes protocol filter as query param', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    await searchRegistry({ protocol: 'mpp', registryUrl: 'https://registry.example.com' }, mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('protocol=mpp'),
      expect.any(Object),
    );
  });

  it('passes limit as query param', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    await searchRegistry({ limit: 5 }, mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=5'),
      expect.any(Object),
    );
  });
});
