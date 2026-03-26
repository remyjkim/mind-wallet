// ABOUTME: Configures the mppx Hono middleware for a Tempo charge endpoint on Moderato testnet
// ABOUTME: Exports a factory that returns the Mppx instance for use in route definitions

import type { MiddlewareHandler } from 'hono';
import { Mppx, tempo } from 'mppx/hono';

export interface MppConfig {
  /** Recipient address for Tempo charge payments */
  recipient: `0x${string}`;
  /** HMAC secret key for stateless challenge binding */
  secretKey: string;
  /** Whether to wait for on-chain transaction confirmation. @default true */
  waitForConfirmation?: boolean;
}

export interface MppHandler {
  charge(options: { amount: string }): MiddlewareHandler;
}

/**
 * Creates a Hono-aware mppx payment handler configured for Tempo on Moderato testnet.
 */
export function createMppHandler(config: MppConfig): MppHandler {
  return Mppx.create({
    methods: [
      tempo({
        testnet: true,
        recipient: config.recipient,
        waitForConfirmation: config.waitForConfirmation ?? true,
        secretKey: config.secretKey,
      }),
    ],
    secretKey: config.secretKey,
  });
}
