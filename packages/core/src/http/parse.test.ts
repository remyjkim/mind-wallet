// packages/core/src/http/parse.test.ts
import { describe, it, expect } from 'vitest';
import { parseHttpChallenges } from './parse.js';
import type { RouterMethod } from '../types/method.js';

function makeTempoMethod(): RouterMethod {
  return {
    id: 'tempo',
    protocol: 'mpp',
    canHandle: (c) => c.normalized.method === 'tempo',
    normalize: (raw: any) => ({
      realm: raw.realm,
      protocol: 'mpp' as const,
      method: 'tempo',
      intent: raw.intent ?? 'charge',
      amount: raw.amount ? BigInt(raw.amount) : undefined,
      currency: raw.currency,
      hasDigestBinding: false,
    }),
    createCredential: async () => ({ Authorization: 'mpp-auth' }),
  };
}

function makeMppResponse(realm: string): Response {
  const request = Buffer.from(
    JSON.stringify({ realm, amount: '1000000', currency: 'USDC' })
  ).toString('base64url');

  return new Response(null, {
    status: 402,
    headers: {
      'WWW-Authenticate': `Payment id="ch-1" realm="${realm}" method="tempo" intent="charge" request="${request}"`,
    },
  });
}

describe('parseHttpChallenges', () => {
  it('parses MPP WWW-Authenticate header into candidate', () => {
    const response = makeMppResponse('https://api.example.com');
    const candidates = parseHttpChallenges(response, null, [makeTempoMethod()]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.protocol).toBe('mpp');
    expect(candidates[0]?.normalized.realm).toBe('https://api.example.com');
  });

  it('returns empty array when no payment headers', () => {
    const response = new Response(null, { status: 402 });
    const candidates = parseHttpChallenges(response, null, [makeTempoMethod()]);
    expect(candidates).toHaveLength(0);
  });

  it('marks candidate eligible by default', () => {
    const response = makeMppResponse('https://api.example.com');
    const candidates = parseHttpChallenges(response, null, [makeTempoMethod()]);
    expect(candidates[0]?.eligible).toBe(true);
  });
});
