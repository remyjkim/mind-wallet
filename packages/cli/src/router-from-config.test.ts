// ABOUTME: Tests for convertPolicy which transforms PolicyRuleConfig[] into PolicyRule[]
// ABOUTME: Validates budget, deny-protocol, and prefer-protocol rule conversion with defaults

import { describe, it, expect } from 'vitest';
import { convertPolicy } from './router-from-config.js';

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
