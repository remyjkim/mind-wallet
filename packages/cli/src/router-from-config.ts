// ABOUTME: Builds a MindRouter from a MindwalletConfig, wiring protocols and policy rules
// ABOUTME: Creates OWS wallet adapter, instantiates methods, and calls createRouter

import {
  OwsWalletAdapter,
  createMemoryStore,
  createRouter,
  type MindRouter,
  type PolicyRule,
} from '@mindwallet/core';
import { createSiwxMethod } from '@mindwallet/protocols';
import type { MindwalletConfig, PolicyRuleConfig } from './config.js';

export function convertPolicy(rules: PolicyRuleConfig[] | undefined): PolicyRule[] {
  return (rules ?? []).map((rule): PolicyRule => {
    if (rule.type === 'budget') {
      return {
        type: 'budget',
        currency: rule.currency ?? 'USDC',
        amount: BigInt(rule.limit ?? '0'),
        window: rule.window ?? 'daily',
      };
    }
    if (rule.type === 'deny-protocol') {
      return { type: 'deny-protocol', protocols: [rule.protocol as any] };
    }
    if (rule.type === 'prefer-protocol') {
      return { type: 'prefer-protocol', protocol: rule.protocol as any, boost: rule.boost ?? 0.1 };
    }
    throw new Error(`Unknown policy rule type: ${(rule as any).type}`);
  });
}

/**
 * Builds a configured MindRouter from the loaded CLI config.
 *
 * Tempo and x402 methods require viem accounts and RPC URLs which are
 * provisioned at runtime.  SIWX is always included.
 */
export function routerFromConfig(config: MindwalletConfig): {
  router: MindRouter;
  wallet: OwsWalletAdapter;
} {
  const wallet = new OwsWalletAdapter({
    walletId: config.walletId,
    vaultPath: config.vaultPath,
    passphrase: config.passphrase,
  });

  const state = createMemoryStore();

  const policy = convertPolicy(config.policy);

  const router = createRouter({
    methods: [createSiwxMethod()],
    state,
    policy,
  });

  return { router, wallet };
}
