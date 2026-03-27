// ABOUTME: Shared test utilities for CLI integration tests
// ABOUTME: Provides a local SIWX test server and OWS vault setup helpers

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export interface SiwxTestServer {
  port: number;
  url: string;
  close: () => Promise<void>;
}

/**
 * Starts a minimal HTTP server that issues SIWX 402 challenges and
 * accepts any Bearer credential on retry.
 */
export function startSiwxTestServer(): Promise<SiwxTestServer> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const authorization = req.headers['authorization'];

    if (!authorization) {
      const challenge = {
        domain: 'localhost',
        walletId: 'test-wallet',
        chainId: 'eip155:8453',
        nonce: `nonce-${Date.now()}`,
      };

      res.writeHead(402, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(
        JSON.stringify({
          error: 'payment_required',
          extensions: {
            'sign-in-with-x': challenge,
          },
        }),
      );
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({ data: 'protected content' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        port: addr.port,
        url,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}
