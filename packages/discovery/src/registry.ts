// ABOUTME: Queries a payment-method registry to find origins supporting specific protocols
// ABOUTME: Registry responses are JSON arrays of OriginRecord objects

export interface OriginRecord {
  origin: string;
  protocols: string[];
  description?: string;
  methods?: string[];
}

export interface RegistrySearchOptions {
  /** Registry base URL. Defaults to the Bazaar public registry. */
  registryUrl?: string;
  /** Filter by protocol name (e.g. 'mpp', 'x402', 'siwx'). */
  protocol?: string;
  /** Free-text keyword to filter origins by description or origin URL. */
  query?: string;
  /** Maximum number of results to return. Defaults to 20. */
  limit?: number;
}

const DEFAULT_REGISTRY = 'https://registry.bazaar.it';

function registryBaseUrl(): string {
  return process.env['MINDPASS_REGISTRY_URL'] ?? DEFAULT_REGISTRY;
}

/**
 * Searches a payment-method registry for origins matching the given criteria.
 *
 * Returns an empty array on network failure rather than throwing, so callers
 * can degrade gracefully when the registry is unreachable.
 */
export async function searchRegistry(
  options: RegistrySearchOptions = {},
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<OriginRecord[]> {
  const base = options.registryUrl ?? registryBaseUrl();
  const params = new URLSearchParams();
  if (options.protocol) params.set('protocol', options.protocol);
  if (options.query) params.set('q', options.query);
  if (options.limit !== undefined) params.set('limit', String(options.limit));

  const url = `${base}/origins${params.size > 0 ? `?${params}` : ''}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    return [];
  }

  if (!response.ok) return [];

  try {
    const json = await response.json();
    return Array.isArray(json) ? (json as OriginRecord[]) : (json as any).origins ?? [];
  } catch {
    return [];
  }
}
