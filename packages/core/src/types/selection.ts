// ABOUTME: Selection outcome, decision, and error types for the payment pipeline
// ABOUTME: SelectionDecision carries a full audit trail of all considered candidates

import type { PaymentCandidate } from './challenge.js';

export interface SelectionDecision {
  challenge: unknown;        // raw challenge (protocol-specific)
  candidate: PaymentCandidate;
  score: number;
  reasons: Array<{ code: string; detail: string }>;
  considered: PaymentCandidate[];
}

export type PaymentErrorCode =
  | 'NO_COMPATIBLE_METHOD'
  | 'ALL_EXPIRED'
  | 'POLICY_DENIED'
  | 'WALLET_ERROR'
  | 'CREDENTIAL_ERROR'
  | 'INVALID_CHALLENGES';

export interface PaymentError {
  code: PaymentErrorCode;
  detail: string;
  considered: PaymentCandidate[];
}

export type SelectionOutcome =
  | { ok: true; decision: SelectionDecision }
  | { ok: false; error: PaymentErrorCode; detail: string; considered: PaymentCandidate[] };
