// ABOUTME: Factory function that wires together the selection pipeline components
// ABOUTME: Returns a MindRouter usable by HTTP and MCP adapters

import { createSelector } from './pipeline/select.js';
import { createPolicyEngine } from './policy/evaluator.js';
import type { RouterMethod } from './types/method.js';
import type { RouterStateStore } from './types/state.js';
import type { PolicyRule } from './types/policy.js';
import type { PaymentCandidate } from './types/challenge.js';
import type { RouterContext } from './types/telemetry.js';
import type { SelectionOutcome } from './types/selection.js';
import type { ScoringWeights } from './pipeline/scorer.js';

export interface MindRouterConfig {
  methods: RouterMethod[];
  state: RouterStateStore;
  policy: PolicyRule[];
  weights?: ScoringWeights;
}

export interface MindRouter {
  select(candidates: PaymentCandidate[], ctx: RouterContext): Promise<SelectionOutcome>;
  methods: RouterMethod[];
}

export function createRouter(config: MindRouterConfig): MindRouter {
  const policyEngine = createPolicyEngine(config.policy, config.state);
  const selector = createSelector({
    state: config.state,
    policy: policyEngine,
    weights: config.weights,
  });

  return {
    methods: config.methods,
    select: (candidates, ctx) => selector.select(candidates, ctx),
  };
}
