// ABOUTME: Probes an HTTP origin to discover its payment protocol requirements
// ABOUTME: Makes a GET request and parses the 402 response headers and body

import { parseHttpChallenges } from '@mindwallet/core';
import type { RouterMethod, PaymentCandidate } from '@mindwallet/core';

export interface ProbeResult {
  url: string;
  reachable: boolean;
  requires402: boolean;
  candidates: PaymentCandidate[];
  error?: string;
}

/**
 * Probes an endpoint URL to discover what payment methods it requires.
 *
 * Issues a GET request without credentials.  If the server responds with 402,
 * parses the payment challenge headers and body and returns the candidates.
 */
export async function probeOrigin(
  url: string,
  methods: RouterMethod[],
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<ProbeResult> {
  let response: Response;
  try {
    response = await fetchImpl(url, { method: 'GET' });
  } catch (err) {
    return { url, reachable: false, requires402: false, candidates: [], error: String(err) };
  }

  if (response.status !== 402) {
    return { url, reachable: true, requires402: false, candidates: [] };
  }

  let body: unknown = null;
  try {
    const text = await response.text();
    body = JSON.parse(text);
  } catch {
    // non-JSON body — leave null
  }

  const candidates = parseHttpChallenges(response, body, methods);
  return { url, reachable: true, requires402: true, candidates };
}
