// ABOUTME: Unit tests for searchRegistry — network errors, response parsing, and query params
// ABOUTME: Uses vi.fn() to mock fetch; no real network calls

import { describe, it, expect, vi, afterEach } from 'vitest';
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

  describe('MINDWALLET_REGISTRY_URL env var', () => {
    afterEach(() => {
      delete process.env['MINDWALLET_REGISTRY_URL'];
    });

    it('uses MINDWALLET_REGISTRY_URL when no registryUrl option is given', async () => {
      process.env['MINDWALLET_REGISTRY_URL'] = 'https://my-registry.example.com';
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 }),
      );
      await searchRegistry({}, mockFetch);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('my-registry.example.com'),
        expect.any(Object),
      );
    });

    it('options.registryUrl takes precedence over MINDWALLET_REGISTRY_URL', async () => {
      process.env['MINDWALLET_REGISTRY_URL'] = 'https://env-registry.example.com';
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 }),
      );
      await searchRegistry({ registryUrl: 'https://opt-registry.example.com' }, mockFetch);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('opt-registry.example.com'),
        expect.any(Object),
      );
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('env-registry.example.com'),
        expect.any(Object),
      );
    });
  });
});
