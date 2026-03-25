// ABOUTME: Telemetry hook interface for fire-and-forget observability
// ABOUTME: Credential material must never appear in these hooks

import type { Protocol } from './challenge.js';
import type { SelectionDecision } from './selection.js';

export interface RouterContext {
  transport: 'http' | 'mcp' | (string & {});
  realm?: string;
  url?: string;
  operationId?: string;
  jsonRpcMethod?: string;
  now?: Date;
}

export interface CandidateSummary {
  id: string;
  protocol: Protocol;
  method: string;
  intent: string;
}

export interface PaymentReceipt {
  status: 'success';
  method: string;
  timestamp: string;
  reference: string;
  externalId?: string;
  challengeId?: string;
}

export interface Telemetry {
  onChallengeSeen?(args: {
    transport: string;
    realm: string;
    candidates: CandidateSummary[];
    ctx: RouterContext;
  }): void;
  onDecision?(decision: SelectionDecision, ctx: RouterContext): void;
  onAttempt?(args: {
    candidateId: string;
    protocol: Protocol;
    method: string;
    phase: 'createCredential' | 'sendPaidRequest';
    ctx: RouterContext;
  }): void;
  onReceipt?(args: {
    receipt: PaymentReceipt;
    transport: string;
    realm?: string;
    ctx: RouterContext;
  }): void;
  onEntitlementCached?(args: {
    realm: string;
    expiresAt: number;
    ctx: RouterContext;
  }): void;
  onError?(args: {
    code: string;
    message: string;
    transport: string;
    ctx: RouterContext;
  }): void;
  onAlert?(args: {
    severity: 'info' | 'warn' | 'error';
    code: string;
    message: string;
    ctx: RouterContext;
  }): void;
}
