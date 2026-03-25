// ABOUTME: Policy engine that evaluates PaymentCandidates against a set of rules
// ABOUTME: First deny rule short-circuits; prefer-protocol adds a score boost without denying

import type { PolicyRule, PolicyResult, PolicyEngine } from '../types/policy.js';
import type { PaymentCandidate } from '../types/challenge.js';
import type { RouterStateStore } from '../types/state.js';

const WINDOW_MS: Record<'daily' | 'weekly' | 'monthly', number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export function createPolicyEngine(rules: PolicyRule[], state?: RouterStateStore): PolicyEngine {
  return {
    async evaluate(candidate: PaymentCandidate): Promise<PolicyResult> {
      let scoreBoost = 0;

      for (const rule of rules) {
        switch (rule.type) {
          case 'deny-realm':
            if (rule.realms.includes(candidate.normalized.realm)) {
              return { allow: false, reason: `realm ${candidate.normalized.realm} is denied` };
            }
            break;

          case 'allow-realm':
            if (!rule.realms.includes(candidate.normalized.realm)) {
              return { allow: false, reason: `realm ${candidate.normalized.realm} not in allow list` };
            }
            break;

          case 'deny-protocol':
            if (rule.protocols.includes(candidate.normalized.protocol)) {
              return { allow: false, reason: `protocol ${candidate.normalized.protocol} is denied` };
            }
            break;

          case 'allow-protocol':
            if (!rule.protocols.includes(candidate.normalized.protocol)) {
              return { allow: false, reason: `protocol ${candidate.normalized.protocol} not in allow list` };
            }
            break;

          case 'max-amount':
            if (
              candidate.normalized.currency === rule.currency &&
              candidate.normalized.amount !== undefined &&
              candidate.normalized.amount > rule.amount
            ) {
              return {
                allow: false,
                reason: `amount ${candidate.normalized.amount} exceeds max ${rule.amount} ${rule.currency}`,
              };
            }
            break;

          case 'prefer-protocol':
            if (candidate.normalized.protocol === rule.protocol) {
              scoreBoost += rule.boost;
            }
            break;

          case 'require-digest-binding':
            if (!candidate.normalized.hasDigestBinding) {
              return { allow: false, reason: 'digest binding required but not present' };
            }
            break;

          case 'budget': {
            if (state && candidate.normalized.currency === rule.currency && candidate.normalized.amount !== undefined) {
              const windowMs = WINDOW_MS[rule.window];
              const since = Date.now() - windowMs;
              const past = await state.getOutcomes({ since, currency: rule.currency });
              const spent = past.reduce((sum, o) => sum + (o.amount ?? 0n), 0n);
              if (spent + candidate.normalized.amount > rule.amount) {
                return {
                  allow: false,
                  reason: `budget limit ${rule.amount} ${rule.currency} (${rule.window}) would be exceeded`,
                };
              }
            }
            break;
          }

          case 'delegate': {
            const approved = await rule.provider.approve(candidate);
            if (!approved) {
              return { allow: false, reason: 'delegate approval denied' };
            }
            break;
          }
        }
      }

      return { allow: true, scoreBoost: scoreBoost > 0 ? scoreBoost : undefined };
    },
  };
}
