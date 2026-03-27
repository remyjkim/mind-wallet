// packages/discovery/src/prober.test.ts
import { describe, it, expect, vi } from 'vitest';
import { probeOrigin } from './prober.js';
import type { RouterMethod } from '@mindpass/core';

function makeTempoMethod(): RouterMethod {
  return {
    id: 'tempo',
    protocol: 'mpp',
    canHandle: (c) => c.normalized.method === 'tempo',
    normalize: (raw: any) => ({
      realm: raw.realm ?? '',
      protocol: 'mpp' as const,
      method: 'tempo',
      intent: 'charge' as const,
      amount: raw.amount ? BigInt(raw.amount) : undefined,
      currency: raw.currency,
      hasDigestBinding: false,
    }),
    createCredential: async () => ({ Authorization: 'mpp-auth' }),
  };
}

function makeMppRequest(realm: string): Request {
  const encoded = Buffer.from(
    JSON.stringify({ realm, amount: '1000000', currency: 'USDC' }),
  ).toString('base64url');
  return new Request('https://api.example.com/paid', {
    headers: {
      'WWW-Authenticate': `Payment id="ch-1" realm="${realm}" method="tempo" intent="charge" request="${encoded}"`,
    },
  });
}

describe('probeOrigin', () => {
  it('returns reachable=false on network error', async () => {
    const failFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await probeOrigin('https://unreachable.example.com/', [], failFetch);
    expect(result.reachable).toBe(false);
    expect(result.candidates).toHaveLength(0);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('returns requires402=false for 200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const result = await probeOrigin('https://api.example.com/', [], mockFetch);
    expect(result.reachable).toBe(true);
    expect(result.requires402).toBe(false);
    expect(result.candidates).toHaveLength(0);
  });

  it('parses MPP challenge from 402 response', async () => {
    const realm = 'https://api.example.com';
    const encoded = Buffer.from(
      JSON.stringify({ realm, amount: '1000000', currency: 'USDC' }),
    ).toString('base64url');
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 402,
        headers: {
          'WWW-Authenticate': `Payment id="ch-1" realm="${realm}" method="tempo" intent="charge" request="${encoded}"`,
        },
      }),
    );
    const result = await probeOrigin('https://api.example.com/', [makeTempoMethod()], mockFetch);
    expect(result.reachable).toBe(true);
    expect(result.requires402).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.protocol).toBe('mpp');
  });

  it('returns empty candidates when no compatible method', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 402 }),
    );
    const result = await probeOrigin('https://api.example.com/', [], mockFetch);
    expect(result.requires402).toBe(true);
    expect(result.candidates).toHaveLength(0);
  });
});
