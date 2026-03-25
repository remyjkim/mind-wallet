// ABOUTME: Hard-filter stage for the selection pipeline
// ABOUTME: Marks candidates ineligible for expiry and policy denial

import type { PaymentCandidate } from '../types/challenge.js';
import type { PolicyEngine } from '../types/policy.js';

export async function applyHardFilters(
  candidates: PaymentCandidate[],
  policy: PolicyEngine,
  now: number = Date.now(),
): Promise<void> {
  for (const candidate of candidates) {
    if (candidate.normalized.expiresAt !== undefined && candidate.normalized.expiresAt < now) {
      candidate.eligible = false;
      candidate.rejectionReason = 'EXPIRED';
      continue;
    }

    const result = await policy.evaluate(candidate);
    if (!result.allow) {
      candidate.eligible = false;
      candidate.rejectionReason = result.reason ?? 'POLICY_DENIED';
    }
  }
}
