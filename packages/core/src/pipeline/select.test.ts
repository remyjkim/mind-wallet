// packages/core/src/pipeline/select.test.ts
import { describe, it, expect } from 'vitest';
import { createSelector } from './select.js';
import { createMemoryStore } from '../state/memory.js';
import { createPolicyEngine } from '../policy/evaluator.js';
import type { PaymentCandidate } from '../types/challenge.js';

function makeMethod(id: string) {
  return {
    id,
    protocol: 'mpp' as const,
    canHandle: () => true,
    normalize: (raw: unknown) => raw as any,
    createCredential: async () => 'auth-header',
  };
}

function makeCandidate(id: string, amount: bigint): PaymentCandidate {
  return {
    id,
    protocol: 'mpp',
    method: makeMethod('tempo'),
    normalized: {
      realm: 'https://api.example.com',
      protocol: 'mpp',
      method: 'tempo',
      intent: 'charge',
      amount,
      currency: 'USDC',
      hasDigestBinding: false,
    },
    raw: {},
    eligible: true,
  };
}

describe('createSelector', () => {
  it('selects the highest-scoring eligible candidate', async () => {
    const state = createMemoryStore();
    const policy = createPolicyEngine([]);
    const selector = createSelector({ state, policy });

    const candidates = [
      makeCandidate('expensive', 1_000_000n),
      makeCandidate('cheap', 100_000n),
    ];

    const outcome = await selector.select(candidates, { transport: 'http' });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.decision.candidate.id).toBe('cheap');
    }
  });

  it('returns NO_COMPATIBLE_METHOD when no candidates', async () => {
    const state = createMemoryStore();
    const policy = createPolicyEngine([]);
    const selector = createSelector({ state, policy });

    const outcome = await selector.select([], { transport: 'http' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('NO_COMPATIBLE_METHOD');
  });

  it('returns POLICY_DENIED when all candidates denied', async () => {
    const state = createMemoryStore();
    const policy = createPolicyEngine([
      { type: 'deny-protocol', protocols: ['mpp'] },
    ]);
    const selector = createSelector({ state, policy });

    const outcome = await selector.select([makeCandidate('a', 100n)], { transport: 'http' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('POLICY_DENIED');
  });

  it('returns ALL_EXPIRED when all candidates are past expiry', async () => {
    const state = createMemoryStore();
    const policy = createPolicyEngine([]);
    const selector = createSelector({ state, policy });

    const expired: PaymentCandidate = {
      ...makeCandidate('expired', 100n),
      normalized: {
        ...makeCandidate('expired', 100n).normalized,
        expiresAt: Date.now() - 1000,
      },
    };

    const outcome = await selector.select([expired], { transport: 'http' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('ALL_EXPIRED');
  });
});
