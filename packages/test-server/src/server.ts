// ABOUTME: Hono application that combines x402, MPP, and facilitator routes
// ABOUTME: Exposes payment-gated endpoints for integration testing

import { Hono } from 'hono';
import { createFacilitatorRoutes } from './facilitator.js';
import { x402Paywall, type X402Config } from './x402.js';
import { createMppHandler, type MppConfig } from './mpp.js';

export interface ServerConfig {
  /** x402 network identifier. @default "eip155:84532" (Base Sepolia) */
  network?: string;
  /** x402 payment recipient address */
  x402PayTo: string;
  /** x402 token contract address. @default Base Sepolia USDC */
  x402Asset?: string;
  /** x402 payment amount in smallest unit. @default "100" */
  x402Amount?: string;
  /** MPP/Tempo recipient address */
  mppRecipient: `0x${string}`;
  /** HMAC secret for mppx challenge binding. @default "test-secret-key" */
  mppSecretKey?: string;
  /** Whether Tempo waits for on-chain confirmation. @default true */
  mppWaitForConfirmation?: boolean;
}

const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export function createApp(config: ServerConfig, facilitatorRef: { url: string }) {
  const app = new Hono();
  const network = config.network ?? 'eip155:84532';

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Embedded x402 facilitator
  app.route('/facilitator', createFacilitatorRoutes(network));

  // x402-gated endpoint
  const x402Config: X402Config = {
    network,
    payTo: config.x402PayTo,
    asset: config.x402Asset ?? BASE_SEPOLIA_USDC,
    amount: config.x402Amount ?? '100',
    facilitatorRef,
  };
  app.get('/x402/data', x402Paywall(x402Config), (c) =>
    c.json({ data: 'paid x402 content' }),
  );

  // MPP-gated endpoint
  const mppx = createMppHandler({
    recipient: config.mppRecipient,
    secretKey: config.mppSecretKey ?? 'test-secret-key',
    waitForConfirmation: config.mppWaitForConfirmation ?? true,
  });
  app.get('/mpp/data', mppx.charge({ amount: '1' }), (c) =>
    c.json({ data: 'paid mpp content' }),
  );

  return app;
}
