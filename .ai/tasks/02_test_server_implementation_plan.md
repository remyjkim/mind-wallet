# Test Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `packages/test-server` package with a local Hono server exposing x402 and MPP/Tempo payment-gated endpoints, enabling the two currently-skipped e2e tests to run against real protocol stacks.

**Architecture:** Hono app served via `@hono/node-server` on a random port. Embeds a minimal x402 facilitator (verify+settle) inline. Uses `mppx/hono` middleware for the MPP/Tempo endpoint. Exports a `startTestServer()` factory for test consumption.

**Tech Stack:** Hono, @hono/node-server, @x402/core (encoding), mppx (server middleware), viem (accounts + Tempo faucet)

**Design doc:** `.ai/analyses/06_test_server_design.md`

---

### Task 1: Scaffold the `packages/test-server` package

**Files:**
- Create: `packages/test-server/package.json`
- Create: `packages/test-server/tsconfig.json`
- Create: `packages/test-server/tsup.config.ts`

**Step 1: Create `packages/test-server/package.json`**

```json
{
  "name": "@mindwallet/test-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "check": "pnpm typecheck && pnpm build"
  },
  "dependencies": {
    "hono": "^4.12.0",
    "@hono/node-server": "^1.19.0",
    "@x402/core": "^2.8.0",
    "mppx": "^0.4.9",
    "viem": "^2.47.6"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 2: Create `packages/test-server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

**Step 3: Create `packages/test-server/tsup.config.ts`**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});
```

**Step 4: Install dependencies**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm install`
Expected: Workspace links resolve, lock file updates.

**Step 5: Verify the package is recognized**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm -r list --depth 0 2>/dev/null | grep test-server`
Expected: `@mindwallet/test-server` appears in the workspace listing.

**Step 6: Commit**

```bash
git add packages/test-server/package.json packages/test-server/tsconfig.json packages/test-server/tsup.config.ts pnpm-lock.yaml
git commit -m "chore: scaffold packages/test-server package"
```

---

### Task 2: Embedded x402 facilitator

**Files:**
- Create: `packages/test-server/src/facilitator.ts`

The facilitator replicates the hub worker pattern (see `carto-mindspace-v1/workers/hub/src/routes/x402-facilitator.ts` lines 13-40) without the marketplace escrow validation. It exposes `/verify`, `/settle`, and `/supported` as Hono routes.

**Step 1: Write `packages/test-server/src/facilitator.ts`**

```typescript
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
```

**Step 2: Verify it compiles**

Run: `cd /Users/pureicis/dev/mind-wallet/packages/test-server && npx tsc --noEmit`
Expected: No errors. (This will fail until we create index.ts — that's fine, just checking the file itself is valid syntax.)

**Step 3: Commit**

```bash
git add packages/test-server/src/facilitator.ts
git commit -m "feat(test-server): add embedded x402 facilitator routes"
```

---

### Task 3: x402 payment middleware

**Files:**
- Create: `packages/test-server/src/x402.ts`

This middleware gates a route behind an x402 challenge. On first request it returns 402 with a `PAYMENT-REQUIRED` header. On retry with `X-PAYMENT` (or `PAYMENT-SIGNATURE`) it calls the embedded facilitator verify+settle and returns 200 with a `Payment-Receipt` header.

**Reference:** See how `parseHttpChallenges` in `packages/core/src/http/parse.ts:38-59` reads the `PAYMENT-REQUIRED` header (base64url-decoded JSON). The middleware must produce output that this parser understands.

**Step 1: Write `packages/test-server/src/x402.ts`**

```typescript
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
  /** Base URL where the embedded facilitator is mounted (e.g. "http://127.0.0.1:PORT/facilitator") */
  facilitatorUrl: string;
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
      c.req.header('payment-signature') ??
      c.req.header('X-PAYMENT') ??
      c.req.header('PAYMENT-SIGNATURE');

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
    const verifyRes = await fetch(`${config.facilitatorUrl}/verify`, {
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
    const settleRes = await fetch(`${config.facilitatorUrl}/settle`, {
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
```

**Step 2: Commit**

```bash
git add packages/test-server/src/x402.ts
git commit -m "feat(test-server): add x402 paywall middleware"
```

---

### Task 4: MPP/Tempo server setup

**Files:**
- Create: `packages/test-server/src/mpp.ts`

Uses `mppx/hono` middleware with `tempo({ testnet: true, ... })`.

**Reference:** See `mppx/src/middlewares/hono.ts` for the `Mppx.create` + `payment` API. See `mppx/src/tempo/server/Methods.ts` for the `tempo()` factory. See `mppx/src/tempo/internal/defaults.ts` for chain IDs, token addresses, RPC URLs.

**Step 1: Write `packages/test-server/src/mpp.ts`**

```typescript
// ABOUTME: Configures the mppx Hono middleware for a Tempo charge endpoint on Moderato testnet
// ABOUTME: Exports a factory that returns the Mppx instance for use in route definitions

import { Mppx, tempo } from 'mppx/hono';

export interface MppConfig {
  /** Recipient address for Tempo charge payments */
  recipient: `0x${string}`;
  /** HMAC secret key for stateless challenge binding */
  secretKey: string;
  /** Whether to wait for on-chain transaction confirmation. @default true */
  waitForConfirmation?: boolean;
}

/**
 * Creates a Hono-aware mppx payment handler configured for Tempo on Moderato testnet.
 *
 * Usage:
 * ```ts
 * const mppx = createMppHandler({ recipient: '0x...', secretKey: 'test' });
 * app.get('/mpp/data', mppx.charge({ amount: '1' }), handler);
 * ```
 */
export function createMppHandler(config: MppConfig) {
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
```

**Step 2: Commit**

```bash
git add packages/test-server/src/mpp.ts
git commit -m "feat(test-server): add MPP/Tempo server configuration"
```

---

### Task 5: Server assembly and `startTestServer` factory

**Files:**
- Create: `packages/test-server/src/server.ts`
- Create: `packages/test-server/src/index.ts`

Assembles all routes into a single Hono app. The factory starts on a random port via `@hono/node-server` and returns a handle with `{ url, close() }`.

**Step 1: Write `packages/test-server/src/server.ts`**

```typescript
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

export function createApp(config: ServerConfig, facilitatorBaseUrl: string) {
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
    facilitatorUrl: `${facilitatorBaseUrl}/facilitator`,
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
```

**Step 2: Write `packages/test-server/src/index.ts`**

```typescript
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
 */
export async function startTestServer(config: ServerConfig): Promise<TestServerHandle> {
  // We need to know the port before creating the app (for facilitator self-URL),
  // so we create a two-phase startup: start with a placeholder, then swap in the
  // real URL once the port is known.
  return new Promise((resolve) => {
    // Start with port 0 — will be assigned a random available port
    let facilitatorUrl = 'http://127.0.0.1:0';
    const app = createApp(config, facilitatorUrl);

    const server = serve(
      { fetch: app.fetch, port: 0, hostname: '127.0.0.1' },
      (info) => {
        const url = `http://127.0.0.1:${info.port}`;
        // Re-create app with correct facilitator URL now that we know the port
        const finalApp = createApp(config, url);

        // Replace the fetch handler on the existing server
        // @hono/node-server's serve returns a Node http.Server — we can't swap
        // the handler directly. Instead, we close and restart.
        // Simpler approach: use the facilitator URL in the x402 middleware's fetch calls.
        // Since the middleware uses globalThis.fetch with the URL, and the server
        // is already listening, the self-referential call will work once we fix the URL.

        // Actually, the cleanest approach: pass the port into createApp via a mutable ref.
        resolve({
          url,
          close: () =>
            new Promise<void>((r) => {
              server.close(() => r());
            }),
        });
      },
    );
  });
}
```

**Wait — there's a chicken-and-egg problem.** The x402 middleware needs `facilitatorUrl` (which includes the port), but we don't know the port until the server starts. Two clean solutions:

**Option A:** The x402 middleware calls the facilitator in-process instead of over HTTP. Since both are on the same Hono app, we can pass the facilitator's Hono sub-app directly and call `app.request()`.

**Option B:** Use a mutable config object that gets patched after the port is known.

Use Option B — it's simpler and the middleware only reads the URL at request time (not at construction time):

Revise `x402.ts` to take the config by reference (it already does — `config.facilitatorUrl` is read inside the async handler, not at construction). So we just need a mutable wrapper.

Revise `index.ts`:

```typescript
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
```

This requires updating `createApp` and `x402Paywall` to accept `{ url: string }` instead of a plain string. See revised signatures in the code below.

**Revised `server.ts` signature:**

```typescript
export function createApp(config: ServerConfig, facilitatorRef: { url: string }) {
  // ... same as above, but pass facilitatorRef to x402Config:
  const x402Config: X402Config = {
    network,
    payTo: config.x402PayTo,
    asset: config.x402Asset ?? BASE_SEPOLIA_USDC,
    amount: config.x402Amount ?? '100',
    facilitatorRef,
  };
  // ...
}
```

**Revised `x402.ts` — change `facilitatorUrl: string` to `facilitatorRef: { url: string }`:**

In the middleware handler, replace `config.facilitatorUrl` with `config.facilitatorRef.url`.

**Step 3: Verify compilation**

Run: `cd /Users/pureicis/dev/mind-wallet/packages/test-server && npx tsc --noEmit`
Expected: Clean compilation.

**Step 4: Verify build**

Run: `cd /Users/pureicis/dev/mind-wallet/packages/test-server && pnpm build`
Expected: `dist/index.js` and `dist/index.d.ts` are produced.

**Step 5: Commit**

```bash
git add packages/test-server/src/server.ts packages/test-server/src/index.ts
git commit -m "feat(test-server): assemble server and startTestServer factory"
```

---

### Task 6: Smoke test the server

**Files:**
- Create: `packages/test-server/src/server.test.ts`

Write a minimal test that starts the server and hits `/health` and verifies `/x402/data` returns 402.

**Step 1: Add vitest to devDependencies**

In `packages/test-server/package.json`, add `"vitest": "^1.6.0"` to devDependencies and add `"test": "vitest run"` to scripts.

**Step 2: Create vitest config**

Create `packages/test-server/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 3: Write `packages/test-server/src/server.test.ts`**

```typescript
// ABOUTME: Smoke test for the test server lifecycle and payment challenge responses
// ABOUTME: Verifies health endpoint, x402 402 challenge format, and MPP 402 challenge format

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestServerHandle } from './index.js';

// Use a throwaway address as recipient — no real funds needed for smoke tests
const RECIPIENT = '0x0000000000000000000000000000000000000001' as `0x${string}`;

describe('test-server smoke', () => {
  let server: TestServerHandle;

  beforeAll(async () => {
    server = await startTestServer({
      x402PayTo: RECIPIENT,
      mppRecipient: RECIPIENT,
      mppWaitForConfirmation: false, // smoke test doesn't need chain confirmation
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it('GET /health returns 200', async () => {
    const res = await fetch(`${server.url}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /x402/data without payment returns 402 with PAYMENT-REQUIRED header', async () => {
    const res = await fetch(`${server.url}/x402/data`);
    expect(res.status).toBe(402);

    const header = res.headers.get('payment-required');
    expect(header).toBeTruthy();

    // Decode and verify the challenge structure
    const decoded = JSON.parse(Buffer.from(header!, 'base64url').toString('utf8'));
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0].scheme).toBe('exact');
    expect(decoded.accepts[0].network).toBe('eip155:84532');
    expect(decoded.accepts[0].payTo).toBe(RECIPIENT);
  });

  it('GET /mpp/data without payment returns 402 with WWW-Authenticate header', async () => {
    const res = await fetch(`${server.url}/mpp/data`);
    expect(res.status).toBe(402);

    const wwwAuth = res.headers.get('www-authenticate');
    expect(wwwAuth).toBeTruthy();
    expect(wwwAuth).toContain('Payment');
  });

  it('GET /facilitator/supported returns supported schemes', async () => {
    const res = await fetch(`${server.url}/facilitator/supported`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kinds: unknown[] };
    expect(body.kinds).toHaveLength(1);
  });
});
```

**Step 4: Run the smoke test**

Run: `cd /Users/pureicis/dev/mind-wallet/packages/test-server && pnpm test`
Expected: All 4 tests pass.

**Step 5: Commit**

```bash
git add packages/test-server/src/server.test.ts packages/test-server/vitest.config.ts packages/test-server/package.json
git commit -m "test(test-server): add smoke tests for server lifecycle and 402 challenges"
```

---

### Task 7: Rewrite `adapter.e2e.test.ts` to use the test server

**Files:**
- Modify: `packages/core/src/http/adapter.e2e.test.ts`
- Modify: `packages/core/package.json` (add `@mindwallet/test-server` + `@mindwallet/protocols` as dev dependencies)

The current test uses mockFetch and is gated on `E2E_PAYMENT_URL`. Rewrite it to start the real test server and exercise `wrapFetch` against both the x402 and MPP endpoints.

**Reference:** Follow the same beforeAll/afterAll pattern as `packages/cli/src/e2e.integration.test.ts` (lines 99-115).

**Step 1: Add dev dependencies to `packages/core/package.json`**

Add to `devDependencies`:
```json
"@mindwallet/test-server": "workspace:*",
"@mindwallet/protocols": "workspace:*"
```

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm install`

**Step 2: Rewrite `packages/core/src/http/adapter.e2e.test.ts`**

```typescript
// ABOUTME: End-to-end test for wrapFetch against local x402 and MPP payment-gated endpoints
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and TEST_PRIVATE_KEY are set

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetch } from './adapter.js';
import { createRouter } from '../router.js';
import { createMemoryStore } from '../state/memory.js';
import { PrivateKeyWalletAdapter } from '../wallet/private-key.js';
import { createX402Method } from '@mindwallet/protocols';
import { startTestServer, type TestServerHandle } from '@mindwallet/test-server';

const RUN = process.env['RUN_INTEGRATION_TESTS'] === '1';
const PRIVATE_KEY = process.env['TEST_PRIVATE_KEY'] as `0x${string}` | undefined;

describe.skipIf(!RUN || !PRIVATE_KEY)('wrapFetch e2e (local test server)', () => {
  let server: TestServerHandle;
  let wrappedFetch: typeof globalThis.fetch;
  let state: ReturnType<typeof createMemoryStore>;

  beforeAll(async () => {
    const account = privateKeyToAccount(PRIVATE_KEY!);
    const x402Method = createX402Method({ account });
    const wallet = new PrivateKeyWalletAdapter({ privateKey: PRIVATE_KEY! });

    server = await startTestServer({
      x402PayTo: '0x0000000000000000000000000000000000000001',
      mppRecipient: '0x0000000000000000000000000000000000000001',
      mppWaitForConfirmation: false, // don't need chain confirmation for adapter tests
    });

    state = createMemoryStore();
    const router = createRouter({ methods: [x402Method], state, policy: [] });
    wrappedFetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });
  });

  afterAll(async () => {
    await server?.close();
  });

  it('resolves an x402 payment challenge and returns 200', async () => {
    const response = await wrappedFetch(`${server.url}/x402/data`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: string };
    expect(body.data).toBe('paid x402 content');
  });

  it('includes a Payment-Receipt header on successful x402 response', async () => {
    const response = await wrappedFetch(`${server.url}/x402/data`);
    expect(response.status).toBe(200);

    const receipt = response.headers.get('payment-receipt');
    expect(receipt).toBeTruthy();

    const decoded = JSON.parse(Buffer.from(receipt!, 'base64url').toString('utf8'));
    expect(decoded.status).toBe('success');
  });
});
```

**Step 3: Run the test (without env vars — should skip)**

Run: `cd /Users/pureicis/dev/mind-wallet/packages/core && pnpm test`
Expected: The test suite is skipped (no `RUN_INTEGRATION_TESTS`), all other tests pass.

**Step 4: Run with env vars to verify it works**

Run: `cd /Users/pureicis/dev/mind-wallet && RUN_INTEGRATION_TESTS=1 TEST_PRIVATE_KEY=0x... pnpm -r test --filter @mindwallet/core`
Expected: The e2e test passes — 402 → sign → verify → settle → 200.

**Step 5: Commit**

```bash
git add packages/core/src/http/adapter.e2e.test.ts packages/core/package.json pnpm-lock.yaml
git commit -m "test(core): rewrite adapter e2e test to use local test server"
```

---

### Task 8: Rewrite `x402.mainnet.e2e.test.ts` to use the test server

**Files:**
- Modify: `packages/cli/src/x402.mainnet.e2e.test.ts` (rename to `x402.e2e.test.ts`)
- Modify: `packages/cli/package.json` (add `@mindwallet/test-server` as dev dependency)

**Step 1: Add dev dependency**

Add `"@mindwallet/test-server": "workspace:*"` to `packages/cli/package.json` devDependencies.

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm install`

**Step 2: Rename and rewrite the test**

Rename `packages/cli/src/x402.mainnet.e2e.test.ts` → `packages/cli/src/x402.e2e.test.ts`

```bash
cd /Users/pureicis/dev/mind-wallet && git mv packages/cli/src/x402.mainnet.e2e.test.ts packages/cli/src/x402.e2e.test.ts
```

Write `packages/cli/src/x402.e2e.test.ts`:

```typescript
// ABOUTME: End-to-end test for x402 payment flow using a local test server
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and TEST_PRIVATE_KEY are set

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrivateKeyWalletAdapter, createMemoryStore, createRouter, wrapFetch } from '@mindwallet/core';
import { privateKeyToAccount } from 'viem/accounts';
import { createX402Method } from '@mindwallet/protocols';
import { startTestServer, type TestServerHandle } from '@mindwallet/test-server';

const skip =
  !process.env['RUN_INTEGRATION_TESTS'] ||
  !process.env['TEST_PRIVATE_KEY'];

describe.skipIf(skip)('x402 e2e (local test server)', () => {
  let server: TestServerHandle;

  beforeAll(async () => {
    server = await startTestServer({
      x402PayTo: '0x0000000000000000000000000000000000000001',
      mppRecipient: '0x0000000000000000000000000000000000000001',
      mppWaitForConfirmation: false,
    });
  });

  afterAll(async () => {
    await server?.close();
  });

  it('completes a full x402 payment flow and returns 200', async () => {
    const privateKey = process.env['TEST_PRIVATE_KEY'] as `0x${string}`;
    const account = privateKeyToAccount(privateKey);
    const x402Method = createX402Method({ account });
    const wallet = new PrivateKeyWalletAdapter({ privateKey });
    const state = createMemoryStore();
    const router = createRouter({ methods: [x402Method], state, policy: [] });
    const fetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });

    const response = await fetch(`${server.url}/x402/data`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { data: string };
    expect(body.data).toBe('paid x402 content');

    // Verify receipt
    const receipt = response.headers.get('payment-receipt');
    expect(receipt).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(receipt!, 'base64url').toString('utf8'));
    expect(decoded.status).toBe('success');
    expect(decoded.transaction).toBeDefined();
  });
});
```

**Step 3: Run without env vars — should skip**

Run: `cd /Users/pureicis/dev/mind-wallet/packages/cli && pnpm test`
Expected: The test is skipped, all other tests pass.

**Step 4: Run with env vars**

Run: `cd /Users/pureicis/dev/mind-wallet && RUN_INTEGRATION_TESTS=1 TEST_PRIVATE_KEY=0x... pnpm -r test --filter mindwallet`
Expected: The x402 e2e test passes.

**Step 5: Commit**

```bash
git add packages/cli/src/x402.e2e.test.ts packages/cli/package.json pnpm-lock.yaml
git rm packages/cli/src/x402.mainnet.e2e.test.ts 2>/dev/null  # already renamed via git mv
git commit -m "test(cli): rewrite x402 e2e test to use local test server"
```

---

### Task 9: Full integration run

**Files:** None (verification only)

**Step 1: Build the entire workspace**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm -r build`
Expected: All packages build successfully including test-server.

**Step 2: Typecheck the entire workspace**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm -r typecheck`
Expected: No type errors.

**Step 3: Run all tests without integration flag**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm -r test`
Expected: All tests pass, integration tests are cleanly skipped.

**Step 4: Run all tests with integration flag**

Run: `cd /Users/pureicis/dev/mind-wallet && RUN_INTEGRATION_TESTS=1 TEST_PRIVATE_KEY=<key> OWS_PASSPHRASE=test-passphrase TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz pnpm -r test`
Expected: All tests pass including the previously-skipped e2e tests.

**Step 5: Verify the skip count decreased**

Compare the test summary table. The two previously skipped tests (`adapter.e2e.test.ts` gated on `E2E_PAYMENT_URL` and `x402.mainnet.e2e.test.ts` gated on `E2E_X402_URL`) should now run when `RUN_INTEGRATION_TESTS=1` + `TEST_PRIVATE_KEY` are set.

---

## Notes for the implementer

### Chicken-and-egg: facilitator URL

The x402 middleware calls the embedded facilitator over HTTP. The facilitator URL includes the port, which isn't known until the server starts. The solution is a mutable `{ url: string }` ref object passed at construction time and populated in the `serve` callback before any requests arrive.

### mppx `tempo()` parameters

The `tempo()` factory from `mppx/hono` re-exports from `mppx/tempo/server`. It accepts `recipient`, `testnet`, `waitForConfirmation`, and `secretKey` among others. See `node_modules/mppx/src/tempo/server/Charge.ts` and `node_modules/mppx/src/tempo/internal/defaults.ts` for the full parameter set.

### Base Sepolia USDC

Contract address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. This is the standard USDC deployment on Base Sepolia (chain ID 84532). The embedded facilitator doesn't verify on-chain, so this address only needs to be valid for EIP-712 domain construction.

### Moderato testnet funding

For MPP tests with `waitForConfirmation: true`, the client wallet needs pathUSD on Moderato. Fund via:
```typescript
import { Actions } from 'viem/tempo';
await Actions.faucet.fundSync(client, { account: address });
```
Or CLI: `cast rpc tempo_fundAddress $ADDRESS --rpc-url https://rpc.moderato.tempo.xyz`

See `.ai/analyses/05_foundry_tempo.md` for full Moderato setup reference.

### `@x402/core/http` encoding functions

Available but optional: `encodePaymentRequiredHeader()`, `decodePaymentSignatureHeader()`, `encodePaymentResponseHeader()`. The test server can use raw `Buffer.from(...).toString('base64url')` for simplicity, since that's what the client-side parser in `packages/core/src/http/parse.ts` expects.
