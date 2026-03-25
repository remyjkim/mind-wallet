// packages/core/src/pipeline/scorer.test.ts
import { describe, it, expect } from 'vitest';
import { scoreCandidates, DEFAULT_WEIGHTS } from './scorer.js';
import { createMemoryStore } from '../state/memory.js';
import type { PaymentCandidate } from '../types/challenge.js';

function makeCandidate(id: string, overrides: Partial<PaymentCandidate['normalized']> = {}): PaymentCandidate {
  return {
    id,
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

describe('scoreCandidates', () => {
  it('assigns scores to eligible candidates', async () => {
    const state = createMemoryStore();
    const candidates = [makeCandidate('a'), makeCandidate('b', { amount: 500_000n })];
    await scoreCandidates(candidates, DEFAULT_WEIGHTS, state, { transport: 'http' });
    expect(candidates[0]?.score).toBeDefined();
    expect(candidates[1]?.score).toBeDefined();
  });

  it('cheaper candidate scores higher when amounts differ', async () => {
    const state = createMemoryStore();
    const expensive = makeCandidate('expensive', { amount: 1_000_000n });
    const cheap = makeCandidate('cheap', { amount: 100_000n });
    await scoreCandidates([expensive, cheap], DEFAULT_WEIGHTS, state, { transport: 'http' });
    expect(cheap.score!).toBeGreaterThan(expensive.score!);
  });

  it('ineligible candidates are skipped', async () => {
    const state = createMemoryStore();
    const ineligible = { ...makeCandidate('skip'), eligible: false, score: undefined };
    await scoreCandidates([ineligible], DEFAULT_WEIGHTS, state, { transport: 'http' });
    expect(ineligible.score).toBeUndefined();
  });

  it('warm session channel boosts score', async () => {
    const state = createMemoryStore();
    const cold = makeCandidate('cold');              // intent: 'charge' → warm score = NEUTRAL
    const warm = makeCandidate('warm', { intent: 'session' }); // matches session channel
    await state.putSessionChannel({
      realm: 'https://api.example.com',
      channelId: 'ch-1',
      method: 'tempo',
      updatedAt: Date.now(),
      scopeKey: 'https://api.example.com:tempo',
    });
    await scoreCandidates([cold, warm], DEFAULT_WEIGHTS, state, { transport: 'http' });
    expect(warm.score!).toBeGreaterThan(cold.score!);
  });
});
