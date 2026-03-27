// ABOUTME: Tests for convertPolicy which transforms PolicyRuleConfig[] into PolicyRule[]
// ABOUTME: Validates budget, deny-protocol, and prefer-protocol rule conversion with defaults

import { describe, it, expect } from 'vitest';
import { convertPolicy, routerFromConfig } from './router-from-config.js';

describe('convertPolicy', () => {
  it('converts a budget rule with defaults', () => {
    const result = convertPolicy([{ type: 'budget' }]);
    expect(result).toEqual([
      { type: 'budget', currency: 'USDC', amount: 0n, window: 'daily' },
    ]);
  });

  it('converts a budget rule with explicit values', () => {
    const result = convertPolicy([
      { type: 'budget', currency: 'ETH', limit: '500', window: 'monthly' },
    ]);
    expect(result).toEqual([
      { type: 'budget', currency: 'ETH', amount: 500n, window: 'monthly' },
    ]);
  });

  it('converts a deny-protocol rule', () => {
    const result = convertPolicy([{ type: 'deny-protocol', protocol: 'x402' }]);
    expect(result).toEqual([
      { type: 'deny-protocol', protocols: ['x402'] },
    ]);
  });

  it('converts a prefer-protocol rule with default boost', () => {
    const result = convertPolicy([{ type: 'prefer-protocol', protocol: 'siwx' }]);
    expect(result).toEqual([
      { type: 'prefer-protocol', protocol: 'siwx', boost: 0.1 },
    ]);
  });

  it('converts a prefer-protocol rule with explicit boost', () => {
    const result = convertPolicy([
      { type: 'prefer-protocol', protocol: 'tempo', boost: 0.5 },
    ]);
    expect(result).toEqual([
      { type: 'prefer-protocol', protocol: 'tempo', boost: 0.5 },
    ]);
  });

  it('converts multiple rules preserving order', () => {
    const result = convertPolicy([
      { type: 'budget', currency: 'USDC', limit: '100', window: 'daily' },
      { type: 'deny-protocol', protocol: 'x402' },
      { type: 'prefer-protocol', protocol: 'siwx', boost: 0.2 },
    ]);
    expect(result).toEqual([
      { type: 'budget', currency: 'USDC', amount: 100n, window: 'daily' },
      { type: 'deny-protocol', protocols: ['x402'] },
      { type: 'prefer-protocol', protocol: 'siwx', boost: 0.2 },
    ]);
  });

  it('returns empty array for undefined policy', () => {
    const result = convertPolicy(undefined);
    expect(result).toEqual([]);
  });

  it('throws on unknown rule type', () => {
    expect(() =>
      convertPolicy([{ type: 'garbage' as any }]),
    ).toThrow('Unknown policy rule type: garbage');
  });
});

describe('routerFromConfig', () => {
  it('throws when both privateKey and walletId are set', () => {
    expect(() =>
      routerFromConfig({
        privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        walletId: 'some-wallet',
      }),
    ).toThrow('Cannot set both privateKey and walletId');
  });

  it('creates three methods (siwx + x402 + tempo) when privateKey is set', () => {
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    });
    expect(ctx.methods).toHaveLength(3);
    expect(ctx.wallet).toBeDefined();
    expect(ctx.router).toBeDefined();
    expect(ctx.state).toBeDefined();
  });

  it('creates one method (siwx only) in OWS mode', () => {
    const ctx = routerFromConfig({
      walletId: 'test-wallet',
      vaultPath: '/tmp/test-vault',
    });
    expect(ctx.methods).toHaveLength(1);
  });

  it('uses OWS defaults when neither privateKey nor walletId are set', () => {
    const ctx = routerFromConfig({});
    expect(ctx.methods).toHaveLength(1);
    expect(ctx.wallet).toBeDefined();
  });

  it('passes custom chainIds to private key adapter', async () => {
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      chainIds: ['eip155:8453'],
    });
    await expect(ctx.wallet.canSign('eip155:8453')).resolves.toBe(true);
    await expect(ctx.wallet.canSign('eip155:1')).resolves.toBe(false);
  });

  it('passes rpcUrls.tempo to Tempo method', () => {
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      rpcUrls: { tempo: 'https://custom-tempo.example.com' },
    });
    expect(ctx.methods).toHaveLength(3);
  });

  it('passes tempoGas to Tempo method in private key mode', () => {
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      tempoGas: '200000',
    });
    expect(ctx.methods).toHaveLength(3);
  });

  it('merges user policy with implicit x402 boost in private key mode', () => {
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      policy: [{ type: 'deny-protocol', protocol: 'mpp' }],
    });
    expect(ctx.router).toBeDefined();
    expect(ctx.methods).toHaveLength(3);
  });
});
