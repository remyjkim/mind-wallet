// ABOUTME: Embedded x402 facilitator for test use
// ABOUTME: Verifies credential format and returns settlement stubs without on-chain execution

import { Hono } from 'hono';

interface VerifySettleBody {
  x402Version: number;
  paymentPayload: {
    x402Version: number;
    scheme?: string;
    network?: string;
    payload: Record<string, unknown>;
    extensions?: Record<string, unknown>;
  };
  paymentRequirements: Record<string, unknown>;
}

interface VerificationRecord {
  paymentPayload: VerifySettleBody['paymentPayload'];
  paymentRequirements: VerifySettleBody['paymentRequirements'];
  verifiedAt: number;
}

/**
 * Creates Hono routes for a minimal x402 facilitator.
 *
 * Verify checks that the payment payload contains a non-empty signature.
 * Settle requires a prior successful verify call (tracked in memory).
 * No on-chain settlement occurs — this is for testing the protocol flow.
 */
export function createFacilitatorRoutes(network: string) {
  const app = new Hono();
  const verified = new Map<string, VerificationRecord>();

  app.get('/supported', (c) =>
    c.json({
      x402Version: 2,
      kinds: [{ scheme: 'exact', network }],
      extensions: [],
    }),
  );

  app.post('/verify', async (c) => {
    const body = (await c.req.json()) as VerifySettleBody;
    const signature = body?.paymentPayload?.payload?.signature;
    const isValid = typeof signature === 'string' && signature.length > 0;

    if (isValid) {
      const key = JSON.stringify(body.paymentPayload.payload);
      verified.set(key, {
        paymentPayload: body.paymentPayload,
        paymentRequirements: body.paymentRequirements,
        verifiedAt: Date.now(),
      });
    }

    return c.json({ isValid, ...(isValid ? { payer: body.paymentPayload.payload.from } : {}) });
  });

  app.post('/settle', async (c) => {
    const body = (await c.req.json()) as VerifySettleBody;
    const key = JSON.stringify(body?.paymentPayload?.payload);
    const record = verified.get(key);

    if (!record) {
      return c.json({ success: false, errorReason: 'not_verified' }, 400);
    }

    verified.delete(key);
    return c.json({
      success: true,
      network,
      transaction: `0xtest${Date.now().toString(16)}`,
      payer: body.paymentPayload.payload.from,
    });
  });

  return app;
}
