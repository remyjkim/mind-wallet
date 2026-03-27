// ABOUTME: CLI command that probes an HTTP origin to discover its payment requirements
// ABOUTME: Outputs protocol, method, intent, and amount for each detected candidate

import { probeOrigin } from '@mindpass/discovery';
import type { RouterMethod } from '@mindpass/core';

export interface DiscoverCommandOptions {
  methods: RouterMethod[];
  fetch?: typeof globalThis.fetch;
  output?: (line: string) => void;
  json?: boolean;
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
    if (options.json) {
      out(JSON.stringify(result, null, 2));
      return;
    }
    out(`Unreachable: ${result.error ?? 'unknown error'}`);
    return;
  }

  if (!result.requires402) {
    if (options.json) {
      out(JSON.stringify(result, null, 2));
      return;
    }
    out(`${origin}: No payment required (${result.url} returned non-402)`);
    return;
  }

  if (result.candidates.length === 0) {
    if (options.json) {
      out(JSON.stringify(result, null, 2));
      return;
    }
    out(`${origin}: Requires payment but no candidates were parsed`);
    return;
  }

  if (options.json) {
    out(JSON.stringify(result, null, 2));
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
