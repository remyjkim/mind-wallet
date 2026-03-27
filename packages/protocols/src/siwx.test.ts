// packages/protocols/src/siwx.test.ts
import { describe, it, expect } from 'vitest';
import { createSiwxMethod } from './siwx.js';
import type { PaymentCandidate } from '@mindpass/core';

function makeCandidate(protocol: PaymentCandidate['protocol'] = 'siwx'): PaymentCandidate {
  const method = createSiwxMethod();
  const raw = { domain: 'api.example.com', nonce: 'abc123', chainId: 'eip155:1' };
  return {
    id: 'siwx-1',
    protocol,
    method,
    normalized: method.normalize(raw),
    raw,
    eligible: true,
  };
}

describe('createSiwxMethod', () => {
  const siwxMethod = createSiwxMethod();

  describe('normalize', () => {
    it('uses domain as realm', () => {
      const result = siwxMethod.normalize({ domain: 'api.example.com', nonce: 'abc' });
      expect(result.realm).toBe('https://api.example.com');
    });

    it('uses realm field when domain missing', () => {
      const result = siwxMethod.normalize({ realm: 'https://api.example.com' });
      expect(result.realm).toBe('https://api.example.com');
    });

    it('sets protocol to siwx', () => {
      const result = siwxMethod.normalize({ domain: 'api.example.com' });
      expect(result.protocol).toBe('siwx');
    });

    it('sets amount to undefined (SIWX is free)', () => {
      const result = siwxMethod.normalize({ domain: 'api.example.com' });
      expect(result.amount).toBeUndefined();
    });

    it('sets intent to charge', () => {
      const result = siwxMethod.normalize({ domain: 'api.example.com' });
      expect(result.intent).toBe('charge');
    });
  });

  describe('canHandle', () => {
    it('returns true for siwx protocol candidates', () => {
      expect(siwxMethod.canHandle(makeCandidate('siwx'))).toBe(true);
    });

    it('returns false for mpp protocol candidates', () => {
      expect(siwxMethod.canHandle(makeCandidate('mpp'))).toBe(false);
    });

    it('returns false for x402 protocol candidates', () => {
      expect(siwxMethod.canHandle(makeCandidate('x402'))).toBe(false);
    });
  });
});
