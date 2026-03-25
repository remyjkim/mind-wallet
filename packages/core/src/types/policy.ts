// ABOUTME: Policy rule union type for the payment selection policy engine
// ABOUTME: prefer-protocol adds a score boost; deny rules hard-filter candidates

import type { Protocol } from './challenge.js';

export type PolicyRule =
  | { type: 'budget'; currency: string; amount: bigint; window: 'daily' | 'weekly' | 'monthly' }
  | { type: 'allow-realm'; realms: string[] }
  | { type: 'deny-realm'; realms: string[] }
  | { type: 'allow-protocol'; protocols: Protocol[] }
  | { type: 'deny-protocol'; protocols: Protocol[] }
  | { type: 'prefer-protocol'; protocol: Protocol; boost: number }
  | { type: 'max-amount'; currency: string; amount: bigint }
  | { type: 'require-digest-binding' }
  | { type: 'delegate'; provider: ApprovalProvider };

export interface PolicyResult {
  allow: boolean;
  reason?: string;
  scoreBoost?: number;
}

export interface PolicyEngine {
  evaluate(candidate: import('./challenge.js').PaymentCandidate): Promise<PolicyResult>;
}

export interface ApprovalProvider {
  approve(candidate: import('./challenge.js').PaymentCandidate): Promise<boolean>;
}
