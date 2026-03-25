// ABOUTME: RouterMethod implementation for the x402 payment protocol
// ABOUTME: Creates EIP-3009 transferWithAuthorization credentials for USDC on EVM chains

import { x402Client } from '@x402/core/client';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import type { RouterMethod, PaymentCandidate, NormalizedPayment } from '@mindwallet/core';
import type { Account as ViemAccount } from 'viem';

export interface X402MethodConfig {
  /** viem Account used for signing EIP-712 typed-data credentials. */
  account: ViemAccount;
}

/**
 * Creates a RouterMethod that handles x402 payment challenges.
 *
 * The x402 challenge arrives as a base64url-encoded `PaymentRequired` JSON
 * in the `PAYMENT-REQUIRED` header.  The credential is returned as the
 * `X-PAYMENT` header containing a base64url-encoded `PaymentPayload`.
 */
export function createX402Method(config: X402MethodConfig): RouterMethod {
  return {
    id: 'x402',
    protocol: 'x402',

    canHandle(candidate: PaymentCandidate): boolean {
      return candidate.protocol === 'x402';
    },

    normalize(raw: unknown): NormalizedPayment {
      // raw is the decoded PaymentRequired JSON (may be v1 or v2)
      const r = raw as Record<string, unknown>;

      // v2: { x402Version: 2, accepts: [...] }
      const accepts = (r['accepts'] as Record<string, unknown>[] | undefined) ?? [];
      const first = accepts[0] ?? {};

      // v1: { x402Version: 1, accepts: [...] } same structure but different field names
      const maxAmount = String(first['maxAmountRequired'] ?? first['value'] ?? '0');
      const payTo = String(first['payTo'] ?? first['payee'] ?? '');
      const network = String(first['network'] ?? '');
      const asset = String(first['asset'] ?? first['currency'] ?? '');
      const resource = String(first['resource'] ?? r['resource'] ?? '');

      const realm = payTo && payTo.startsWith('http')
        ? new URL(payTo).origin
        : resource.startsWith('http')
          ? new URL(resource).origin
          : resource;

      return {
        realm,
        protocol: 'x402',
        method: 'x402',
        intent: 'charge',
        amount: BigInt(maxAmount || '0'),
        currency: asset || network,
        hasDigestBinding: false,
      };
    },

    async createCredential({ candidate }): Promise<Record<string, string>> {
      const paymentRequired = candidate.raw as Record<string, unknown>;

      // Register a custom EIP-3009 scheme client backed by our viem account
      const { createPublicClient, http, parseAbiItem } = await import('viem');
      const network = String(
        ((paymentRequired['accepts'] as Record<string, unknown>[])?.[0]?.['network']) ?? 'eip155:8453',
      );

      const [, chainIdStr] = network.split(':');
      const chainId = Number(chainIdStr ?? 8453);

      const client = x402Client.fromConfig({ schemes: [] });

      // Register a minimal EIP-3009 scheme client for EVM
      client.register(network as `eip155:${number}`, {
        scheme: 'exact',
        async createPaymentPayload(_version, requirements) {
          const { signTypedData } = await import('viem/actions');
          const rpcUrl = `https://mainnet.base.org`; // fallback for base
          const publicClient = createPublicClient({
            transport: http(rpcUrl),
          });

          const payTo = requirements.payTo as `0x${string}`;
          const asset = requirements.asset as `0x${string}`;
          const amount = BigInt(requirements.maxAmountRequired);
          const validAfter = BigInt(0);
          const validBefore = BigInt(Math.floor(Date.now() / 1000) + (requirements.maxTimeoutSeconds ?? 300));
          const nonce = crypto.getRandomValues(new Uint8Array(32));
          const nonceHex = `0x${Buffer.from(nonce).toString('hex')}` as `0x${string}`;

          // EIP-712 domain for USDC-style EIP-3009
          const domain = {
            name: 'USD Coin',
            version: '2',
            chainId,
            verifyingContract: asset,
          };

          const types = {
            TransferWithAuthorization: [
              { name: 'from', type: 'address' },
              { name: 'to', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'validAfter', type: 'uint256' },
              { name: 'validBefore', type: 'uint256' },
              { name: 'nonce', type: 'bytes32' },
            ],
          };

          const message = {
            from: config.account.address,
            to: payTo,
            value: amount,
            validAfter,
            validBefore,
            nonce: nonceHex,
          };

          const signature = await signTypedData(publicClient as any, {
            account: config.account,
            domain,
            types,
            primaryType: 'TransferWithAuthorization',
            message,
          });

          return {
            payload: {
              from: config.account.address,
              to: payTo,
              value: String(amount),
              validAfter: String(validAfter),
              validBefore: String(validBefore),
              nonce: nonceHex,
              v: 0,
              r: '0x',
              s: '0x',
              signature,
            },
            extensions: {},
          };
        },
      });

      const payload = await client.createPaymentPayload(paymentRequired as any);
      const headers = encodePaymentSignatureHeader(payload);
      return headers;
    },
  };
}
