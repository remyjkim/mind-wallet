// ABOUTME: Unit tests for createTempoMethod — normalize, canHandle, and session channel state
// ABOUTME: Uses a mock viem Account and MemoryStore; no real RPC calls

import { describe, it, expect } from 'vitest';
import { createTempoMethod } from './tempo.js';
import { createMemoryStore } from '@mindwallet/core';
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

  describe('session channel state', () => {
    // bytes32 channel IDs as required by the on-chain ABI encoding
    const CHANNEL_A = '0xdeadbeef00000000000000000000000000000000000000000000000000000000' as `0x${string}`;
    const CHANNEL_B = '0xcafebabe00000000000000000000000000000000000000000000000000000000' as `0x${string}`;

    function makeRaw(channelId: string, amount: string) {
      return {
        realm: 'https://api.example.com',
        method: 'tempo',
        intent: 'session',
        amount,
        methodDetails: { channelId },
      };
    }

    it('persists channel state after a session credential is created', async () => {
      const store = createMemoryStore();
      const method = createTempoMethod({ account: makeAccount(), store });
      const candidate: PaymentCandidate = {
        id: 'sess-2',
        protocol: 'mpp',
        method,
        normalized: { realm: 'https://api.example.com', protocol: 'mpp', method: 'tempo', intent: 'session', amount: 500n, currency: 'USDC', hasDigestBinding: false },
        raw: makeRaw(CHANNEL_A, '500'),
        eligible: true,
      };

      await method.createCredential({ candidate, wallet: null as any });

      const state = await store.getSessionChannel(`tempo-session-${CHANNEL_A}`);
      expect(state).toBeDefined();
      expect(state!.channelId).toBe(CHANNEL_A);
      expect(state!.acceptedCumulative).toBe(500n);
    });

    it('updates cumulative amount on subsequent session calls', async () => {
      const store = createMemoryStore();
      const method = createTempoMethod({ account: makeAccount(), store });

      const candidate1: PaymentCandidate = {
        id: 'sess-3a',
        protocol: 'mpp',
        method,
        normalized: { realm: 'https://api.example.com', protocol: 'mpp', method: 'tempo', intent: 'session', amount: 100n, currency: 'USDC', hasDigestBinding: false },
        raw: makeRaw(CHANNEL_B, '100'),
        eligible: true,
      };
      const candidate2: PaymentCandidate = {
        id: 'sess-3b',
        protocol: 'mpp',
        method,
        normalized: { realm: 'https://api.example.com', protocol: 'mpp', method: 'tempo', intent: 'session', amount: 200n, currency: 'USDC', hasDigestBinding: false },
        raw: makeRaw(CHANNEL_B, '200'),
        eligible: true,
      };

      await method.createCredential({ candidate: candidate1, wallet: null as any });
      await method.createCredential({ candidate: candidate2, wallet: null as any });

      const state = await store.getSessionChannel(`tempo-session-${CHANNEL_B}`);
      expect(state!.acceptedCumulative).toBe(200n);
    });
  });
});
