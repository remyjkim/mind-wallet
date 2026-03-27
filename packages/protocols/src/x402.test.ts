// packages/protocols/src/x402.test.ts
import { describe, it, expect } from 'vitest';
import { createX402Method } from './x402.js';
import type { PaymentCandidate } from '@mindpass/core';

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

const v2PaymentRequired = {
  x402Version: 2,
  accepts: [{
    scheme: 'exact',
    network: 'eip155:8453',
    maxAmountRequired: '1000000',
    resource: 'https://api.example.com/data',
    description: 'Access to data endpoint',
    mimeType: 'application/json',
    outputSchema: {},
    payTo: '0xRecipientAddress',
    maxTimeoutSeconds: 300,
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    extra: {},
  }],
};

function makeX402Candidate(): PaymentCandidate {
  const method = createX402Method({ account: makeAccount() });
  return {
    id: 'x402-test',
    protocol: 'x402',
    method,
    normalized: method.normalize(v2PaymentRequired),
    raw: v2PaymentRequired,
    eligible: true,
  };
}

describe('createX402Method', () => {
  const x402Method = createX402Method({ account: makeAccount() });

  describe('normalize', () => {
    it('extracts amount from maxAmountRequired', () => {
      const result = x402Method.normalize(v2PaymentRequired);
      expect(result.amount).toBe(1000000n);
    });

    it('extracts currency from asset', () => {
      const result = x402Method.normalize(v2PaymentRequired);
      expect(result.currency).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    });

    it('extracts realm from resource URL origin', () => {
      const result = x402Method.normalize(v2PaymentRequired);
      expect(result.realm).toBe('https://api.example.com');
    });

    it('sets intent to charge', () => {
      const result = x402Method.normalize(v2PaymentRequired);
      expect(result.intent).toBe('charge');
    });

    it('sets protocol to x402', () => {
      const result = x402Method.normalize(v2PaymentRequired);
      expect(result.protocol).toBe('x402');
    });

    it('handles empty accepts array gracefully', () => {
      const result = x402Method.normalize({ x402Version: 2, accepts: [] });
      expect(result.amount).toBe(0n);
    });
  });

  describe('canHandle', () => {
    it('returns true for x402 protocol candidates', () => {
      expect(x402Method.canHandle(makeX402Candidate())).toBe(true);
    });

    it('returns false for mpp protocol candidates', () => {
      const candidate = makeX402Candidate();
      const mppCandidate = { ...candidate, protocol: 'mpp' as const };
      expect(x402Method.canHandle(mppCandidate)).toBe(false);
    });

    it('returns false for siwx protocol candidates', () => {
      const candidate = makeX402Candidate();
      const siwxCandidate = { ...candidate, protocol: 'siwx' as const };
      expect(x402Method.canHandle(siwxCandidate)).toBe(false);
    });
  });
});
