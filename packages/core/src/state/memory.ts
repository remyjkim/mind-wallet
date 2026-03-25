// ABOUTME: In-memory RouterStateStore implementation for development and testing
// ABOUTME: All state is lost on process exit; use a persistent store for production

import type {
  RouterStateStore, SessionChannelState, OutcomeRecord, EntitlementRecord, OutcomeFilter
} from '../types/state.js';

export function createMemoryStore(): RouterStateStore {
  const channels = new Map<string, SessionChannelState>();
  const outcomes: OutcomeRecord[] = [];
  const entitlements = new Map<string, EntitlementRecord>();

  return {
    async getSessionChannel(scopeKey) {
      return channels.get(scopeKey);
    },
    async putSessionChannel(state) {
      channels.set(state.scopeKey, state);
    },
    async deleteSessionChannel(scopeKey) {
      channels.delete(scopeKey);
    },
    async recordOutcome(event) {
      outcomes.push(event);
    },
    async getOutcomes(filter: OutcomeFilter) {
      return outcomes.filter(o => {
        if (o.at < filter.since) return false;
        if (filter.realm && o.realm !== filter.realm) return false;
        if (filter.method && o.method !== filter.method) return false;
        if (filter.protocol && o.protocol !== filter.protocol) return false;
        if (filter.intent && o.intent !== filter.intent) return false;
        if (filter.currency && o.currency !== filter.currency) return false;
        return true;
      });
    },
    async getEntitlement(realm) {
      return entitlements.get(realm);
    },
    async putEntitlement(record) {
      entitlements.set(record.realm, record);
    },
    async deleteEntitlement(realm) {
      entitlements.delete(realm);
    },
  };
}
