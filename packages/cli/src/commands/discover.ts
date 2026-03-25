// ABOUTME: CLI command that probes an HTTP origin to discover its payment requirements
// ABOUTME: Outputs protocol, method, intent, and amount for each detected candidate

import { probeOrigin } from '@mindwallet/discovery';
import type { RouterMethod } from '@mindwallet/core';

export interface DiscoverCommandOptions {
  methods: RouterMethod[];
  fetch?: typeof globalThis.fetch;
  output?: (line: string) => void;
}

/**
 * Probes `origin` for payment requirements and prints a summary.
 */
export async function discoverCommand(
  origin: string,
  options: DiscoverCommandOptions,
): Promise<void> {
  const out = options.output ?? console.log;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  const result = await probeOrigin(origin, options.methods, fetchImpl);

  if (!result.reachable) {
    out(`Unreachable: ${result.error ?? 'unknown error'}`);
    return;
  }

  if (!result.requires402) {
    out(`${origin}: No payment required (${result.url} returned non-402)`);
    return;
  }

  if (result.candidates.length === 0) {
    out(`${origin}: Requires payment but no candidates were parsed`);
    return;
  }

  out(`${origin}: ${result.candidates.length} payment candidate(s)`);
  for (const c of result.candidates) {
    const amount = c.normalized.amount !== undefined
      ? ` ${c.normalized.amount} ${c.normalized.currency ?? ''}`
      : '';
    out(`  protocol=${c.protocol}  method=${c.normalized.method}  intent=${c.normalized.intent}${amount}`);
  }
}
