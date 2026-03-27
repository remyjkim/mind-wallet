// ABOUTME: Searches a hub marketplace for Tier 1 self-hosted endpoint listings
// ABOUTME: Returns OriginRecord[] compatible with probeOrigin and the existing searchRegistry interface

import type { OriginRecord } from './registry.js';

export interface HubRegistrySearchOptions {
  /** Base URL of the hub, e.g. 'https://hub.iminds.space' */
  hubUrl: string;
  /** Filter by protocol name, e.g. 'x402', 'mpp', 'siwx' */
  protocol?: string;
  /** Free-text keyword matched against title, description, and tags */
  query?: string;
  /** Maximum number of results; hub caps at 100 */
  limit?: number;
}

export async function searchHubRegistry(
  options: HubRegistrySearchOptions,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<OriginRecord[]> {
  const base = options.hubUrl.replace(/\/$/, '');
  const url = new URL(`${base}/registry/origins`);
  if (options.protocol) url.searchParams.set('protocol', options.protocol);
  if (options.query) url.searchParams.set('q', options.query);
  if (options.limit !== undefined) url.searchParams.set('limit', String(options.limit));

  try {
    const response = await fetchImpl(url.toString());
    if (!response.ok) return [];
    return (await response.json()) as OriginRecord[];
  } catch {
    return [];
  }
}
