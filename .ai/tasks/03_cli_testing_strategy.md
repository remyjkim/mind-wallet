# CLI Testing Strategy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Comprehensive test coverage for CLI-specific layers: move misplaced x402 test to core, add unit tests for `routerFromConfig` wiring, add integration tests for `fetch`/`pay` commands, and add integration tests for the MCP server.

**Architecture:** Each task targets one CLI layer. Unit tests use dependency injection (the commands already accept `fetch`, `output`, etc.). Integration tests for `fetch`/`pay`/MCP use the local `@mindwallet/test-server` with a real OWS wallet on a temp vault, exercising the full SIWX 402 flow through the CLI command interface. The existing `e2e.integration.test.ts` (SIWX e2e) is the reference pattern.

**Tech Stack:** vitest, `@mindwallet/test-server`, `@open-wallet-standard/core` (for temp vault creation), `@modelcontextprotocol/sdk` (for MCP client in tests)

---

## Context for the Implementer

### CLI Package Responsibilities

The CLI sits on top of `@mindwallet/core` and adds:
- **Config** (`config.ts`): load/save `~/.config/mindwallet/config.json`
- **Router factory** (`router-from-config.ts`): config → `MindRouter` + `OwsWalletAdapter`, wires SIWX method, converts policy config to core `PolicyRule[]`
- **Commands** (`commands/fetch.ts`, `commands/pay.ts`): load config → create router → `wrapFetch` → format output
- **MCP server** (`mcp-server.ts`): exposes `fetch_with_payment` and `probe_origin` over stdio

### What Already Has Tests
- `config.test.ts` — load/save unit tests ✅
- `commands/discover.test.ts` — output formatting ✅
- `commands/search.test.ts` — output formatting ✅
- `commands/key.test.ts` — key management ✅
- `e2e.integration.test.ts` — SIWX full flow (local inline server) ✅

### What's Missing or Wrong
- `x402.e2e.test.ts` — tests core, not CLI. Move to core package.
- `routerFromConfig` — untested directly
- `fetchCommand` / `payCommand` — untested
- `startMcpServer` — untested

### Key Files to Read Before Starting
- `packages/cli/src/router-from-config.ts` — the factory under test
- `packages/cli/src/commands/fetch.ts` — fetchCommand implementation
- `packages/cli/src/commands/pay.ts` — payCommand implementation
- `packages/cli/src/mcp-server.ts` — MCP server implementation
- `packages/cli/src/e2e.integration.test.ts` — reference pattern for local test setup
- `packages/cli/src/x402.e2e.test.ts` — file to be moved/deleted
- `packages/core/src/http/adapter.e2e.test.ts` — x402 test already in core

### Environment
- Test runner: `vitest`
- Run tests: `pnpm --filter mindwallet run test`
- Typecheck: `pnpm --filter mindwallet run typecheck`
- Integration tests gated on: `RUN_INTEGRATION_TESTS=1` + `OWS_PASSPHRASE` (SIWX) or `TEST_PRIVATE_KEY` (x402)

---

### Task 1: Move x402 e2e test from CLI to core

The CLI's `x402.e2e.test.ts` tests `@mindwallet/core` functionality (it manually constructs `createX402Method`, `createRouter`, `wrapFetch` — no CLI code involved). The identical coverage already exists in `packages/core/src/http/adapter.e2e.test.ts`. Delete the CLI copy.

**Files:**
- Delete: `packages/cli/src/x402.e2e.test.ts`

**Step 1: Verify the core test already covers x402**

Read `packages/core/src/http/adapter.e2e.test.ts` and confirm it tests:
- x402 402 → sign → verify → settle → 200 flow
- Payment-Receipt header verification

Both of these are covered by the two `it()` blocks in that file.

**Step 2: Delete the CLI x402 test**

```bash
rm packages/cli/src/x402.e2e.test.ts
```

**Step 3: Run CLI tests to confirm nothing breaks**

Run: `pnpm --filter mindwallet run test`
Expected: All remaining tests pass. The x402 test no longer appears.

**Step 4: Commit**

```bash
git add packages/cli/src/x402.e2e.test.ts
git commit -m "test(cli): remove x402 e2e test that duplicated core coverage"
```

---

### Task 2: Unit test `routerFromConfig` policy conversion

`routerFromConfig` converts CLI `PolicyRuleConfig[]` to core `PolicyRule[]`. This wiring logic is untested. We can't easily inspect the policy rules after they're inside the router, but we can test the conversion outcomes by exercising the router against controlled candidates.

However, the simplest approach: extract the policy conversion into a testable function, then unit test it directly.

**Files:**
- Modify: `packages/cli/src/router-from-config.ts` (extract `convertPolicy`)
- Create: `packages/cli/src/router-from-config.test.ts`

**Step 1: Write the failing tests**

Create `packages/cli/src/router-from-config.test.ts`:

```typescript
// ABOUTME: Unit tests for routerFromConfig policy conversion and method wiring
// ABOUTME: Tests that CLI PolicyRuleConfig[] correctly maps to core PolicyRule[]

import { describe, it, expect } from 'vitest';
import { convertPolicy } from './router-from-config.js';
import type { PolicyRuleConfig } from './config.js';

describe('convertPolicy', () => {
  it('converts a budget rule with defaults', () => {
    const input: PolicyRuleConfig[] = [{ type: 'budget' }];
    const result = convertPolicy(input);
    expect(result).toEqual([
      { type: 'budget', currency: 'USDC', amount: 0n, window: 'daily' },
    ]);
  });

  it('converts a budget rule with explicit values', () => {
    const input: PolicyRuleConfig[] = [
      { type: 'budget', currency: 'ETH', limit: '1000000', window: 'weekly' },
    ];
    const result = convertPolicy(input);
    expect(result).toEqual([
      { type: 'budget', currency: 'ETH', amount: 1000000n, window: 'weekly' },
    ]);
  });

  it('converts a deny-protocol rule', () => {
    const input: PolicyRuleConfig[] = [
      { type: 'deny-protocol', protocol: 'x402' },
    ];
    const result = convertPolicy(input);
    expect(result).toEqual([
      { type: 'deny-protocol', protocols: ['x402'] },
    ]);
  });

  it('converts a prefer-protocol rule with default boost', () => {
    const input: PolicyRuleConfig[] = [
      { type: 'prefer-protocol', protocol: 'siwx' },
    ];
    const result = convertPolicy(input);
    expect(result).toEqual([
      { type: 'prefer-protocol', protocol: 'siwx', boost: 0.1 },
    ]);
  });

  it('converts a prefer-protocol rule with explicit boost', () => {
    const input: PolicyRuleConfig[] = [
      { type: 'prefer-protocol', protocol: 'tempo', boost: 0.5 },
    ];
    const result = convertPolicy(input);
    expect(result).toEqual([
      { type: 'prefer-protocol', protocol: 'tempo', boost: 0.5 },
    ]);
  });

  it('converts multiple rules in order', () => {
    const input: PolicyRuleConfig[] = [
      { type: 'budget', limit: '500' },
      { type: 'deny-protocol', protocol: 'x402' },
      { type: 'prefer-protocol', protocol: 'siwx', boost: 0.3 },
    ];
    const result = convertPolicy(input);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('budget');
    expect(result[1].type).toBe('deny-protocol');
    expect(result[2].type).toBe('prefer-protocol');
  });

  it('returns empty array for undefined policy', () => {
    const result = convertPolicy(undefined);
    expect(result).toEqual([]);
  });

  it('throws on unknown rule type', () => {
    const input = [{ type: 'unknown' }] as PolicyRuleConfig[];
    expect(() => convertPolicy(input)).toThrow(/unknown policy rule type/i);
  });
});
```

**Step 2: Run the test to confirm it fails**

Run: `pnpm --filter mindwallet run test -- src/router-from-config.test.ts`
Expected: FAIL — `convertPolicy` is not exported from `router-from-config.js`

**Step 3: Extract `convertPolicy` as an exported function**

In `packages/cli/src/router-from-config.ts`, extract the inline `.map()` logic into a named export:

Change lines 34-50 from:

```typescript
  const policy: PolicyRule[] = (config.policy ?? []).map((rule): PolicyRule => {
    if (rule.type === 'budget') {
      return {
        type: 'budget',
        currency: rule.currency ?? 'USDC',
        amount: BigInt(rule.limit ?? '0'),
        window: rule.window ?? 'daily',
      };
    }
    if (rule.type === 'deny-protocol') {
      return { type: 'deny-protocol', protocols: [rule.protocol as any] };
    }
    if (rule.type === 'prefer-protocol') {
      return { type: 'prefer-protocol', protocol: rule.protocol as any, boost: rule.boost ?? 0.1 };
    }
    throw new Error(`Unknown policy rule type: ${(rule as any).type}`);
  });
```

To:

```typescript
  const policy = convertPolicy(config.policy);
```

And add this exported function before `routerFromConfig`:

```typescript
/**
 * Maps CLI policy config to core PolicyRule[].
 */
export function convertPolicy(rules: PolicyRuleConfig[] | undefined): PolicyRule[] {
  return (rules ?? []).map((rule): PolicyRule => {
    if (rule.type === 'budget') {
      return {
        type: 'budget',
        currency: rule.currency ?? 'USDC',
        amount: BigInt(rule.limit ?? '0'),
        window: rule.window ?? 'daily',
      };
    }
    if (rule.type === 'deny-protocol') {
      return { type: 'deny-protocol', protocols: [rule.protocol as any] };
    }
    if (rule.type === 'prefer-protocol') {
      return { type: 'prefer-protocol', protocol: rule.protocol as any, boost: rule.boost ?? 0.1 };
    }
    throw new Error(`Unknown policy rule type: ${(rule as any).type}`);
  });
}
```

**Step 4: Run the test to confirm it passes**

Run: `pnpm --filter mindwallet run test -- src/router-from-config.test.ts`
Expected: PASS — all 8 tests

**Step 5: Run all CLI tests**

Run: `pnpm --filter mindwallet run test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/cli/src/router-from-config.ts packages/cli/src/router-from-config.test.ts
git commit -m "test(cli): add unit tests for routerFromConfig policy conversion"
```

---

### Task 3: Integration test `fetchCommand` with local test server

`fetchCommand` is the CLI's primary command and is completely untested. It wires up an OWS wallet, creates a router, calls `wrapFetch`, and writes output to stdout/stderr. Test it against the local SIWX test server (same inline server pattern used in `e2e.integration.test.ts`).

**Important:** `fetchCommand` currently creates its own router/wallet internally from config (lines 25-39 of `commands/fetch.ts`). It does NOT use `routerFromConfig`. This is a design choice — each command wires itself. The test must provide a valid `MindwalletConfig` with a real OWS vault, and the command will create its own wallet and router.

**Important:** `fetchCommand` writes to `process.stdout` and `process.stderr` directly. We can't easily capture this with dependency injection without modifying the function signature. Instead, we'll test at one level up by:
1. Calling `fetchCommand` with a config pointing at a temp vault
2. Verifying it doesn't throw (successful 402 flow)
3. For output verification, we can spy on `process.stdout.write` and `process.stderr.write`

**Files:**
- Create: `packages/cli/src/commands/fetch.test.ts`

**Step 1: Write the failing test**

Create `packages/cli/src/commands/fetch.test.ts`:

```typescript
// ABOUTME: Integration tests for the fetch command using a local SIWX test server
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and OWS_PASSPHRASE are set

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallet } from '@open-wallet-standard/core';
import { fetchCommand } from './fetch.js';
import type { MindwalletConfig } from '../config.js';

const skip = !process.env['RUN_INTEGRATION_TESTS'] || !process.env['OWS_PASSPHRASE'];

// Inline SIWX test server — same pattern as e2e.integration.test.ts
function startSiwxServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const authorization = req.headers['authorization'];
    if (!authorization) {
      const challenge = {
        domain: 'localhost',
        walletId: 'test-wallet',
        chainId: 'eip155:8453',
        nonce: `nonce-${Date.now()}`,
      };
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'payment_required',
        extensions: { 'sign-in-with-x': challenge },
      }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: 'protected content' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

describe.skipIf(skip)('fetchCommand (local SIWX server)', () => {
  let srv: { port: number; close: () => Promise<void> };
  let vaultPath: string;
  let config: MindwalletConfig;

  beforeAll(async () => {
    srv = await startSiwxServer();
    vaultPath = mkdtempSync(join(tmpdir(), 'mw-fetch-test-'));
    createWallet('test-wallet', undefined, 12, vaultPath);
    config = { walletId: 'test-wallet', vaultPath };
  });

  afterAll(async () => {
    await srv.close();
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('resolves a SIWX 402 and writes response body to stdout', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await fetchCommand(`http://127.0.0.1:${srv.port}/data`, config);
      const output = writeSpy.mock.calls.map(c => String(c[0])).join('');
      expect(output).toContain('protected content');
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('writes headers to stderr in verbose mode', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await fetchCommand(`http://127.0.0.1:${srv.port}/data`, config, { verbose: true });
      const errOutput = stderrSpy.mock.calls.map(c => String(c[0])).join('');
      expect(errOutput).toContain('HTTP 200');
      expect(errOutput).toContain('content-type');
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });
});
```

**Step 2: Run the test to confirm it fails**

Run: `RUN_INTEGRATION_TESTS=1 OWS_PASSPHRASE=test pnpm --filter mindwallet run test -- src/commands/fetch.test.ts`
Expected: FAIL initially (file doesn't exist yet), then PASS after creation

**Step 3: The test should pass immediately** since `fetchCommand` already works — this is testing existing functionality.

Run: `RUN_INTEGRATION_TESTS=1 OWS_PASSPHRASE=test pnpm --filter mindwallet run test -- src/commands/fetch.test.ts`
Expected: PASS — 2 tests

**Step 4: Run all CLI tests**

Run: `pnpm --filter mindwallet run test`
Expected: All tests pass (integration tests skip without env vars)

**Step 5: Commit**

```bash
git add packages/cli/src/commands/fetch.test.ts
git commit -m "test(cli): add integration tests for fetchCommand against local SIWX server"
```

---

### Task 4: Integration test `payCommand` with local test server

`payCommand` probes the URL first (via `probeOrigin`) then fetches with payment. It writes discovery info to stderr in verbose mode.

**Important difference from fetchCommand:** `payCommand` calls `probeOrigin` first, which issues its own HTTP request. The test server must handle both the probe request (returns 402 + SIWX challenge) and the payment request (returns 200 on valid credential).

**Files:**
- Create: `packages/cli/src/commands/pay.test.ts`

**Step 1: Write the failing test**

Create `packages/cli/src/commands/pay.test.ts`:

```typescript
// ABOUTME: Integration tests for the pay command using a local SIWX test server
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and OWS_PASSPHRASE are set

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallet } from '@open-wallet-standard/core';
import { payCommand } from './pay.js';
import type { MindwalletConfig } from '../config.js';

const skip = !process.env['RUN_INTEGRATION_TESTS'] || !process.env['OWS_PASSPHRASE'];

// Inline SIWX test server
function startSiwxServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const authorization = req.headers['authorization'];
    if (!authorization) {
      const challenge = {
        domain: 'localhost',
        walletId: 'test-wallet',
        chainId: 'eip155:8453',
        nonce: `nonce-${Date.now()}`,
      };
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'payment_required',
        extensions: { 'sign-in-with-x': challenge },
      }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: 'paid content' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

describe.skipIf(skip)('payCommand (local SIWX server)', () => {
  let srv: { port: number; close: () => Promise<void> };
  let vaultPath: string;
  let config: MindwalletConfig;

  beforeAll(async () => {
    srv = await startSiwxServer();
    vaultPath = mkdtempSync(join(tmpdir(), 'mw-pay-test-'));
    createWallet('test-wallet', undefined, 12, vaultPath);
    config = { walletId: 'test-wallet', vaultPath };
  });

  afterAll(async () => {
    await srv.close();
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('probes, pays, and writes response body to stdout', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await payCommand(`http://127.0.0.1:${srv.port}/data`, config);
      const output = stdoutSpy.mock.calls.map(c => String(c[0])).join('');
      expect(output).toContain('paid content');
    } finally {
      stdoutSpy.mockRestore();
    }
  });

  it('writes discovery and status info to stderr in verbose mode', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await payCommand(`http://127.0.0.1:${srv.port}/data`, config, { verbose: true });
      const errOutput = stderrSpy.mock.calls.map(c => String(c[0])).join('');
      expect(errOutput).toContain('payment candidate');
      expect(errOutput).toContain('HTTP 200');
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });

  it('sets exitCode 1 for unreachable URL', async () => {
    const origExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await payCommand('http://127.0.0.1:1/unreachable', config);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = origExitCode;
      errorSpy.mockRestore();
    }
  });
});
```

**Step 2: Run the test to confirm it passes**

Run: `RUN_INTEGRATION_TESTS=1 OWS_PASSPHRASE=test pnpm --filter mindwallet run test -- src/commands/pay.test.ts`
Expected: PASS — 3 tests

**Step 3: Run all CLI tests**

Run: `pnpm --filter mindwallet run test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/cli/src/commands/pay.test.ts
git commit -m "test(cli): add integration tests for payCommand against local SIWX server"
```

---

### Task 5: Integration test MCP server tools

The MCP server exposes `fetch_with_payment` and `probe_origin` over stdio. Test using `@modelcontextprotocol/sdk`'s `Client` connected to an in-process server via stream pair.

**Key insight:** We don't need to spawn a child process or use stdio. The MCP SDK supports in-memory transports. We can create a `McpServer` with the same wiring as `startMcpServer` and connect a `Client` to it via paired streams.

**However**, `startMcpServer` is tightly coupled — it creates its own wallet, router, and connects to stdio. To test it, we need to either:
- **(A)** Extract the tool registration into a testable function that accepts dependencies, or
- **(B)** Create the same `McpServer` setup in the test and connect via in-memory transport.

Option **(A)** is cleaner. Extract a `createMcpServer(config)` that returns the `McpServer` without connecting transport. Then `startMcpServer` becomes: `const server = createMcpServer(config); await server.connect(new StdioServerTransport());`.

**Files:**
- Modify: `packages/cli/src/mcp-server.ts` (extract `createMcpServer`)
- Create: `packages/cli/src/mcp-server.test.ts`

**Step 1: Write the failing test**

Create `packages/cli/src/mcp-server.test.ts`:

```typescript
// ABOUTME: Integration tests for the MCP server tools using in-memory transport
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and OWS_PASSPHRASE are set

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallet } from '@open-wallet-standard/core';
import { createMcpServer } from './mcp-server.js';
import type { MindwalletConfig } from './config.js';

const skip = !process.env['RUN_INTEGRATION_TESTS'] || !process.env['OWS_PASSPHRASE'];

// Inline SIWX test server
function startSiwxServer(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const authorization = req.headers['authorization'];
    if (!authorization) {
      const challenge = {
        domain: 'localhost',
        walletId: 'test-wallet',
        chainId: 'eip155:8453',
        nonce: `nonce-${Date.now()}`,
      };
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'payment_required',
        extensions: { 'sign-in-with-x': challenge },
      }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: 'mcp paid content' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

describe.skipIf(skip)('MCP server tools (local SIWX server)', () => {
  let srv: { port: number; close: () => Promise<void> };
  let vaultPath: string;
  let client: Client;
  let closeTransport: () => Promise<void>;

  beforeAll(async () => {
    srv = await startSiwxServer();
    vaultPath = mkdtempSync(join(tmpdir(), 'mw-mcp-test-'));
    createWallet('test-wallet', undefined, 12, vaultPath);

    const config: MindwalletConfig = { walletId: 'test-wallet', vaultPath };
    const mcpServer = createMcpServer(config);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.1' });

    await Promise.all([
      client.connect(clientTransport),
      mcpServer.connect(serverTransport),
    ]);

    closeTransport = async () => {
      await client.close();
    };
  });

  afterAll(async () => {
    await closeTransport?.();
    await srv.close();
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('fetch_with_payment resolves SIWX 402 and returns response', async () => {
    const result = await client.callTool({
      name: 'fetch_with_payment',
      arguments: { url: `http://127.0.0.1:${srv.port}/data` },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('mcp paid content');
    expect(result.isError).toBeFalsy();
  });

  it('fetch_with_payment returns error for non-OK response', async () => {
    const result = await client.callTool({
      name: 'fetch_with_payment',
      arguments: { url: 'http://127.0.0.1:1/unreachable' },
    });
    expect(result.isError).toBe(true);
  });

  it('probe_origin detects SIWX payment requirement', async () => {
    const result = await client.callTool({
      name: 'probe_origin',
      arguments: { url: `http://127.0.0.1:${srv.port}/data` },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.requires402).toBe(true);
    expect(parsed.candidates.length).toBeGreaterThan(0);
    expect(parsed.candidates[0].protocol).toBe('siwx');
  });

  it('probe_origin reports unreachable for bad URL', async () => {
    const result = await client.callTool({
      name: 'probe_origin',
      arguments: { url: 'http://127.0.0.1:1/unreachable' },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('Unreachable');
  });
});
```

**Step 2: Run the test to confirm it fails**

Run: `RUN_INTEGRATION_TESTS=1 OWS_PASSPHRASE=test pnpm --filter mindwallet run test -- src/mcp-server.test.ts`
Expected: FAIL — `createMcpServer` is not exported

**Step 3: Extract `createMcpServer` from `startMcpServer`**

In `packages/cli/src/mcp-server.ts`, refactor to:

```typescript
// ABOUTME: MCP server that exposes mindwallet as a tool for AI agents
// ABOUTME: Provides fetch_with_payment and probe_origin tools over stdio transport

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { wrapFetch, createMemoryStore, createRouter, OwsWalletAdapter } from '@mindwallet/core';
import { createSiwxMethod } from '@mindwallet/protocols';
import { probeOrigin } from '@mindwallet/discovery';
import type { MindwalletConfig } from './config.js';

/**
 * Creates an MCP server with mindwallet tools registered.
 * Does not connect a transport — call .connect() on the returned server.
 */
export function createMcpServer(config: MindwalletConfig): McpServer {
  const passphrase = config.passphrase ?? process.env['OWS_PASSPHRASE'];
  const wallet = new OwsWalletAdapter({
    walletId: config.walletId,
    vaultPath: config.vaultPath,
    passphrase,
  });

  const methods = [createSiwxMethod()];
  const state = createMemoryStore();
  const router = createRouter({ methods, state, policy: [] });
  const fetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });

  const server = new McpServer({
    name: 'mindwallet',
    version: '0.1.0',
  });

  server.tool(
    'fetch_with_payment',
    'Fetch a URL, automatically handling HTTP 402 payment challenges',
    {
      url: z.string().url().describe('The URL to fetch'),
      method: z.string().optional().default('GET').describe('HTTP method'),
      headers: z.record(z.string(), z.string()).optional().describe('Additional request headers'),
      body: z.string().optional().describe('Request body for POST/PUT requests'),
    },
    async ({ url, method, headers, body }) => {
      const response = await fetch(url, {
        method: method ?? 'GET',
        headers,
        body,
      });

      const responseBody = await response.text();
      const contentType = response.headers.get('content-type') ?? '';

      if (!response.ok) {
        return {
          content: [{
            type: 'text' as const,
            text: `HTTP ${response.status} ${response.statusText}\n${responseBody}`,
          }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: responseBody,
          mimeType: contentType || undefined,
        }],
      };
    },
  );

  server.tool(
    'probe_origin',
    'Probe an HTTP origin to discover its payment protocol requirements',
    {
      url: z.string().url().describe('The URL to probe'),
    },
    async ({ url }) => {
      const result = await probeOrigin(url, methods);

      if (!result.reachable) {
        return {
          content: [{ type: 'text' as const, text: `Unreachable: ${result.error}` }],
          isError: true,
        };
      }

      const summary = {
        url: result.url,
        requires402: result.requires402,
        candidates: result.candidates.map((c) => ({
          protocol: c.protocol,
          method: c.normalized.method,
          intent: c.normalized.intent,
          amount: c.normalized.amount?.toString(),
          currency: c.normalized.currency,
        })),
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
      };
    },
  );

  return server;
}

/**
 * Creates and starts an MCP server that exposes mindwallet tools over stdio.
 */
export async function startMcpServer(config: MindwalletConfig): Promise<void> {
  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

**Step 4: Update the export in `index.ts`**

In `packages/cli/src/index.ts`, add the new export:

```typescript
export { createMcpServer, startMcpServer } from './mcp-server.js';
```

(Change the existing `export { startMcpServer } from './mcp-server.js';` line.)

**Step 5: Check that `InMemoryTransport` exists in the MCP SDK**

Run: `pnpm --filter mindwallet exec -- node -e "require.resolve('@modelcontextprotocol/sdk/inMemory.js')"`

If this fails, check the SDK for the correct import path. The in-memory transport may be at a different path depending on the SDK version. Adjust the import in the test accordingly.

**Step 6: Run the test**

Run: `RUN_INTEGRATION_TESTS=1 OWS_PASSPHRASE=test pnpm --filter mindwallet run test -- src/mcp-server.test.ts`
Expected: PASS — 4 tests

**Step 7: Run all CLI tests and typecheck**

Run: `pnpm --filter mindwallet run test && pnpm --filter mindwallet run typecheck`
Expected: All pass

**Step 8: Commit**

```bash
git add packages/cli/src/mcp-server.ts packages/cli/src/mcp-server.test.ts packages/cli/src/index.ts
git commit -m "test(cli): add MCP server integration tests with in-memory transport"
```

---

### Task 6: Extract shared SIWX test server helper

Tasks 3, 4, and 5 each inline the same SIWX test server. This duplicates ~25 lines across three files. Extract into a shared helper within the CLI test files.

**Files:**
- Create: `packages/cli/src/test-helpers.ts`
- Modify: `packages/cli/src/commands/fetch.test.ts` — use shared helper
- Modify: `packages/cli/src/commands/pay.test.ts` — use shared helper
- Modify: `packages/cli/src/mcp-server.test.ts` — use shared helper

**Step 1: Create the shared helper**

Create `packages/cli/src/test-helpers.ts`:

```typescript
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
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'payment_required',
        extensions: { 'sign-in-with-x': challenge },
      }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: 'protected content' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({ port: addr.port, url, close: () => new Promise<void>((r) => server.close(() => r())) });
    });
  });
}
```

**Step 2: Update each test file to use the shared helper**

Replace the inline `startSiwxServer` function in each test file with:

```typescript
import { startSiwxTestServer, type SiwxTestServer } from '../test-helpers.js';
```

(For `mcp-server.test.ts`, the import path is `./test-helpers.js`.)

And replace:
- `startSiwxServer()` → `startSiwxTestServer()`
- `srv.port` → `srv.port` (no change) or use `srv.url`
- `'protected content'` / `'paid content'` / `'mcp paid content'` → all become `'protected content'` (the shared server uses one body)

**Step 3: Run all CLI tests**

Run: `pnpm --filter mindwallet run test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/cli/src/test-helpers.ts packages/cli/src/commands/fetch.test.ts packages/cli/src/commands/pay.test.ts packages/cli/src/mcp-server.test.ts
git commit -m "refactor(cli): extract shared SIWX test server helper"
```

---

## Summary

| Task | What | Type | Env Vars |
|------|------|------|----------|
| 1 | Delete misplaced x402 test from CLI | Cleanup | None |
| 2 | Unit test `convertPolicy` extraction | Unit | None |
| 3 | Integration test `fetchCommand` | Integration | `RUN_INTEGRATION_TESTS` + `OWS_PASSPHRASE` |
| 4 | Integration test `payCommand` | Integration | `RUN_INTEGRATION_TESTS` + `OWS_PASSPHRASE` |
| 5 | Integration test MCP server tools | Integration | `RUN_INTEGRATION_TESTS` + `OWS_PASSPHRASE` |
| 6 | Extract shared SIWX test server | Refactor | None |

After completion, CLI test coverage will be:

| Layer | Coverage |
|-------|----------|
| Config load/save | ✅ (existing) |
| Policy conversion | ✅ (Task 2) |
| `routerFromConfig` wiring | ✅ (Task 2 + integration tests exercise it) |
| `fetchCommand` | ✅ (Task 3) |
| `payCommand` | ✅ (Task 4) |
| MCP `fetch_with_payment` | ✅ (Task 5) |
| MCP `probe_origin` | ✅ (Task 5) |
| Discover command | ✅ (existing) |
| Search command | ✅ (existing) |
| Key management | ✅ (existing) |
| SIWX e2e flow | ✅ (existing) |
| x402 e2e flow | ✅ (in core, where it belongs) |
