// ABOUTME: Public entry point for @mindwallet/test-server
// ABOUTME: Exports startTestServer factory that spins up a local payment-gated Hono server

import { serve } from '@hono/node-server';
import { createApp, type ServerConfig } from './server.js';

export type { ServerConfig } from './server.js';
export type { X402Config } from './x402.js';
export type { MppConfig } from './mpp.js';

export interface TestServerHandle {
  /** Base URL of the running server, e.g. "http://127.0.0.1:54321" */
  url: string;
  /** Shuts down the server */
  close(): Promise<void>;
}

/**
 * Starts a local Hono server with x402 and MPP payment-gated endpoints.
 * Listens on 127.0.0.1 with a random port.
 *
 * The x402 middleware needs the facilitator URL (which includes the port),
 * but the port isn't known until the server starts. We use a mutable ref
 * object — the middleware reads the URL at request time, not construction time.
 */
export async function startTestServer(config: ServerConfig): Promise<TestServerHandle> {
  const facilitatorRef = { url: '' };
  const app = createApp(config, facilitatorRef);

  return new Promise((resolve) => {
    const server = serve(
      { fetch: app.fetch, port: 0, hostname: '127.0.0.1' },
      (info) => {
        const url = `http://127.0.0.1:${info.port}`;
        facilitatorRef.url = `${url}/facilitator`;
        resolve({
          url,
          close: () => new Promise<void>((r) => { server.close(() => r()); }),
        });
      },
    );
  });
}
