// ABOUTME: Hono middleware that gates a route behind an x402 payment challenge
// ABOUTME: Issues PAYMENT-REQUIRED on 402, validates X-PAYMENT via the embedded facilitator on retry

import type { MiddlewareHandler } from 'hono';

export interface X402Config {
  /** CAIP-2 network identifier, e.g. "eip155:84532" */
  network: string;
  /** Address that receives payment */
  payTo: string;
  /** Token contract address (e.g. Base Sepolia USDC) */
  asset: string;
  /** Amount in smallest unit (e.g. "100" for 0.0001 USDC) */
  amount: string;
  /** Mutable ref to the facilitator base URL — populated after the server port is known */
  facilitatorRef: { url: string };
}

/**
 * Creates Hono middleware that implements the x402 server side:
 * - No payment header → 402 with PAYMENT-REQUIRED
 * - With payment header → verify + settle via facilitator → 200 with Payment-Receipt
 */
export function x402Paywall(config: X402Config): MiddlewareHandler {
  return async (c, next) => {
    const paymentHeader =
      c.req.header('x-payment') ??
      c.req.header('payment-signature');

    const resource = new URL(c.req.url).pathname;
    const paymentRequired = {
      x402Version: 2,
      accepts: [
        {
          scheme: 'exact',
          network: config.network,
          maxAmountRequired: config.amount,
          payTo: config.payTo,
          asset: config.asset,
          resource,
          description: 'Test payment endpoint',
          mimeType: 'application/json',
          maxTimeoutSeconds: 300,
          outputSchema: null,
          extra: null,
        },
      ],
    };

    if (!paymentHeader) {
      const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString('base64url');
      return c.json({ error: 'payment_required' }, 402, {
        'PAYMENT-REQUIRED': encoded,
      });
    }

    // Decode the payment payload
    let paymentPayload: Record<string, unknown>;
    try {
      const decoded = Buffer.from(paymentHeader, 'base64url').toString('utf8');
      paymentPayload = JSON.parse(decoded);
    } catch {
      return c.json({ error: 'invalid_payment_header' }, 400);
    }

    // Verify via facilitator
    const verifyRes = await fetch(`${config.facilitatorRef.url}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements: paymentRequired,
      }),
    });
    const verifyResult = (await verifyRes.json()) as { isValid: boolean };

    if (!verifyResult.isValid) {
      return c.json({ error: 'payment_verification_failed' }, 402);
    }

    // Settle via facilitator
    const settleRes = await fetch(`${config.facilitatorRef.url}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements: paymentRequired,
      }),
    });
    const settleResult = (await settleRes.json()) as Record<string, unknown>;

    // Serve the resource, attaching the receipt
    await next();

    const receipt = Buffer.from(
      JSON.stringify({ status: 'success', ...settleResult }),
    ).toString('base64url');
    c.header('Payment-Receipt', receipt);
  };
}
