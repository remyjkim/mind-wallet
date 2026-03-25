// ABOUTME: Parses all payment challenges from a 402 HTTP response
// ABOUTME: Reads WWW-Authenticate (MPP), PAYMENT-REQUIRED (x402), and response body (SIWX/Bazaar)

import type { RouterMethod } from '../types/method.js';
import type { PaymentCandidate } from '../types/challenge.js';

export function parseHttpChallenges(
  response: Response,
  body: unknown,
  methods: RouterMethod[],
): PaymentCandidate[] {
  const candidates: PaymentCandidate[] = [];

  // Parse MPP challenges from WWW-Authenticate headers
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() !== 'www-authenticate') continue;
    for (const raw of splitPaymentChallenges(value)) {
      const parsed = parsePaymentParams(raw);
      if (!parsed) continue;
      for (const method of methods) {
        const candidate: PaymentCandidate = {
          id: parsed['id'] ?? `mpp-${Date.now()}`,
          protocol: 'mpp',
          method,
          normalized: method.normalize(parsed),
          raw: parsed,
          eligible: true,
        };
        if (method.canHandle(candidate)) {
          candidates.push(candidate);
          break;
        }
      }
    }
  }

  // Parse x402 challenge from PAYMENT-REQUIRED header
  const paymentRequired = response.headers.get('payment-required');
  if (paymentRequired) {
    try {
      const decoded = Buffer.from(paymentRequired, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded);
      for (const method of methods) {
        const candidate: PaymentCandidate = {
          id: `x402-${Date.now()}`,
          protocol: 'x402',
          method,
          normalized: method.normalize(parsed),
          raw: parsed,
          eligible: true,
        };
        if (method.canHandle(candidate)) {
          candidates.push(candidate);
          break;
        }
      }
    } catch {
      // malformed x402 header — skip
    }
  }

  // Parse SIWX challenge from response body
  if (body && typeof body === 'object') {
    const extensions = (body as any)?.extensions;
    const siwx = extensions?.['sign-in-with-x'];
    const bazaar = extensions?.['bazaar'];

    if (siwx) {
      for (const method of methods) {
        const candidate: PaymentCandidate = {
          id: `siwx-${Date.now()}`,
          protocol: 'siwx',
          method,
          normalized: {
            ...method.normalize(siwx),
            inputSchema: bazaar?.inputSchema,
            outputSchema: bazaar?.outputSchema,
          },
          raw: siwx,
          eligible: true,
        };
        if (method.canHandle(candidate)) {
          candidates.push(candidate);
          break;
        }
      }
    }

    // Attach Bazaar schemas to existing candidates if present
    if (bazaar) {
      for (const c of candidates) {
        if (!c.normalized.inputSchema) c.normalized.inputSchema = bazaar.inputSchema;
        if (!c.normalized.outputSchema) c.normalized.outputSchema = bazaar.outputSchema;
      }
    }
  }

  return candidates;
}

function splitPaymentChallenges(header: string): string[] {
  const parts: string[] = [];
  const regex = /(?:^|,\s*)Payment\s+/gi;
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(header)) !== null) {
    starts.push(match.index + match[0].length);
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const end = i + 1 < starts.length ? findEnd(header, starts[i + 1]!) : header.length;
    parts.push(header.slice(start, end).trim());
  }
  return parts;
}

function findEnd(header: string, nextStart: number): number {
  let i = nextStart - 1;
  while (i > 0 && header[i] !== ',') i--;
  return i > 0 ? i : nextStart;
}

function parsePaymentParams(raw: string): Record<string, string> | null {
  const params: Record<string, string> = {};
  const regex = /(\w+)="([^"]*?)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(raw)) !== null) {
    params[m[1]!] = m[2]!;
  }
  if (!params['realm'] || !params['method'] || !params['intent']) return null;

  // Decode base64url request field and merge into params
  if (params['request']) {
    try {
      const decoded = Buffer.from(params['request'], 'base64url').toString('utf8');
      const requestBody = JSON.parse(decoded);
      Object.assign(params, requestBody);
    } catch {
      return null;
    }
  }

  return params;
}
