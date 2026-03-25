// ABOUTME: State store interface for session channels, outcomes, and SIWX entitlements
// ABOUTME: Outcome history feeds the scorer; entitlement cache enables pay-once-reuse

import type { Protocol } from './challenge.js';

export interface SessionChannelState {
  realm: string;
  channelId: string;
  method: string;
  deposit?: bigint;
  acceptedCumulative?: bigint;
  spent?: bigint;
  updatedAt: number;
  scopeKey: string;
}

export interface OutcomeRecord {
  realm: string;
  method: string;
  protocol: Protocol;
  intent: string;
  ok?: boolean;
  durationMs?: number;
  amount?: bigint;
  currency?: string;
  at: number;
}

export interface EntitlementRecord {
  realm: string;
  token: string;
  expiresAt: number;
  walletAddress: string;
}

export interface OutcomeFilter {
  realm?: string;
  method?: string;
  protocol?: Protocol;
  intent?: string;
  currency?: string;
  since: number;
}

export interface RouterStateStore {
  getSessionChannel(scopeKey: string): Promise<SessionChannelState | undefined>;
  putSessionChannel(state: SessionChannelState): Promise<void>;
  deleteSessionChannel(scopeKey: string): Promise<void>;
  recordOutcome(event: OutcomeRecord): Promise<void>;
  getOutcomes(filter: OutcomeFilter): Promise<OutcomeRecord[]>;
  getEntitlement(realm: string): Promise<EntitlementRecord | undefined>;
  putEntitlement(record: EntitlementRecord): Promise<void>;
  deleteEntitlement(realm: string): Promise<void>;
}
