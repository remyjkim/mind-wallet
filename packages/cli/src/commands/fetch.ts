// ABOUTME: CLI command that fetches a URL with automatic 402 payment handling
// ABOUTME: Outputs the response body to stdout and payment details to stderr

import { wrapFetch } from '@mindpass/core';
import { routerFromConfig } from '../router-from-config.js';
import type { MindpassConfig } from '../config.js';

export interface FetchCommandOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  verbose?: boolean;
}

/**
 * Fetches `url` with automatic payment handling and prints the response body.
 */
export async function fetchCommand(
  url: string,
  config: MindpassConfig,
  options: FetchCommandOptions = {},
): Promise<void> {
  const { router, wallet, state } = routerFromConfig(config);
  const fetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: options.headers,
    body: options.body,
  };

  const response = await fetch(url, init);

  if (options.verbose) {
    process.stderr.write(`HTTP ${response.status} ${response.statusText}\n`);
    for (const [k, v] of response.headers.entries()) {
      process.stderr.write(`${k}: ${v}\n`);
    }
    process.stderr.write('\n');
  }

  const body = await response.text();
  process.stdout.write(body);
  if (body && !body.endsWith('\n')) process.stdout.write('\n');
}
