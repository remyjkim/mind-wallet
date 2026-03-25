// ABOUTME: Unified payment candidate types covering x402, MPP, and SIWX protocols
// ABOUTME: All protocols normalize into PaymentCandidate before entering the selection pipeline

import type { RouterMethod } from './method.js';

export type Protocol = 'x402' | 'mpp' | 'siwx';

export interface NormalizedPayment {
  realm: string;
  protocol: Protocol;
  method: string;
  intent: string;
  amount?: bigint;
  currency?: string;
  recipient?: string;
  expiresAt?: number;
  hasDigestBinding: boolean;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

export interface PaymentCandidate {
  id: string;
  protocol: Protocol;
  method: RouterMethod;
  normalized: NormalizedPayment;
  raw: unknown;
  eligible: boolean;
  rejectionReason?: string;
  score?: number;
}
