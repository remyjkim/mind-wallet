// ABOUTME: RouterMethod implementation for MPP/Tempo charge and session payment intents
// ABOUTME: Wraps mppx Tempo.Methods to normalize 402 challenges and create signed EVM credentials

import { Challenge, Credential, Method as MppxMethod } from 'mppx';
import { Methods as TempoMethods } from 'mppx/tempo';
import type { RouterMethod, PaymentCandidate, NormalizedPayment } from '@mindwallet/core';
import type { Account as ViemAccount } from 'viem';
import { createPublicClient, http } from 'viem';

export interface TempoMethodConfig {
  /** viem Account used for signing charge and session credentials. */
  account: ViemAccount;
  /** Override the default Tempo RPC URL. */
  rpcUrl?: string;
}

/**
 * Creates a RouterMethod that handles MPP/Tempo `charge` and `session` intents.
 *
 * `account` must be a viem Account (local or JSON-RPC).  For pull mode (local
 * account) the signed tx is embedded in the credential; for push mode the
 * account broadcasts the tx and the hash is embedded.
 */
export function createTempoMethod(config: TempoMethodConfig): RouterMethod {
  const chargeClient = MppxMethod.toClient(TempoMethods.charge, {
    async createCredential({ challenge }) {
      const chainId = (challenge.request as Record<string, unknown>)['chainId'] as number | undefined;
      const rpcUrl = config.rpcUrl ?? `https://rpc.${chainId === 42431 ? 'moderato.' : ''}tempo.xyz`;

      const { prepareTransactionRequest, signTransaction } = await import('viem/actions');
      const { Actions } = await import('viem/tempo');
      const { tempo: tempoChain } = await import('viem/chains');

      const publicClient = createPublicClient({
        chain: tempoChain,
        transport: http(rpcUrl),
      });

      const req = challenge.request as Record<string, unknown>;
      const transferCall = Actions.token.transfer.call({
        amount: BigInt(req['amount'] as string),
        to: req['recipient'] as `0x${string}`,
        token: req['currency'] as `0x${string}`,
        memo: '0x' as `0x${string}`,
      });

      // Use 'as any' — prepareTransactionRequest with calls is extended by viem/tempo
      const prepared = await (prepareTransactionRequest as any)(publicClient as any, {
        account: config.account,
        calls: [transferCall],
        nonceKey: 'expiring',
      });
      prepared.gas = prepared.gas + 5000n;

      const signature = await signTransaction(publicClient as any, prepared);
      return Credential.serialize({
        challenge,
        payload: { signature, type: 'transaction' },
        source: `did:pkh:eip155:${chainId ?? 4217}:${config.account.address}`,
      });
    },
  });

  const sessionClient = MppxMethod.toClient(TempoMethods.session, {
    async createCredential({ challenge }) {
      // Session voucher: sign the cumulative-amount message with EIP-191
      const req = challenge.request as Record<string, unknown>;
      const { signMessage } = await import('viem/actions');
      const { tempo: tempoChain } = await import('viem/chains');
      const rpcUrl = config.rpcUrl ?? 'https://rpc.tempo.xyz';
      const publicClient = createPublicClient({ chain: tempoChain, transport: http(rpcUrl) });
      const channelId = req['methodDetails'] !== undefined
        ? (req['methodDetails'] as Record<string, unknown>)['channelId'] as string
        : undefined;
      if (!channelId) throw new Error('Tempo session: channelId required in challenge');
      const cumulativeAmount = req['amount'] as string;
      // Voucher message is keccak256(abi.encode(channelId, cumulativeAmount))
      const { keccak256, encodeAbiParameters, parseAbiParameters } = await import('viem');
      const msgHash = keccak256(
        encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [
          channelId as `0x${string}`,
          BigInt(cumulativeAmount),
        ]),
      );
      const signature = await signMessage(publicClient as any, {
        account: config.account,
        message: { raw: msgHash },
      });
      return Credential.serialize({
        challenge,
        payload: { action: 'voucher', channelId, cumulativeAmount, signature },
        source: `did:pkh:eip155:4217:${config.account.address}`,
      });
    },
  });

  return {
    id: 'tempo',
    protocol: 'mpp',

    canHandle(candidate: PaymentCandidate): boolean {
      return candidate.normalized.method === 'tempo';
    },

    normalize(raw: unknown): NormalizedPayment {
      const r = raw as Record<string, unknown>;
      const amountRaw = r['amount'];
      return {
        realm: String(r['realm'] ?? ''),
        protocol: 'mpp',
        method: 'tempo',
        intent: (String(r['intent'] ?? 'charge')) as 'charge' | 'session',
        amount: amountRaw !== undefined ? BigInt(String(amountRaw)) : undefined,
        currency: r['currency'] !== undefined ? String(r['currency']) : undefined,
        hasDigestBinding: Boolean(r['digest']),
      };
    },

    async createCredential({ candidate }): Promise<Record<string, string>> {
      const challenge = Challenge.from({
        id: candidate.id,
        realm: candidate.normalized.realm,
        method: 'tempo',
        intent: candidate.normalized.intent,
        request: candidate.raw as Record<string, unknown>,
      }) as any;

      let authorization: string;
      if (candidate.normalized.intent === 'charge') {
        authorization = await chargeClient.createCredential({ challenge });
      } else if (candidate.normalized.intent === 'session') {
        authorization = await sessionClient.createCredential({ challenge });
      } else {
        throw new Error(`Unsupported Tempo intent: ${candidate.normalized.intent}`);
      }
      return { Authorization: authorization };
    },
  };
}
