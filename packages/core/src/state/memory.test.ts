// packages/core/src/state/memory.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryStore } from './memory.js';
import type { RouterStateStore } from '../types/state.js';

describe('createMemoryStore', () => {
  let store: RouterStateStore;

  beforeEach(() => {
    store = createMemoryStore();
  });

  it('returns undefined for missing session channel', async () => {
    const result = await store.getSessionChannel('missing-key');
    expect(result).toBeUndefined();
  });

  it('stores and retrieves a session channel', async () => {
    await store.putSessionChannel({
      realm: 'https://api.example.com',
      channelId: 'ch-1',
      method: 'tempo',
      updatedAt: Date.now(),
      scopeKey: 'https://api.example.com:tempo',
    });
    const result = await store.getSessionChannel('https://api.example.com:tempo');
    expect(result?.channelId).toBe('ch-1');
  });

  it('records and retrieves outcomes', async () => {
    const now = Date.now();
    await store.recordOutcome({
      realm: 'https://api.example.com',
      method: 'tempo',
      protocol: 'mpp',
      intent: 'charge',
      ok: true,
      durationMs: 120,
      at: now,
    });
    const outcomes = await store.getOutcomes({
      realm: 'https://api.example.com',
      since: now - 1000,
    });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.durationMs).toBe(120);
  });

  it('stores and retrieves entitlements', async () => {
    await store.putEntitlement({
      realm: 'https://api.example.com',
      token: 'bearer-token-123',
      expiresAt: Date.now() + 3600_000,
      walletAddress: '0xabc',
    });
    const ent = await store.getEntitlement('https://api.example.com');
    expect(ent?.token).toBe('bearer-token-123');
  });

  it('deletes entitlement', async () => {
    await store.putEntitlement({
      realm: 'https://api.example.com',
      token: 'tok',
      expiresAt: Date.now() + 3600_000,
      walletAddress: '0x1',
    });
    await store.deleteEntitlement('https://api.example.com');
    expect(await store.getEntitlement('https://api.example.com')).toBeUndefined();
  });
});
