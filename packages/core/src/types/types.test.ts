// packages/core/src/types/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  SelectionOutcome, PolicyRule, RouterStateStore, Telemetry, PaymentError
} from './index.js';

describe('SelectionOutcome', () => {
  it('ok variant has a decision', () => {
    const outcome: SelectionOutcome = {
      ok: true,
      decision: {
        challenge: {} as any,
        candidate: {} as any,
        score: 0.8,
        reasons: [],
        considered: [],
      },
    };
    expect(outcome.ok).toBe(true);
  });

  it('error variant has a code', () => {
    const outcome: SelectionOutcome = {
      ok: false,
      error: 'NO_COMPATIBLE_METHOD',
      detail: 'no methods registered',
      considered: [],
    };
    expect(outcome.error).toBe('NO_COMPATIBLE_METHOD');
  });
});

describe('PolicyRule', () => {
  it('prefer-protocol has a boost field', () => {
    const rule: PolicyRule = {
      type: 'prefer-protocol',
      protocol: 'mpp',
      boost: 0.2,
    };
    expect(rule.boost).toBe(0.2);
  });
});
