// ABOUTME: Builds a MindRouter from a MindwalletConfig, wiring protocols and policy rules
// ABOUTME: Creates OWS wallet adapter, instantiates methods, and calls createRouter

import {
  OwsWalletAdapter,
  createMemoryStore,
  createRouter,
  type MindRouter,
} from '@mindwallet/core';
import { createSiwxMethod } from '@mindwallet/protocols';
import type { MindwalletConfig } from './config.js';

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
  const passphrase = config.passphrase ?? process.env['OWS_PASSPHRASE'];

  const wallet = new OwsWalletAdapter({
    walletId: config.walletId,
    vaultPath: config.vaultPath,
    passphrase,
  });

  const state = createMemoryStore();

  const policy = (config.policy ?? []).map((rule) => {
    if (rule.type === 'budget') {
      return {
        type: 'budget' as const,
        currency: rule.currency ?? 'USDC',
        limit: BigInt(rule.limit ?? '0'),
        window: rule.window ?? 'daily',
      };
    }
    if (rule.type === 'deny-protocol') {
      return { type: 'deny-protocol' as const, protocol: rule.protocol ?? '' };
    }
    if (rule.type === 'prefer-protocol') {
      return { type: 'prefer-protocol' as const, protocol: rule.protocol ?? '', boost: rule.boost ?? 0.1 };
    }
    throw new Error(`Unknown policy rule type: ${(rule as any).type}`);
  });

  const router = createRouter({
    methods: [createSiwxMethod()],
    state,
    policy,
  });

  return { router, wallet };
}
