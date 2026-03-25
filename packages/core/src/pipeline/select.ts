// ABOUTME: Top-level selector that runs the 5-stage pipeline and returns a SelectionOutcome
// ABOUTME: Stages: filter (expiry + policy) → score → pick highest scoring eligible candidate

import { applyHardFilters } from './filter.js';
import { scoreCandidates, DEFAULT_WEIGHTS } from './scorer.js';
import type { PaymentCandidate } from '../types/challenge.js';
import type { PolicyEngine } from '../types/policy.js';
import type { RouterStateStore } from '../types/state.js';
import type { RouterContext } from '../types/telemetry.js';
import type { SelectionOutcome } from '../types/selection.js';
import type { ScoringWeights } from './scorer.js';

export interface SelectorOptions {
  state: RouterStateStore;
  policy: PolicyEngine;
  weights?: ScoringWeights;
}

export interface Selector {
  select(candidates: PaymentCandidate[], ctx: RouterContext): Promise<SelectionOutcome>;
}

export function createSelector(options: SelectorOptions): Selector {
  const { state, policy, weights = DEFAULT_WEIGHTS } = options;

  return {
    async select(candidates, ctx) {
      if (candidates.length === 0) {
        return { ok: false, error: 'NO_COMPATIBLE_METHOD', detail: 'no candidates provided', considered: [] };
      }

      const now = (ctx.now ?? new Date()).getTime();

      // Stage 3: hard filter (expiry + policy)
      await applyHardFilters(candidates, policy, now);

      const eligible = candidates.filter(c => c.eligible);

      if (eligible.length === 0) {
        const allExpired = candidates.every(c => c.rejectionReason === 'EXPIRED');
        if (allExpired) {
          return { ok: false, error: 'ALL_EXPIRED', detail: 'all challenges have expired', considered: candidates };
        }
        return { ok: false, error: 'POLICY_DENIED', detail: 'all candidates denied by policy', considered: candidates };
      }

      // Stage 4: score
      await scoreCandidates(candidates, weights, state, ctx);

      // Stage 5: pick highest score
      const best = eligible.reduce((a, b) => (b.score ?? 0) > (a.score ?? 0) ? b : a);

      return {
        ok: true,
        decision: {
          challenge: best.raw,
          candidate: best,
          score: best.score ?? 0,
          reasons: [],
          considered: candidates,
        },
      };
    },
  };
}
