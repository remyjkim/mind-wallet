// ABOUTME: CLI command that pays a specific endpoint and prints the response
// ABOUTME: Probes the URL first, then selects and executes the best payment method

import { probeOrigin } from '@mindwallet/discovery';
import { createSiwxMethod } from '@mindwallet/protocols';
import { wrapFetch, createMemoryStore, createRouter, OwsWalletAdapter } from '@mindwallet/core';
import type { MindwalletConfig } from '../config.js';

export interface PayCommandOptions {
  method?: string;
  verbose?: boolean;
}

/**
 * Probes `url`, displays discovered payment options, then pays and fetches.
 */
export async function payCommand(
  url: string,
  config: MindwalletConfig,
  options: PayCommandOptions = {},
): Promise<void> {
  const passphrase = config.passphrase ?? process.env['OWS_PASSPHRASE'];
  const wallet = new OwsWalletAdapter({
    walletId: config.walletId,
    vaultPath: config.vaultPath,
    passphrase,
  });

  const methods = [createSiwxMethod()];
  const state = createMemoryStore();
  const router = createRouter({ methods, state, policy: [] });

  // Probe first so we can show what's required
  const probe = await probeOrigin(url, methods);
  if (!probe.reachable) {
    console.error(`Error: ${url} is unreachable — ${probe.error}`);
    process.exitCode = 1;
    return;
  }

  if (options.verbose && probe.candidates.length > 0) {
    process.stderr.write(`Discovered ${probe.candidates.length} payment candidate(s):\n`);
    for (const c of probe.candidates) {
      const amt = c.normalized.amount !== undefined
        ? ` ${c.normalized.amount} ${c.normalized.currency ?? ''}`
        : '';
      process.stderr.write(`  [${c.protocol}] ${c.normalized.method} intent=${c.normalized.intent}${amt}\n`);
    }
  }

  const fetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });
  const response = await fetch(url, { method: options.method ?? 'GET' });

  if (options.verbose) {
    process.stderr.write(`HTTP ${response.status} ${response.statusText}\n`);
  }

  const body = await response.text();
  process.stdout.write(body);
  if (body && !body.endsWith('\n')) process.stdout.write('\n');
}
