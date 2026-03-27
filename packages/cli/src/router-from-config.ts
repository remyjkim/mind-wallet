// ABOUTME: Builds a MindRouter from a MindwalletConfig, wiring protocols and policy rules
// ABOUTME: Supports both OWS vault wallets (SIWX) and private key wallets (SIWX + x402 + Tempo)

import { join } from 'node:path';
import { homedir } from 'node:os';
import { privateKeyToAccount } from 'viem/accounts';
import {
  OwsWalletAdapter,
  PrivateKeyWalletAdapter,
  createMemoryStore,
  createRouter,
  type MindRouter,
  type PolicyRule,
  type RouterMethod,
  type RouterStateStore,
  type WalletAdapter,
} from '@mindwallet/core';
import { createSiwxMethod, createTempoMethod, createX402Method } from '@mindwallet/protocols';
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
export interface RouterContext {
  router: MindRouter;
  wallet: WalletAdapter;
  state: RouterStateStore;
  methods: RouterMethod[];
}

export function routerFromConfig(config: MindwalletConfig): RouterContext {
  const state = createMemoryStore();
  const userPolicy = convertPolicy(config.policy);

  if (config.privateKey && config.walletId) {
    throw new Error('Cannot set both privateKey and walletId');
  }

  if (config.privateKey) {
    const account = privateKeyToAccount(config.privateKey);
    const wallet = new PrivateKeyWalletAdapter({
      privateKey: config.privateKey,
      chainIds: config.chainIds,
    });
    const methods: RouterMethod[] = [
      createSiwxMethod(),
      createX402Method({ account }),
      createTempoMethod({
        account,
        rpcUrl: config.rpcUrls?.['tempo'],
        gas: config.tempoGas !== undefined ? BigInt(config.tempoGas) : undefined,
        store: state,
      }),
    ];
    const policy: PolicyRule[] = [
      ...userPolicy,
      { type: 'prefer-protocol', protocol: 'x402' as any, boost: 0.1 },
    ];
    const router = createRouter({ methods, state, policy });
    return { router, wallet, state, methods };
  }

  const wallet = new OwsWalletAdapter({
    walletId: config.walletId ?? 'default',
    vaultPath: config.vaultPath ?? join(homedir(), '.minds', 'wallet', 'vault'),
    passphrase: config.passphrase,
  });
  const methods: RouterMethod[] = [createSiwxMethod()];
  const router = createRouter({ methods, state, policy: userPolicy });
  return { router, wallet, state, methods };
}
