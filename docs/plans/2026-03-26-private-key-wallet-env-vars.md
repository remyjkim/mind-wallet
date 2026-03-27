# Private Key Wallet & Env Var Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add private key wallet support to the CLI and introduce a unified `MINDWALLET_*` env var system so users can configure the CLI entirely through environment variables.

**Architecture:** `MindwalletConfig` gains optional `privateKey` and `chainIds` fields. A new `resolveConfig()` function merges env vars > config file > defaults. `routerFromConfig` branches on `privateKey` presence: private key mode enables SIWX + x402 + Tempo with an implicit x402 boost; OWS mode keeps SIWX only. `loadConfig` returns `{}` on missing file instead of throwing.

**Tech Stack:** TypeScript, vitest, viem (already a devDependency), `@mindwallet/core` (PrivateKeyWalletAdapter), `@mindwallet/protocols` (createX402Method, createTempoMethod)

**Design doc:** `.ai/analyses/07_private_key_wallet_and_env_vars.md`

---

### Task 1: Make `loadConfig` return `{}` on missing file

**Files:**
- Modify: `packages/cli/src/config.ts:44-47`
- Create: `packages/cli/src/config.test.ts`

**Step 1: Write the failing test**

Create `packages/cli/src/config.test.ts`:

```typescript
// ABOUTME: Tests for config loading, env var resolution, and validation
// ABOUTME: Covers loadConfig behavior, resolveConfig merging, and mutual exclusion rules

import { describe, it, expect } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('returns empty object when file does not exist', () => {
    const result = loadConfig('/tmp/nonexistent-mindwallet-config-' + Date.now() + '.json');
    expect(result).toEqual({});
  });

  it('throws on malformed JSON', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const path = '/tmp/mindwallet-bad-config-' + Date.now() + '.json';
    writeFileSync(path, '{ not valid json');
    try {
      expect(() => loadConfig(path)).toThrow();
    } finally {
      unlinkSync(path);
    }
  });

  it('parses valid config file', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const path = '/tmp/mindwallet-good-config-' + Date.now() + '.json';
    writeFileSync(path, JSON.stringify({ walletId: 'myWallet', vaultPath: '/tmp/vault' }));
    try {
      const config = loadConfig(path);
      expect(config.walletId).toBe('myWallet');
      expect(config.vaultPath).toBe('/tmp/vault');
    } finally {
      unlinkSync(path);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: FAIL — `loadConfig` throws ENOENT on missing file (first test fails).

**Step 3: Write minimal implementation**

In `packages/cli/src/config.ts`, change `loadConfig`:

```typescript
export function loadConfig(path: string = configPath()): MindwalletConfig {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {} as MindwalletConfig;
    }
    throw err;
  }
  return JSON.parse(raw) as MindwalletConfig;
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/src/config.test.ts
git commit -m "feat(cli): loadConfig returns {} on missing file for env-var-only usage"
```

---

### Task 2: Add `privateKey` and `chainIds` to `MindwalletConfig`

**Files:**
- Modify: `packages/cli/src/config.ts:17-28`

**Step 1: Write the failing test**

Add to `packages/cli/src/config.test.ts`:

```typescript
describe('MindwalletConfig type', () => {
  it('accepts privateKey and chainIds fields', () => {
    const config: MindwalletConfig = {
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      chainIds: ['eip155:8453'],
    };
    expect(config.privateKey).toBeDefined();
    expect(config.chainIds).toEqual(['eip155:8453']);
  });
});
```

Note: Import `MindwalletConfig` type at the top of the test file.

**Step 2: Run test to verify it fails**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: FAIL — TypeScript error: `privateKey` and `chainIds` don't exist on `MindwalletConfig`.

**Step 3: Write minimal implementation**

In `packages/cli/src/config.ts`, update the `MindwalletConfig` interface. Make all OWS fields optional:

```typescript
export interface MindwalletConfig {
  /** OWS wallet name/ID to use for signing. */
  walletId?: string;
  /** Path to the OWS vault directory. */
  vaultPath?: string;
  /** Passphrase for the OWS vault (use env var OWS_PASSPHRASE in production). */
  passphrase?: string;
  /** Raw EVM private key for non-OWS usage (hex-encoded, 0x-prefixed). */
  privateKey?: `0x${string}`;
  /** CAIP-2 chain IDs for private key signing. Defaults to Base + Tempo. */
  chainIds?: string[];
  /** Policy rules to apply during payment selection. */
  policy?: PolicyRuleConfig[];
  /** RPC URL overrides keyed by network name (e.g. "base", "tempo"). */
  rpcUrls?: Record<string, string>;
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: PASS

**Step 5: Run typecheck to verify nothing broke**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet typecheck`

Expected: PASS — `walletId` was previously required, so callers that construct `MindwalletConfig` objects without it (like tests) should still work since they were already providing it. Check if any callers pass config to `OwsWalletAdapter` without a fallback — this will be addressed in Task 4.

**Step 6: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/src/config.test.ts
git commit -m "feat(cli): add privateKey and chainIds to MindwalletConfig"
```

---

### Task 3: Add `readEnvOverrides` and `resolveConfig`

**Files:**
- Modify: `packages/cli/src/config.ts`
- Modify: `packages/cli/src/config.test.ts`

**Step 1: Write the failing tests**

Add to `packages/cli/src/config.test.ts`:

```typescript
import { resolveConfig, readEnvOverrides } from './config.js';

describe('readEnvOverrides', () => {
  it('reads MINDWALLET_PRIVATE_KEY', () => {
    process.env['MINDWALLET_PRIVATE_KEY'] = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.privateKey).toBe('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    } finally {
      delete process.env['MINDWALLET_PRIVATE_KEY'];
    }
  });

  it('reads MINDWALLET_CHAIN_IDS as comma-separated list', () => {
    process.env['MINDWALLET_CHAIN_IDS'] = 'eip155:8453,eip155:4217';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.chainIds).toEqual(['eip155:8453', 'eip155:4217']);
    } finally {
      delete process.env['MINDWALLET_CHAIN_IDS'];
    }
  });

  it('reads MINDWALLET_WALLET_ID', () => {
    process.env['MINDWALLET_WALLET_ID'] = 'my-wallet';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.walletId).toBe('my-wallet');
    } finally {
      delete process.env['MINDWALLET_WALLET_ID'];
    }
  });

  it('reads MINDWALLET_VAULT_PATH', () => {
    process.env['MINDWALLET_VAULT_PATH'] = '/custom/vault';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.vaultPath).toBe('/custom/vault');
    } finally {
      delete process.env['MINDWALLET_VAULT_PATH'];
    }
  });

  it('reads MINDWALLET_RPC_BASE and MINDWALLET_RPC_TEMPO', () => {
    process.env['MINDWALLET_RPC_BASE'] = 'https://base.example.com';
    process.env['MINDWALLET_RPC_TEMPO'] = 'https://tempo.example.com';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.rpcUrls).toEqual({
        base: 'https://base.example.com',
        tempo: 'https://tempo.example.com',
      });
    } finally {
      delete process.env['MINDWALLET_RPC_BASE'];
      delete process.env['MINDWALLET_RPC_TEMPO'];
    }
  });

  it('omits unset env vars from result', () => {
    const overrides = readEnvOverrides();
    expect(overrides.privateKey).toBeUndefined();
    expect(overrides.walletId).toBeUndefined();
    expect(overrides.chainIds).toBeUndefined();
  });
});

describe('resolveConfig', () => {
  it('env vars override config file values', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const path = '/tmp/mindwallet-resolve-' + Date.now() + '.json';
    writeFileSync(path, JSON.stringify({ walletId: 'file-wallet', vaultPath: '/file/vault' }));
    process.env['MINDWALLET_WALLET_ID'] = 'env-wallet';
    process.env['CONFIG_PATH'] = path;
    try {
      const config = resolveConfig();
      expect(config.walletId).toBe('env-wallet');
      expect(config.vaultPath).toBe('/file/vault');
    } finally {
      delete process.env['MINDWALLET_WALLET_ID'];
      delete process.env['CONFIG_PATH'];
      unlinkSync(path);
    }
  });

  it('works with no config file and only env vars', () => {
    process.env['MINDWALLET_PRIVATE_KEY'] = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const saved = process.env['CONFIG_PATH'];
    process.env['CONFIG_PATH'] = '/tmp/nonexistent-' + Date.now() + '.json';
    try {
      const config = resolveConfig();
      expect(config.privateKey).toBe('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    } finally {
      delete process.env['MINDWALLET_PRIVATE_KEY'];
      if (saved !== undefined) process.env['CONFIG_PATH'] = saved;
      else delete process.env['CONFIG_PATH'];
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: FAIL — `readEnvOverrides` and `resolveConfig` don't exist yet.

**Step 3: Write minimal implementation**

Add to `packages/cli/src/config.ts`:

```typescript
/**
 * Reads MINDWALLET_* environment variables and returns a partial config.
 * Only set variables appear in the result — unset variables are omitted.
 */
export function readEnvOverrides(): Partial<MindwalletConfig> {
  const overrides: Partial<MindwalletConfig> = {};

  const privateKey = process.env['MINDWALLET_PRIVATE_KEY'];
  if (privateKey) overrides.privateKey = privateKey as `0x${string}`;

  const chainIds = process.env['MINDWALLET_CHAIN_IDS'];
  if (chainIds) overrides.chainIds = chainIds.split(',').map((s) => s.trim());

  const walletId = process.env['MINDWALLET_WALLET_ID'];
  if (walletId) overrides.walletId = walletId;

  const vaultPath = process.env['MINDWALLET_VAULT_PATH'];
  if (vaultPath) overrides.vaultPath = vaultPath;

  const rpcUrls: Record<string, string> = {};
  const rpcBase = process.env['MINDWALLET_RPC_BASE'];
  if (rpcBase) rpcUrls['base'] = rpcBase;
  const rpcTempo = process.env['MINDWALLET_RPC_TEMPO'];
  if (rpcTempo) rpcUrls['tempo'] = rpcTempo;
  if (Object.keys(rpcUrls).length > 0) overrides.rpcUrls = rpcUrls;

  return overrides;
}

/**
 * Resolves the final config by merging: env vars > config file > defaults.
 * Config file is optional — returns {} on ENOENT.
 */
export function resolveConfig(): MindwalletConfig {
  const file = loadConfig();
  const env = readEnvOverrides();
  return { ...file, ...env };
}
```

Also update the exports in `packages/cli/src/index.ts` to include `resolveConfig` and `readEnvOverrides`.

**Step 4: Run tests to verify they pass**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/src/config.test.ts packages/cli/src/index.ts
git commit -m "feat(cli): add readEnvOverrides and resolveConfig for MINDWALLET_* env vars"
```

---

### Task 4: Add mutual exclusion validation and private key branch to `routerFromConfig`

**Files:**
- Modify: `packages/cli/src/router-from-config.ts`
- Modify: `packages/cli/src/router-from-config.test.ts`

**Step 1: Write the failing tests**

Add to `packages/cli/src/router-from-config.test.ts`:

```typescript
describe('routerFromConfig', () => {
  it('throws when both privateKey and walletId are set', () => {
    expect(() =>
      routerFromConfig({
        privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        walletId: 'some-wallet',
      }),
    ).toThrow('Cannot set both privateKey and walletId');
  });

  it('creates PrivateKeyWalletAdapter when privateKey is set', () => {
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    });
    // Private key mode enables 3 methods: siwx + x402 + tempo
    expect(ctx.methods.length).toBe(3);
    expect(ctx.wallet).toBeDefined();
    expect(ctx.router).toBeDefined();
  });

  it('adds implicit prefer-protocol x402 boost in private key mode', () => {
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    });
    // The router's internal policy should include the x402 boost.
    // We verify indirectly: 3 methods means x402 is enabled, and the
    // ctx was created without error.
    expect(ctx.methods.length).toBe(3);
  });
});
```

Also add `routerFromConfig` to the import at the top of the file.

**Step 2: Run tests to verify they fail**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet exec vitest run src/router-from-config.test.ts`

Expected: FAIL — no validation, no private key branch.

**Step 3: Write minimal implementation**

Update `packages/cli/src/router-from-config.ts`:

```typescript
// ABOUTME: Builds a MindRouter from a MindwalletConfig, wiring protocols and policy rules
// ABOUTME: Supports both OWS vault wallets (SIWX) and private key wallets (SIWX + x402 + Tempo)

import {
  OwsWalletAdapter,
  PrivateKeyWalletAdapter,
  createMemoryStore,
  createRouter,
  type MindRouter,
  type PolicyRule,
  type RouterMethod,
  type RouterStateStore,
  type WalletAdapter,
} from '@mindwallet/core';
import { createSiwxMethod, createX402Method, createTempoMethod } from '@mindwallet/protocols';
import type { MindwalletConfig, PolicyRuleConfig } from './config.js';

export function convertPolicy(rules: PolicyRuleConfig[] | undefined): PolicyRule[] {
  // ... (unchanged)
}

export interface RouterContext {
  router: MindRouter;
  wallet: WalletAdapter;
  state: RouterStateStore;
  methods: RouterMethod[];
}

export function routerFromConfig(config: MindwalletConfig): RouterContext {
  if (config.privateKey && config.walletId) {
    throw new Error('Cannot set both privateKey and walletId — choose one wallet mode');
  }

  const state = createMemoryStore();
  const userPolicy = convertPolicy(config.policy);

  if (config.privateKey) {
    const wallet = new PrivateKeyWalletAdapter({
      privateKey: config.privateKey,
      chainIds: config.chainIds,
    });

    const methods = [
      createSiwxMethod(),
      createX402Method({ account: (wallet as any).account }),
      createTempoMethod({
        account: (wallet as any).account,
        rpcUrl: config.rpcUrls?.['tempo'],
        store: state,
      }),
    ];

    const policy: PolicyRule[] = [
      ...userPolicy,
      { type: 'prefer-protocol', protocol: 'x402' as any, boost: 0.1 },
    ];

    const router = createRouter({ methods, state, policy });
    return { router, wallet, state, methods };
  }

  // OWS branch (existing behavior)
  const wallet = new OwsWalletAdapter({
    walletId: config.walletId ?? 'default',
    vaultPath: config.vaultPath ?? join(homedir(), '.minds', 'wallet', 'vault'),
    passphrase: config.passphrase,
  });

  const methods = [createSiwxMethod()];
  const router = createRouter({ methods, state, policy: userPolicy });
  return { router, wallet, state, methods };
}
```

**Important:** The `wallet` field type in `RouterContext` changes from `OwsWalletAdapter` to `WalletAdapter` to support both adapter types. Check that downstream code (fetch.ts, pay.ts, mcp-server.ts) only uses `WalletAdapter` interface methods — `wrapFetch` accepts `WalletAdapter`, so this should be safe.

Add the needed import: `import { join } from 'path'; import { homedir } from 'os';`

**Note on `(wallet as any).account`:** The `PrivateKeyWalletAdapter` stores its viem `account` as a private field. The x402 and Tempo methods need the raw viem `Account`. Two options:
1. Access via `(wallet as any).account` (quick, fragile)
2. Call `privateKeyToAccount(config.privateKey)` directly and pass to both the adapter and the methods

**Choose option 2** — it's cleaner and doesn't depend on internal structure:

```typescript
import { privateKeyToAccount } from 'viem/accounts';

if (config.privateKey) {
  const account = privateKeyToAccount(config.privateKey);
  const wallet = new PrivateKeyWalletAdapter({
    privateKey: config.privateKey,
    chainIds: config.chainIds,
  });

  const methods = [
    createSiwxMethod(),
    createX402Method({ account }),
    createTempoMethod({
      account,
      rpcUrl: config.rpcUrls?.['tempo'],
      store: state,
    }),
  ];
  // ...
}
```

This requires `viem` as a dependency (not just devDependency) in the CLI package. Check if it's already there — it's currently in `devDependencies`. Move it to `dependencies` since it's now used in production code.

**Step 4: Run tests to verify they pass**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet exec vitest run src/router-from-config.test.ts`

Expected: PASS (all tests including existing convertPolicy tests)

**Step 5: Run typecheck**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet typecheck`

Expected: PASS — verify that `RouterContext.wallet` type change from `OwsWalletAdapter` to `WalletAdapter` doesn't break callers.

**Step 6: Commit**

```bash
git add packages/cli/src/router-from-config.ts packages/cli/src/router-from-config.test.ts packages/cli/package.json
git commit -m "feat(cli): add private key wallet branch to routerFromConfig with x402 + Tempo"
```

---

### Task 5: Move `viem` from devDependencies to dependencies

**Files:**
- Modify: `packages/cli/package.json`

This is a prerequisite for Task 4's production code importing `viem/accounts`. If vitest resolves it fine from devDependencies during testing (Task 4), this can be done as a follow-up. But for correctness the production build needs it in `dependencies`.

**Step 1: Move viem**

In `packages/cli/package.json`, move `"viem": "^2.47.6"` from `devDependencies` to `dependencies`.

**Step 2: Run pnpm install**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm install`

Expected: Clean install, no errors.

**Step 3: Run build + typecheck**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet check`

Expected: PASS

**Step 4: Commit**

```bash
git add packages/cli/package.json pnpm-lock.yaml
git commit -m "chore(cli): move viem to production dependencies for private key wallet"
```

---

### Task 6: Export `resolveConfig` and update `index.ts`

**Files:**
- Modify: `packages/cli/src/index.ts`

**Step 1: Add exports**

Add to `packages/cli/src/index.ts`:

```typescript
export { resolveConfig, readEnvOverrides } from './config.js';
```

**Step 2: Run typecheck + build**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet check`

Expected: PASS

**Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): export resolveConfig and readEnvOverrides from public API"
```

---

### Task 7: Integration test — private key x402 flow

**Files:**
- Modify: `packages/cli/src/commands/fetch.test.ts`

This test uses the local test-server's x402 endpoint (already implemented in `packages/test-server`) with a `PrivateKeyWalletAdapter` to verify the full private key → x402 payment → response flow through `fetchCommand`.

**Step 1: Write the failing test**

Add a new describe block to `packages/cli/src/commands/fetch.test.ts`:

```typescript
import { createTestServer, type TestServerHandle } from '@mindwallet/test-server';

const x402Skip = !process.env['RUN_INTEGRATION_TESTS'];

describe.skipIf(x402Skip)('fetchCommand: x402 402 integration (private key + local server)', () => {
  let srv: TestServerHandle;
  let config: MindwalletConfig;

  // Use a well-known test private key (Hardhat account #0)
  const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  beforeAll(async () => {
    srv = await createTestServer();

    config = {
      privateKey: TEST_PRIVATE_KEY,
      chainIds: ['eip155:8453'],
    };
  });

  afterAll(async () => {
    await srv.close();
  });

  it('resolves an x402 402 and writes response body to stdout', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const url = `${srv.url}/x402/data`;
      await fetchCommand(url, config);

      const output = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toBeTruthy();
    } finally {
      stdoutSpy.mockRestore();
    }
  });
});
```

**Note:** The exact test-server import and API may differ. Check `packages/test-server/src/index.ts` for the actual export name and handle shape. If the test-server creates a real x402 facilitator, the Hardhat private key may not have funds on the test facilitator. In that case, adapt the test to use the SIWX endpoint with a private key config (still validates the private key → routerFromConfig → wrapFetch path) or mock the facilitator response.

**Fallback approach** if x402 test-server requires real funds: test with SIWX endpoint instead, which still exercises the private key wallet adapter path:

```typescript
describe.skipIf(x402Skip)('fetchCommand: private key wallet integration (SIWX)', () => {
  let srv: SiwxTestServer;
  let config: MindwalletConfig;

  const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  beforeAll(async () => {
    srv = await startSiwxTestServer();
    config = {
      privateKey: TEST_PRIVATE_KEY,
      chainIds: ['eip155:8453'],
    };
  });

  afterAll(async () => {
    await srv.close();
  });

  it('resolves SIWX 402 using private key wallet and writes response', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await fetchCommand(`${srv.url}/resource`, config);
      const output = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toContain('protected content');
    } finally {
      stdoutSpy.mockRestore();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/pureicis/dev/mind-wallet && RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/commands/fetch.test.ts`

Expected: FAIL — either import error (if Task 4 not yet done) or wallet construction error.

**Step 3: Verify the fix is already in place from Task 4**

No new implementation needed — this test validates that Tasks 1-4 work end-to-end.

**Step 4: Run test to verify it passes**

Run: `cd /Users/pureicis/dev/mind-wallet && RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/commands/fetch.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/commands/fetch.test.ts
git commit -m "test(cli): add private key wallet integration test for fetchCommand"
```

---

### Task 8: Final verification

**Step 1: Run all CLI tests**

Run: `cd /Users/pureicis/dev/mind-wallet && RUN_INTEGRATION_TESTS=1 OWS_PASSPHRASE=test pnpm --filter mindwallet exec vitest run`

Expected: All tests PASS.

**Step 2: Run full typecheck**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet typecheck`

Expected: PASS

**Step 3: Run full build**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm --filter mindwallet build`

Expected: PASS

**Step 4: Run the whole monorepo check (if time permits)**

Run: `cd /Users/pureicis/dev/mind-wallet && pnpm -r check`

Expected: PASS
