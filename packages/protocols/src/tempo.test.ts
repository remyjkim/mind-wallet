// packages/protocols/src/tempo.test.ts
import { describe, it, expect } from 'vitest';
import { createTempoMethod } from './tempo.js';
import type { PaymentCandidate } from '@mindwallet/core';

function makeAccount() {
  return {
    address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`,
    type: 'local' as const,
    publicKey: '0x00' as `0x${string}`,
    source: 'privateKey',
    sign: async () => '0x' as `0x${string}`,
    signMessage: async () => '0x' as `0x${string}`,
    signTransaction: async () => '0x' as `0x${string}`,
    signTypedData: async () => '0x' as `0x${string}`,
    experimental_signAuthorization: async () => ({ r: '0x', s: '0x', yParity: 0 as 0 | 1 }),
    nonceManager: undefined,
  };
}

function makeCandidate(overrides: Partial<PaymentCandidate['normalized']> = {}): PaymentCandidate {
  const method = createTempoMethod({ account: makeAccount() });
  const raw = { realm: 'https://api.example.com', method: 'tempo', intent: 'charge', amount: '1000000', currency: 'USDC' };
  return {
    id: 'test-1',
    protocol: 'mpp',
    method,
    normalized: { realm: 'https://api.example.com', protocol: 'mpp', method: 'tempo', intent: 'charge', amount: 1000000n, currency: 'USDC', hasDigestBinding: false, ...overrides },
    raw,
    eligible: true,
  };
}

describe('createTempoMethod', () => {
  const tempoMethod = createTempoMethod({ account: makeAccount() });

  describe('normalize', () => {
    it('extracts realm from raw MPP params', () => {
      const result = tempoMethod.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'charge', amount: '500000', currency: 'USDC' });
      expect(result.realm).toBe('https://api.example.com');
    });

    it('converts amount string to bigint', () => {
      const result = tempoMethod.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'charge', amount: '1000000', currency: 'USDC' });
      expect(result.amount).toBe(1000000n);
    });

    it('preserves currency', () => {
      const result = tempoMethod.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'charge', amount: '500000', currency: 'USDC' });
      expect(result.currency).toBe('USDC');
    });

    it('extracts session intent', () => {
      const result = tempoMethod.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'session', amount: '100', currency: 'pathUSD' });
      expect(result.intent).toBe('session');
    });

    it('defaults to charge intent when missing', () => {
      const result = tempoMethod.normalize({ realm: 'https://api.example.com', method: 'tempo' });
      expect(result.intent).toBe('charge');
    });

    it('handles missing amount gracefully', () => {
      const result = tempoMethod.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'charge' });
      expect(result.amount).toBeUndefined();
    });

    it('sets hasDigestBinding when digest present', () => {
      const result = tempoMethod.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'charge', digest: 'sha256:abc' });
      expect(result.hasDigestBinding).toBe(true);
    });
  });

  describe('canHandle', () => {
    it('returns true for tempo method candidates', () => {
      expect(tempoMethod.canHandle(makeCandidate())).toBe(true);
    });

    it('returns false for non-tempo method candidates', () => {
      expect(tempoMethod.canHandle(makeCandidate({ method: 'stripe' }))).toBe(false);
    });

    it('returns false for x402 method candidates', () => {
      expect(tempoMethod.canHandle(makeCandidate({ method: 'x402' as any }))).toBe(false);
    });
  });
});
