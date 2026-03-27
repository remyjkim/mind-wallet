// ABOUTME: Shared test utilities for CLI integration tests
// ABOUTME: Provides a local SIWX test server and OWS vault setup helpers

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createWallet } from '@open-wallet-standard/core';
import { startTestServer, type TestServerHandle } from '@mindpass/test-server';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MindpassConfig } from './config.js';
import { makeTempConfigHome, writeMindpassConfig } from './cli-binary-test-helpers.js';

export const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

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

export function makePrivateKeyConfig(overrides: Partial<MindpassConfig> = {}): MindpassConfig {
  return {
    privateKey: TEST_PRIVATE_KEY,
    chainIds: ['eip155:8453'],
    ...overrides,
  };
}

export async function startLocalPaymentTestServer(): Promise<TestServerHandle> {
  return startTestServer({
    x402PayTo: '0x0000000000000000000000000000000000000001',
    mppRecipient: '0x0000000000000000000000000000000000000001',
    mppWaitForConfirmation: false,
  });
}

export interface TempOwsFixture {
  home: string;
  vaultPath: string;
  walletId: string;
  configPath: string;
}

export function createTempOwsFixture(overrides: Partial<MindpassConfig> = {}): TempOwsFixture {
  const home = makeTempConfigHome();
  const walletId = overrides.walletId ?? 'default';
  const vaultPath = overrides.vaultPath ?? mkdtempSync(join(tmpdir(), 'mw-ows-vault-'));

  createWallet(walletId, undefined, 12, vaultPath);
  const configPath = writeMindpassConfig(home, {
    walletId,
    vaultPath,
    ...overrides,
  });

  return {
    home,
    vaultPath,
    walletId,
    configPath,
  };
}
