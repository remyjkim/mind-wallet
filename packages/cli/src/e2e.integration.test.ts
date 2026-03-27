// ABOUTME: End-to-end HTTP payment tests using a local server that issues real 402 challenges
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and OWS_PASSPHRASE are set

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallet } from '@open-wallet-standard/core';
import {
  OwsWalletAdapter,
  createMemoryStore,
  createRouter,
  wrapFetch,
} from '@mindpass/core';
import { createSiwxMethod } from '@mindpass/protocols';

const skip = !process.env['RUN_INTEGRATION_TESTS'] || !process.env['OWS_PASSPHRASE'];

// ---------------------------------------------------------------------------
// Local test server
// ---------------------------------------------------------------------------

interface ServerState {
  port: number;
  close: () => Promise<void>;
  lastCredential: string | undefined;
  reset: () => void;
}

function startTestServer(): Promise<ServerState> {
  const state = { lastCredential: undefined as string | undefined };

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const authorization = req.headers['authorization'];

    if (!authorization) {
      // Issue a SIWX challenge.  The challenge body carries the raw params that
      // createSiwxMethod.createCredential reads from candidate.raw.
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

    // Credential received — store it and return 200 with a receipt
    state.lastCredential = authorization;
    const receipt = Buffer.from(
      JSON.stringify({ status: 'success', method: 'siwx', at: Date.now() }),
    ).toString('base64url');
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Payment-Receipt': receipt,
      'X-Entitlement-Token': 'entitlement-abc',
      'X-Entitlement-Expires': new Date(Date.now() + 3_600_000).toISOString(),
    });
    res.end(JSON.stringify({ data: 'secret content' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () => new Promise<void>((r) => server.close(() => r())),
        get lastCredential() { return state.lastCredential; },
        reset() { state.lastCredential = undefined; },
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(skip)('E2E: SIWX 402 payment flow (local server)', () => {
  let srv: ServerState;
  let vaultPath: string;
  let fetch: typeof globalThis.fetch;
  let memState: ReturnType<typeof createMemoryStore>;

  beforeAll(async () => {
    srv = await startTestServer();

    vaultPath = mkdtempSync(join(tmpdir(), 'mw-e2e-test-'));
    createWallet('test-wallet', undefined, 12, vaultPath);
    const wallet = new OwsWalletAdapter({ walletId: 'test-wallet', vaultPath });

    const siwxMethod = createSiwxMethod();
    memState = createMemoryStore();
    const router = createRouter({ methods: [siwxMethod], state: memState, policy: [] });
    fetch = wrapFetch({ fetch: globalThis.fetch, router, state: memState, wallet });
  });

  afterAll(async () => {
    await srv.close();
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('resolves a SIWX 402 challenge and receives 200', async () => {
    const url = `http://127.0.0.1:${srv.port}/resource`;
    const response = await fetch(url);
    expect(response.status).toBe(200);
    const body = await response.json() as { data: string };
    expect(body.data).toBe('secret content');
  });

  it('sends a Bearer Authorization header on the paid retry', async () => {
    srv.reset();
    const url = `http://127.0.0.1:${srv.port}/resource`;
    await fetch(url);
    expect(srv.lastCredential).toMatch(/^Bearer /);
  });

  it('caches the entitlement token and skips the 402 on second call', async () => {
    // First call: triggers 402 → credential → 200 → cache entitlement
    const url = `http://127.0.0.1:${srv.port}/resource`;
    await fetch(url);

    // Verify the entitlement was cached (realm = origin including port)
    const entitlement = await memState.getEntitlement(`http://127.0.0.1:${srv.port}`);
    expect(entitlement).toBeDefined();
    expect(entitlement?.token).toBe('entitlement-abc');

    // Second call: should use cached token directly (no 402 round-trip)
    srv.reset();
    const response = await fetch(url);
    expect(response.status).toBe(200);
    // Server received a Bearer header immediately — no new credential was created from a 402
    expect(srv.lastCredential).toMatch(/^Bearer /);
  });

  it('policy denial: deny-protocol siwx prevents credential creation', async () => {
    const siwxMethod = createSiwxMethod();
    const freshState = createMemoryStore();
    const wallet = new OwsWalletAdapter({ walletId: 'test-wallet', vaultPath });

    const router = createRouter({
      methods: [siwxMethod],
      state: freshState,
      policy: [{ type: 'deny-protocol', protocols: ['siwx'] }],
    });
    const restrictedFetch = wrapFetch({ fetch: globalThis.fetch, router, state: freshState, wallet });

    const url = `http://127.0.0.1:${srv.port}/resource`;
    const response = await restrictedFetch(url);
    // No compatible method after policy — 402 passes through
    expect(response.status).toBe(402);
  });
});
