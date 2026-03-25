// packages/core/src/types/challenge.test.ts
import { describe, it, expect } from 'vitest';
import type { PaymentCandidate, NormalizedPayment, Protocol } from './challenge.js';

describe('PaymentCandidate', () => {
  it('accepts all three protocol values', () => {
    const protocols: Protocol[] = ['x402', 'mpp', 'siwx'];
    expect(protocols).toHaveLength(3);
  });

  it('normalized payment has required fields', () => {
    const norm: NormalizedPayment = {
      realm: 'https://api.example.com',
      protocol: 'mpp',
      method: 'tempo',
      intent: 'charge',
      hasDigestBinding: false,
    };
    expect(norm.realm).toBe('https://api.example.com');
    expect(norm.protocol).toBe('mpp');
  });

  it('siwx candidate has zero cost (undefined amount)', () => {
    const norm: NormalizedPayment = {
      realm: 'https://api.example.com',
      protocol: 'siwx',
      method: 'siwx',
      intent: 'identity',
      hasDigestBinding: false,
    };
    expect(norm.amount).toBeUndefined();
  });
});
