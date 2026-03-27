// ABOUTME: Unit tests for searchHubRegistry — URL construction, query params, error resilience
// ABOUTME: Uses vi.fn() to mock fetch; no real network calls

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchHubRegistry } from './hub-registry.js';

const mockFetch = vi.fn();

describe('searchHubRegistry', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('queries /registry/origins on the hub URL with no params', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { origin: 'https://geo.example.com', protocols: ['x402'], description: 'Geocoding' },
        ]),
        { status: 200 },
      ),
    );

    const results = await searchHubRegistry({ hubUrl: 'https://hub.example.com' }, mockFetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith('https://hub.example.com/registry/origins');
    expect(results).toHaveLength(1);
    expect(results[0].origin).toBe('https://geo.example.com');
    expect(results[0].protocols).toContain('x402');
    expect(results[0].description).toBe('Geocoding');
  });

  it('appends ?protocol= when provided', async () => {
    mockFetch.mockResolvedValueOnce(new Response('[]', { status: 200 }));
    await searchHubRegistry({ hubUrl: 'https://hub.example.com', protocol: 'mpp' }, mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hub.example.com/registry/origins?protocol=mpp',
    );
  });

  it('appends ?q= when query is provided', async () => {
    mockFetch.mockResolvedValueOnce(new Response('[]', { status: 200 }));
    await searchHubRegistry({ hubUrl: 'https://hub.example.com', query: 'geocoding' }, mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hub.example.com/registry/origins?q=geocoding',
    );
  });

  it('appends ?limit= when provided', async () => {
    mockFetch.mockResolvedValueOnce(new Response('[]', { status: 200 }));
    await searchHubRegistry({ hubUrl: 'https://hub.example.com', limit: 5 }, mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hub.example.com/registry/origins?limit=5',
    );
  });

  it('combines multiple query params', async () => {
    mockFetch.mockResolvedValueOnce(new Response('[]', { status: 200 }));
    await searchHubRegistry(
      { hubUrl: 'https://hub.example.com', protocol: 'x402', query: 'maps', limit: 10 },
      mockFetch,
    );
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const u = new URL(calledUrl);
    expect(u.searchParams.get('protocol')).toBe('x402');
    expect(u.searchParams.get('q')).toBe('maps');
    expect(u.searchParams.get('limit')).toBe('10');
  });

  it('returns empty array on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const results = await searchHubRegistry({ hubUrl: 'https://hub.example.com' }, mockFetch);
    expect(results).toEqual([]);
  });

  it('returns empty array on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));
    const results = await searchHubRegistry({ hubUrl: 'https://hub.example.com' }, mockFetch);
    expect(results).toEqual([]);
  });

  it('strips trailing slash from hubUrl before appending path', async () => {
    mockFetch.mockResolvedValueOnce(new Response('[]', { status: 200 }));
    await searchHubRegistry({ hubUrl: 'https://hub.example.com/' }, mockFetch);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('//registry');
    expect(calledUrl).toContain('/registry/origins');
  });

  it('returns empty array on invalid JSON response', async () => {
    mockFetch.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    const results = await searchHubRegistry({ hubUrl: 'https://hub.example.com' }, mockFetch);
    expect(results).toEqual([]);
  });
});
