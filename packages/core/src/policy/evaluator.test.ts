// packages/core/src/policy/evaluator.test.ts
import { describe, it, expect } from 'vitest';
import { createPolicyEngine } from './evaluator.js';
import { createMemoryStore } from '../state/memory.js';
import type { PaymentCandidate } from '../types/challenge.js';

function makeCandidate(overrides: Partial<PaymentCandidate['normalized']> = {}): PaymentCandidate {
  return {
    id: 'test-id',
    protocol: 'mpp',
    method: {} as any,
    normalized: {
      realm: 'https://api.example.com',
      protocol: 'mpp',
      method: 'tempo',
      intent: 'charge',
      amount: 1_000_000n,
      currency: 'USDC',
      hasDigestBinding: false,
      ...overrides,
    },
    raw: {},
    eligible: true,
  };
}

describe('createPolicyEngine', () => {
  it('allows when no rules', async () => {
    const engine = createPolicyEngine([]);
    const result = await engine.evaluate(makeCandidate());
    expect(result.allow).toBe(true);
  });

  it('deny-realm blocks matching realm', async () => {
    const engine = createPolicyEngine([
      { type: 'deny-realm', realms: ['https://api.example.com'] },
    ]);
    const result = await engine.evaluate(makeCandidate());
    expect(result.allow).toBe(false);
    expect(result.reason).toMatch(/realm/i);
  });

  it('deny-protocol blocks matching protocol', async () => {
    const engine = createPolicyEngine([
      { type: 'deny-protocol', protocols: ['mpp'] },
    ]);
    const result = await engine.evaluate(makeCandidate({ protocol: 'mpp' }));
    expect(result.allow).toBe(false);
  });

  it('allow-protocol permits only listed protocols', async () => {
    const engine = createPolicyEngine([
      { type: 'allow-protocol', protocols: ['x402'] },
    ]);
    const mppResult = await engine.evaluate(makeCandidate({ protocol: 'mpp' }));
    expect(mppResult.allow).toBe(false);
  });

  it('max-amount blocks candidates exceeding limit', async () => {
    const engine = createPolicyEngine([
      { type: 'max-amount', currency: 'USDC', amount: 500_000n },
    ]);
    const result = await engine.evaluate(makeCandidate({ amount: 1_000_000n, currency: 'USDC' }));
    expect(result.allow).toBe(false);
  });

  it('prefer-protocol adds score boost to matching protocol', async () => {
    const engine = createPolicyEngine([
      { type: 'prefer-protocol', protocol: 'mpp', boost: 0.2 },
    ]);
    const result = await engine.evaluate(makeCandidate({ protocol: 'mpp' }));
    expect(result.allow).toBe(true);
    expect(result.scoreBoost).toBe(0.2);
  });

  it('prefer-protocol does not boost non-matching protocol', async () => {
    const engine = createPolicyEngine([
      { type: 'prefer-protocol', protocol: 'x402', boost: 0.2 },
    ]);
    const result = await engine.evaluate(makeCandidate({ protocol: 'mpp' }));
    expect(result.allow).toBe(true);
    expect(result.scoreBoost ?? 0).toBe(0);
  });

  it('first deny rule short-circuits', async () => {
    const engine = createPolicyEngine([
      { type: 'deny-realm', realms: ['https://api.example.com'] },
      { type: 'allow-protocol', protocols: ['mpp'] },
    ]);
    const result = await engine.evaluate(makeCandidate());
    expect(result.allow).toBe(false);
    expect(result.reason).toMatch(/realm/i);
  });

  describe('budget rule', () => {
    it('allows when no prior spend', async () => {
      const state = createMemoryStore();
      const engine = createPolicyEngine(
        [{ type: 'budget', currency: 'USDC', amount: 1_000_000n, window: 'daily' }],
        state,
      );
      const result = await engine.evaluate(makeCandidate({ amount: 100_000n, currency: 'USDC' }));
      expect(result.allow).toBe(true);
    });

    it('allows when cumulative spend is under limit', async () => {
      const state = createMemoryStore();
      await state.recordOutcome({
        realm: 'https://api.example.com', method: 'GET /', protocol: 'mpp',
        intent: 'charge', currency: 'USDC', amount: 400_000n, at: Date.now(),
      });
      const engine = createPolicyEngine(
        [{ type: 'budget', currency: 'USDC', amount: 1_000_000n, window: 'daily' }],
        state,
      );
      const result = await engine.evaluate(makeCandidate({ amount: 400_000n, currency: 'USDC' }));
      expect(result.allow).toBe(true);
    });

    it('blocks when cumulative spend would exceed limit', async () => {
      const state = createMemoryStore();
      await state.recordOutcome({
        realm: 'https://api.example.com', method: 'GET /', protocol: 'mpp',
        intent: 'charge', currency: 'USDC', amount: 800_000n, at: Date.now(),
      });
      const engine = createPolicyEngine(
        [{ type: 'budget', currency: 'USDC', amount: 1_000_000n, window: 'daily' }],
        state,
      );
      const result = await engine.evaluate(makeCandidate({ amount: 300_000n, currency: 'USDC' }));
      expect(result.allow).toBe(false);
      expect(result.reason).toMatch(/budget/i);
    });

    it('does not count outcomes older than the window', async () => {
      const state = createMemoryStore();
      const yesterday = Date.now() - 25 * 60 * 60 * 1000;
      await state.recordOutcome({
        realm: 'https://api.example.com', method: 'GET /', protocol: 'mpp',
        intent: 'charge', currency: 'USDC', amount: 900_000n, at: yesterday,
      });
      const engine = createPolicyEngine(
        [{ type: 'budget', currency: 'USDC', amount: 1_000_000n, window: 'daily' }],
        state,
      );
      const result = await engine.evaluate(makeCandidate({ amount: 500_000n, currency: 'USDC' }));
      expect(result.allow).toBe(true);
    });

    it('respects weekly window', async () => {
      const state = createMemoryStore();
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      await state.recordOutcome({
        realm: 'https://api.example.com', method: 'GET /', protocol: 'mpp',
        intent: 'charge', currency: 'USDC', amount: 800_000n, at: threeDaysAgo,
      });
      const engine = createPolicyEngine(
        [{ type: 'budget', currency: 'USDC', amount: 1_000_000n, window: 'weekly' }],
        state,
      );
      const result = await engine.evaluate(makeCandidate({ amount: 300_000n, currency: 'USDC' }));
      expect(result.allow).toBe(false);
      expect(result.reason).toMatch(/budget/i);
    });
  });
});
