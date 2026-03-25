// ABOUTME: RouterMethod implementation for SIWX (Sign-In-With-X) authentication challenges
// ABOUTME: Signs a wallet proof message and returns it as a Bearer token in Authorization header

import type { RouterMethod, PaymentCandidate, NormalizedPayment } from '@mindwallet/core';

/**
 * Creates a RouterMethod that handles SIWX authentication challenges.
 *
 * SIWX challenges ask the client to sign a domain-binding message with
 * their wallet to prove ownership of an address.  No on-chain payment
 * is made; the signed message is the credential.
 */
export function createSiwxMethod(): RouterMethod {
  return {
    id: 'siwx',
    protocol: 'siwx',

    canHandle(candidate: PaymentCandidate): boolean {
      return candidate.protocol === 'siwx';
    },

    normalize(raw: unknown): NormalizedPayment {
      const r = raw as Record<string, unknown>;
      const domain = String(r['domain'] ?? r['realm'] ?? '');
      const realm = domain.startsWith('http') ? domain : `https://${domain}`;
      return {
        realm,
        protocol: 'siwx',
        method: 'siwx',
        intent: 'charge',
        amount: undefined,   // SIWX is free — no payment amount
        currency: undefined,
        hasDigestBinding: false,
      };
    },

    async createCredential({ candidate, wallet }): Promise<Record<string, string>> {
      const raw = candidate.raw as Record<string, unknown>;
      const walletId = String(raw['walletId'] ?? raw['wallet_id'] ?? '');
      const chainId = String(raw['chainId'] ?? raw['chain_id'] ?? 'eip155:1');
      const nonce = String(raw['nonce'] ?? '');
      const domain = String(raw['domain'] ?? raw['realm'] ?? candidate.normalized.realm);
      const issuedAt = new Date().toISOString();

      // Build a SIWE-compatible message
      const account = await wallet.getAccount(walletId, chainId);
      const message = [
        `${domain} wants you to sign in with your Ethereum account:`,
        account.address,
        '',
        `URI: ${candidate.normalized.realm}`,
        `Version: 1`,
        `Chain ID: ${chainId.split(':')[1] ?? '1'}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
      ].join('\n');

      const signature = await wallet.signMessage({ walletId, chainId, message, encoding: 'utf8' });
      const token = Buffer.from(JSON.stringify({ message, signature })).toString('base64url');
      return { Authorization: `Bearer ${token}` };
    },
  };
}
