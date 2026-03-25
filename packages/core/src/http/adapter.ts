// ABOUTME: Wraps fetch to handle the full HTTP 402 payment lifecycle
// ABOUTME: Checks SIWX entitlement cache first, then runs the selection pipeline on 402 responses

import { parseHttpChallenges } from './parse.js';
import type { MindRouter } from '../router.js';
import type { RouterStateStore } from '../types/state.js';
import type { Telemetry, RouterContext } from '../types/telemetry.js';
import type { WalletAdapter } from '../types/wallet.js';

export interface WrapFetchOptions {
  fetch: typeof globalThis.fetch;
  router: MindRouter;
  state: RouterStateStore;
  wallet?: WalletAdapter;
  telemetry?: Telemetry;
  maxRetries?: number;
}

export function wrapFetch(options: WrapFetchOptions): typeof globalThis.fetch {
  const { fetch: innerFetch, router, state, telemetry, maxRetries = 2 } = options;

  return async (input, init) => {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : (input as Request).url;

    const realm = new URL(url).origin;

    // Check entitlement cache before making initial request
    const entitlement = await state.getEntitlement(realm).catch(() => undefined);
    if (entitlement && entitlement.expiresAt > Date.now()) {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${entitlement.token}`);
      const response = await innerFetch(input, { ...init, headers });
      if (response.status !== 401 && response.status !== 402) return response;
      // Entitlement rejected — evict and fall through to normal flow
      await state.deleteEntitlement(realm).catch(() => {});
    }

    let response = await innerFetch(input, init);
    let retries = 0;

    while (response.status === 402 && retries < maxRetries) {
      retries++;

      const bodyText = await response.clone().text().catch(() => '');
      let body: unknown = null;
      try { body = JSON.parse(bodyText); } catch {}

      const candidates = parseHttpChallenges(response, body, router.methods);
      const ctx: RouterContext = { transport: 'http', realm, url };

      telemetry?.onChallengeSeen?.({
        transport: 'http',
        realm,
        candidates: candidates.map(c => ({
          id: c.id,
          protocol: c.protocol,
          method: c.normalized.method,
          intent: c.normalized.intent,
        })),
        ctx,
      });

      if (candidates.length === 0) break;

      const outcome = await router.select(candidates, ctx);

      if (!outcome.ok) {
        telemetry?.onError?.({ code: outcome.error, message: outcome.detail, transport: 'http', ctx });
        break;
      }

      const { decision } = outcome;
      telemetry?.onDecision?.(decision, ctx);
      telemetry?.onAttempt?.({
        candidateId: decision.candidate.id,
        protocol: decision.candidate.protocol,
        method: decision.candidate.normalized.method,
        phase: 'createCredential',
        ctx,
      });

      const startMs = Date.now();
      let authorization: string;
      try {
        authorization = await decision.candidate.method.createCredential({
          candidate: decision.candidate,
          wallet: options.wallet!,
        });
      } catch (err) {
        telemetry?.onError?.({ code: 'CREDENTIAL_ERROR', message: String(err), transport: 'http', ctx });
        break;
      }

      telemetry?.onAttempt?.({
        candidateId: decision.candidate.id,
        protocol: decision.candidate.protocol,
        method: decision.candidate.normalized.method,
        phase: 'sendPaidRequest',
        ctx,
      });

      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set('Authorization', authorization);
      response = await innerFetch(input, { ...init, headers: retryHeaders });

      const durationMs = Date.now() - startMs;

      // Record outcome — always, regardless of response status
      await state.recordOutcome({
        realm,
        method: decision.candidate.normalized.method,
        protocol: decision.candidate.protocol,
        intent: decision.candidate.normalized.intent,
        ok: response.ok,
        durationMs,
        amount: decision.candidate.normalized.amount,
        currency: decision.candidate.normalized.currency,
        at: Date.now(),
      }).catch(() => {});

      if (response.ok) {
        const receipt = parseReceipt(response);
        if (receipt) {
          telemetry?.onReceipt?.({ receipt, transport: 'http', realm, ctx });
        }

        // Cache SIWX entitlement if server returns one
        const entitlementToken = response.headers.get('X-Entitlement-Token');
        const entitlementExpiry = response.headers.get('X-Entitlement-Expires');
        if (entitlementToken) {
          const expiresAt = entitlementExpiry
            ? new Date(entitlementExpiry).getTime()
            : Date.now() + 3_600_000;
          await state.putEntitlement({
            realm,
            token: entitlementToken,
            expiresAt,
            walletAddress: '',
          }).catch(() => {});
          telemetry?.onEntitlementCached?.({ realm, expiresAt, ctx });
        }
      }
    }

    return response;
  };
}

function parseReceipt(response: Response) {
  const header = response.headers.get('Payment-Receipt');
  if (!header) return null;
  try {
    const json = Buffer.from(header.trim(), 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed.status !== 'success') return null;
    return parsed;
  } catch {
    return null;
  }
}
