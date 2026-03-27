# Private Key Wallet & Env Var Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add private key wallet support to the CLI and introduce a unified `MINDWALLET_*` env var system so users can configure the CLI entirely through environment variables.

**Architecture:** `MindwalletConfig` gains optional `privateKey` and `chainIds` fields. A new `resolveConfig()` function merges env vars > config file > defaults. `routerFromConfig` branches on `privateKey` presence: private key mode enables SIWX + x402 + Tempo with an implicit x402 boost; OWS mode keeps SIWX only. `loadConfig` returns `{}` on missing file instead of throwing.

**Tech Stack:** TypeScript, vitest, viem (currently in CLI devDeps, will move to deps), `@mindwallet/core` (PrivateKeyWalletAdapter, WalletAdapter), `@mindwallet/protocols` (createX402Method, createTempoMethod, createSiwxMethod)

**Design doc:** `.ai/analyses/07_private_key_wallet_and_env_vars.md`

---

## Context for the Implementer

### Monorepo Layout

```
packages/
  core/         — @mindwallet/core: WalletAdapter interface, OwsWalletAdapter, PrivateKeyWalletAdapter, createRouter, wrapFetch
  protocols/    — @mindwallet/protocols: createSiwxMethod, createX402Method, createTempoMethod
  discovery/    — @mindwallet/discovery: probeOrigin, registry search
  cli/          — mindwallet: CLI + MCP server; this is the package we're modifying
  test-server/  — @mindwallet/test-server: local Hono server for integration tests
```

### Key Types and APIs You Must Know

**`WalletAdapter`** (from `@mindwallet/core`, defined in `packages/core/src/types/wallet.ts`):
```typescript
interface WalletAdapter {
  sign(request: SignRequest): Promise<string>;
  signMessage(request: MessageRequest): Promise<string>;
  getAccount(walletId: string, chainId: string): Promise<WalletAccount>;
  canSign(chainId: string): Promise<boolean>;
}
```

**`OwsWalletAdapter`** (from `@mindwallet/core`, defined in `packages/core/src/wallet/ows.ts`):
```typescript
interface OwsAdapterConfig {
  walletId: string;     // REQUIRED - not optional
  vaultPath: string;    // REQUIRED - not optional (e.g. ~/.minds/wallet/vault)
  passphrase?: string;  // if omitted, OWS reads OWS_PASSPHRASE env var internally
}
class OwsWalletAdapter implements WalletAdapter { constructor(config: OwsAdapterConfig) }
```

**`PrivateKeyWalletAdapter`** (from `@mindwallet/core`, defined in `packages/core/src/wallet/private-key.ts`):
```typescript
interface PrivateKeyAdapterConfig {
  privateKey: `0x${string}`;
  chainIds?: string[];  // defaults to ['eip155:1', 'eip155:8453', 'eip155:4217', 'eip155:42431']
}
class PrivateKeyWalletAdapter implements WalletAdapter {
  private readonly account: LocalAccount;  // <-- private, do NOT access directly
  constructor(config: PrivateKeyAdapterConfig)
}
```

**Protocol method factories** (from `@mindwallet/protocols`):
```typescript
// createSiwxMethod takes no config — uses wallet adapter generically
function createSiwxMethod(): RouterMethod

// createX402Method needs a viem Account for EIP-712 signing
interface X402MethodConfig { account: Account }  // viem Account type
function createX402Method(config: X402MethodConfig): RouterMethod

// createTempoMethod needs a viem Account for charge/session signing
interface TempoMethodConfig {
  account: Account;          // viem Account type
  rpcUrl?: string;           // Tempo RPC URL override
  gas?: bigint;              // fixed gas limit
  store?: RouterStateStore;  // for session channel state
}
function createTempoMethod(config: TempoMethodConfig): RouterMethod
```

**`wrapFetch`** (from `@mindwallet/core`):
```typescript
interface WrapFetchOptions {
  fetch: typeof fetch;
  router: MindRouter;
  wallet: WalletAdapter;   // <-- accepts the generic interface, NOT OwsWalletAdapter specifically
  state: RouterStateStore;
}
function wrapFetch(options: WrapFetchOptions): typeof fetch
```

### Current CLI File State

**`packages/cli/src/config.ts`** — Current `MindwalletConfig`:
```typescript
interface MindwalletConfig {
  walletId: string;        // <-- currently required, must become optional
  vaultPath: string;       // <-- currently required, must become optional
  passphrase?: string;
  policy?: PolicyRuleConfig[];
  rpcUrls?: Record<string, string>;
}
```
`loadConfig()` currently throws on missing file (ENOENT). Must change to return `{}`.
`configPath()` reads `CONFIG_PATH` env var, falling back to `~/.config/mindwallet/config.json`.

**`packages/cli/src/router-from-config.ts`** — Current `RouterContext`:
```typescript
interface RouterContext {
  router: MindRouter;
  wallet: OwsWalletAdapter;   // <-- must widen to WalletAdapter
  state: RouterStateStore;
  methods: RouterMethod[];
}
```
Current `routerFromConfig` always creates OWS adapter + SIWX-only methods. Must add private key branch.

**`packages/cli/src/index.ts`** — Public API exports. Must add `resolveConfig`, `readEnvOverrides`.

### What Already Has Tests

- `packages/cli/src/router-from-config.test.ts` — 8 unit tests for `convertPolicy`
- `packages/cli/src/commands/fetch.test.ts` — 2 integration tests (SIWX 402, verbose mode). Gated on `RUN_INTEGRATION_TESTS` + `OWS_PASSPHRASE`.
- `packages/cli/src/commands/pay.test.ts` — 3 integration tests (probe+pay, verbose, unreachable). Same gates.
- `packages/cli/src/mcp-server.test.ts` — 4 integration tests using InMemoryTransport. Same gates.
- `packages/cli/src/test-helpers.ts` — Shared `startSiwxTestServer()` for SIWX 402 testing.

### Test Environment

- Test runner: vitest
- Run CLI tests: `pnpm --filter mindwallet exec vitest run`
- Typecheck: `pnpm --filter mindwallet typecheck`
- Build: `pnpm --filter mindwallet build`
- Full check: `pnpm --filter mindwallet check` (typecheck + build + test)
- Integration tests gated on: `RUN_INTEGRATION_TESTS=1` + `OWS_PASSPHRASE` (for OWS tests)
- Private key tests only need: `RUN_INTEGRATION_TESTS=1` (no OWS passphrase needed)

### Critical Pitfall: `PrivateKeyWalletAdapter.account` is Private

The x402 and Tempo methods need a raw viem `Account` object. `PrivateKeyWalletAdapter` stores `this.account` as `private readonly`. **Do NOT cast to `(wallet as any).account`.**

Instead, call `privateKeyToAccount(config.privateKey)` from `viem/accounts` directly and pass the resulting `Account` to both the `PrivateKeyWalletAdapter` constructor (via its `privateKey` field — it calls `privateKeyToAccount` internally too) and the protocol method factories. This means the account is derived twice, which is cheap and correct.

```typescript
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(config.privateKey);
const wallet = new PrivateKeyWalletAdapter({ privateKey: config.privateKey, chainIds: config.chainIds });
const methods = [
  createSiwxMethod(),
  createX402Method({ account }),
  createTempoMethod({ account, rpcUrl: config.rpcUrls?.['tempo'], store: state }),
];
```

### Critical Pitfall: `OwsAdapterConfig` Fields Are Required

`OwsAdapterConfig` requires `walletId: string` and `vaultPath: string` (not optional). When `MindwalletConfig` makes these optional, the OWS branch in `routerFromConfig` must provide defaults:
- `walletId` defaults to `'default'`
- `vaultPath` defaults to `join(homedir(), '.minds', 'wallet', 'vault')`

### Critical Pitfall: `viem` Must Move to Dependencies

`viem` is currently in CLI's `devDependencies`. After this work, `router-from-config.ts` imports `privateKeyToAccount` from `viem/accounts` — this is production code, not test code. `viem` must move to `dependencies` for the production build to work.

---

### Task 1: Make `loadConfig` return `{}` on missing file

Currently `loadConfig` does `readFileSync(path, 'utf8')` which throws `ENOENT` when the file doesn't exist. This blocks env-var-only usage — users should be able to run `MINDWALLET_PRIVATE_KEY=0x... mindwallet fetch ...` without creating a config file.

**Files:**
- Modify: `packages/cli/src/config.ts:44-47` (the `loadConfig` function)
- Create: `packages/cli/src/config.test.ts`

**Step 1: Write the failing test**

Create the file `packages/cli/src/config.test.ts` with this exact content:

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

Run: `pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: FAIL — first test throws `Error: ENOENT: no such file or directory` because `readFileSync` doesn't catch missing files.

**Step 3: Write minimal implementation**

Replace the `loadConfig` function body in `packages/cli/src/config.ts` (lines 44-47). The current code is:

```typescript
export function loadConfig(path: string = configPath()): MindwalletConfig {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as MindwalletConfig;
}
```

Replace with:

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

Run: `pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: PASS — all 3 tests green.

**Step 5: Run existing tests to confirm no regressions**

Run: `pnpm --filter mindwallet exec vitest run`

Expected: All existing tests still pass. No existing code depends on `loadConfig` throwing on missing file.

**Step 6: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/src/config.test.ts
git commit -m "feat(cli): loadConfig returns {} on missing file for env-var-only usage"
```

---

### Task 2: Add `privateKey` and `chainIds` to `MindwalletConfig`, make OWS fields optional

The current `MindwalletConfig` has `walletId: string` and `vaultPath: string` as required. Both must become optional to support: (a) private key mode where these don't apply, and (b) env-var-only mode where defaults are used.

**Files:**
- Modify: `packages/cli/src/config.ts:17-28` (the `MindwalletConfig` interface)
- Modify: `packages/cli/src/config.test.ts` (add type-level test)

**Step 1: Write the failing test**

Add to the **bottom** of `packages/cli/src/config.test.ts`, after the existing `describe('loadConfig')` block:

```typescript
import type { MindwalletConfig } from './config.js';

describe('MindwalletConfig type', () => {
  it('accepts privateKey and chainIds fields', () => {
    const config: MindwalletConfig = {
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      chainIds: ['eip155:8453'],
    };
    expect(config.privateKey).toBeDefined();
    expect(config.chainIds).toEqual(['eip155:8453']);
  });

  it('accepts empty config (all fields optional)', () => {
    const config: MindwalletConfig = {};
    expect(config).toEqual({});
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: FAIL — TypeScript compilation error: `privateKey` does not exist on type `MindwalletConfig`, and `{}` is not assignable to `MindwalletConfig` (because `walletId` and `vaultPath` are required).

**Step 3: Write minimal implementation**

Replace the `MindwalletConfig` interface in `packages/cli/src/config.ts` (lines 17-28). The current interface:

```typescript
export interface MindwalletConfig {
  /** OWS wallet name/ID to use for signing. */
  walletId: string;
  /** Path to the OWS vault directory. */
  vaultPath: string;
  /** Passphrase for the OWS vault (use env var OWS_PASSPHRASE in production). */
  passphrase?: string;
  /** Policy rules to apply during payment selection. */
  policy?: PolicyRuleConfig[];
  /** RPC URL overrides keyed by chainId. */
  rpcUrls?: Record<string, string>;
}
```

Replace with:

```typescript
export interface MindwalletConfig {
  /** OWS wallet name/ID to use for signing. Defaults to "default". */
  walletId?: string;
  /** Path to the OWS vault directory. Defaults to ~/.minds/wallet/vault. */
  vaultPath?: string;
  /** Passphrase for the OWS vault (use env var OWS_PASSPHRASE in production). */
  passphrase?: string;
  /** Raw EVM private key for non-OWS usage (hex-encoded, 0x-prefixed). Mutually exclusive with walletId. */
  privateKey?: `0x${string}`;
  /** CAIP-2 chain IDs for private key signing. Only used with privateKey. */
  chainIds?: string[];
  /** Policy rules to apply during payment selection. */
  policy?: PolicyRuleConfig[];
  /** RPC URL overrides keyed by network name (e.g. "base", "tempo"). */
  rpcUrls?: Record<string, string>;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: PASS — all 5 tests (3 loadConfig + 2 type tests).

**Step 5: Run typecheck to check downstream impact**

Run: `pnpm --filter mindwallet typecheck`

Expected: May produce errors in existing test files that construct `MindwalletConfig` with `walletId` and `vaultPath` — these should still work because we made the fields optional (removing a requirement is backward-compatible for existing callers that already provided them). If there are errors, it means some code was accessing `config.walletId` as `string` without a null check — that will be fixed in Task 4.

**Step 6: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/src/config.test.ts
git commit -m "feat(cli): add privateKey/chainIds to MindwalletConfig, make OWS fields optional"
```

---

### Task 3: Add `readEnvOverrides` and `resolveConfig`

These two functions implement the env var resolution layer. `readEnvOverrides` reads `MINDWALLET_*` env vars into a partial config. `resolveConfig` merges env vars over the config file.

**Files:**
- Modify: `packages/cli/src/config.ts` (add two functions at the end)
- Modify: `packages/cli/src/config.test.ts` (add test blocks)

**Step 1: Write the failing tests**

Add the following import at the **top** of `packages/cli/src/config.test.ts` (merge with existing imports):

```typescript
import { loadConfig, resolveConfig, readEnvOverrides } from './config.js';
```

Then add these two new `describe` blocks at the **bottom** of the file:

```typescript
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

  it('trims whitespace in comma-separated MINDWALLET_CHAIN_IDS', () => {
    process.env['MINDWALLET_CHAIN_IDS'] = ' eip155:8453 , eip155:4217 ';
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

  it('reads MINDWALLET_RPC_BASE and MINDWALLET_RPC_TEMPO into rpcUrls', () => {
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

  it('omits rpcUrls entirely when no RPC env vars are set', () => {
    const overrides = readEnvOverrides();
    expect(overrides.rpcUrls).toBeUndefined();
  });

  it('omits unset env vars from result', () => {
    // Make sure none of our env vars are set
    delete process.env['MINDWALLET_PRIVATE_KEY'];
    delete process.env['MINDWALLET_WALLET_ID'];
    delete process.env['MINDWALLET_CHAIN_IDS'];
    delete process.env['MINDWALLET_VAULT_PATH'];
    delete process.env['MINDWALLET_RPC_BASE'];
    delete process.env['MINDWALLET_RPC_TEMPO'];

    const overrides = readEnvOverrides();
    expect(overrides.privateKey).toBeUndefined();
    expect(overrides.walletId).toBeUndefined();
    expect(overrides.chainIds).toBeUndefined();
    expect(overrides.vaultPath).toBeUndefined();
    expect(overrides.rpcUrls).toBeUndefined();
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
      expect(config.walletId).toBe('env-wallet');       // env overrides file
      expect(config.vaultPath).toBe('/file/vault');     // file value preserved
    } finally {
      delete process.env['MINDWALLET_WALLET_ID'];
      delete process.env['CONFIG_PATH'];
      unlinkSync(path);
    }
  });

  it('works with no config file and only env vars', () => {
    process.env['MINDWALLET_PRIVATE_KEY'] = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const saved = process.env['CONFIG_PATH'];
    process.env['CONFIG_PATH'] = '/tmp/nonexistent-resolve-' + Date.now() + '.json';
    try {
      const config = resolveConfig();
      expect(config.privateKey).toBe('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    } finally {
      delete process.env['MINDWALLET_PRIVATE_KEY'];
      if (saved !== undefined) process.env['CONFIG_PATH'] = saved;
      else delete process.env['CONFIG_PATH'];
    }
  });

  it('returns empty config when no file and no env vars', () => {
    const saved = process.env['CONFIG_PATH'];
    process.env['CONFIG_PATH'] = '/tmp/nonexistent-empty-' + Date.now() + '.json';
    try {
      const config = resolveConfig();
      expect(config).toEqual({});
    } finally {
      if (saved !== undefined) process.env['CONFIG_PATH'] = saved;
      else delete process.env['CONFIG_PATH'];
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: FAIL — `readEnvOverrides` and `resolveConfig` are not exported from `./config.js`.

**Step 3: Write minimal implementation**

Add the following two functions to the **end** of `packages/cli/src/config.ts`, after the existing `saveConfig` function:

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

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter mindwallet exec vitest run src/config.test.ts`

Expected: PASS — all tests green (3 loadConfig + 2 type + 8 readEnvOverrides + 3 resolveConfig = 16 tests).

**Step 5: Run full test suite**

Run: `pnpm --filter mindwallet exec vitest run`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/src/config.test.ts
git commit -m "feat(cli): add readEnvOverrides and resolveConfig for MINDWALLET_* env vars"
```

---

### Task 4: Move `viem` from devDependencies to dependencies

`routerFromConfig` will import `privateKeyToAccount` from `viem/accounts` in the next task. This is production code (not test-only), so `viem` must be in `dependencies`.

**Files:**
- Modify: `packages/cli/package.json`

**Step 1: Move viem**

In `packages/cli/package.json`, the current state is:

```json
"dependencies": {
  "@mindwallet/core": "workspace:*",
  "@mindwallet/discovery": "workspace:*",
  "@mindwallet/protocols": "workspace:*",
  "@modelcontextprotocol/sdk": "^1.27.1",
  "zod": "^4.3.6"
},
"devDependencies": {
  "@mindwallet/test-server": "workspace:*",
  "@open-wallet-standard/core": "^1.0.0",
  "@types/node": "^25.5.0",
  "tsup": "^8.0.0",
  "typescript": "^5.4.0",
  "viem": "^2.47.6",
  "vitest": "^1.6.0"
}
```

Move `"viem": "^2.47.6"` from `devDependencies` to `dependencies`. The result:

```json
"dependencies": {
  "@mindwallet/core": "workspace:*",
  "@mindwallet/discovery": "workspace:*",
  "@mindwallet/protocols": "workspace:*",
  "@modelcontextprotocol/sdk": "^1.27.1",
  "viem": "^2.47.6",
  "zod": "^4.3.6"
},
"devDependencies": {
  "@mindwallet/test-server": "workspace:*",
  "@open-wallet-standard/core": "^1.0.0",
  "@types/node": "^25.5.0",
  "tsup": "^8.0.0",
  "typescript": "^5.4.0",
  "vitest": "^1.6.0"
}
```

**Step 2: Run pnpm install to update lockfile**

Run: `pnpm install`

Expected: Clean install, no errors. The lockfile will update to reflect the dependency category change.

**Step 3: Run full check to confirm no regressions**

Run: `pnpm --filter mindwallet check`

Expected: typecheck PASS, build PASS, test PASS.

**Step 4: Commit**

```bash
git add packages/cli/package.json pnpm-lock.yaml
git commit -m "chore(cli): move viem to production dependencies for private key wallet"
```

---

### Task 5: Add private key branch and mutual exclusion to `routerFromConfig`

This is the core implementation task. `routerFromConfig` gets: (a) validation that `privateKey` and `walletId` are mutually exclusive, (b) a private key branch that creates `PrivateKeyWalletAdapter` + all three protocol methods + implicit x402 boost, (c) an OWS branch with defaults for the now-optional `walletId`/`vaultPath`.

**Files:**
- Modify: `packages/cli/src/router-from-config.ts` (the whole file)
- Modify: `packages/cli/src/router-from-config.test.ts` (add new tests)

**Step 1: Write the failing tests**

Add `routerFromConfig` to the existing import in `packages/cli/src/router-from-config.test.ts`:

```typescript
import { convertPolicy, routerFromConfig } from './router-from-config.js';
```

Then add this new `describe` block **after** the existing `describe('convertPolicy')` block:

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

  it('creates three methods (siwx + x402 + tempo) when privateKey is set', () => {
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    });
    expect(ctx.methods).toHaveLength(3);
    expect(ctx.wallet).toBeDefined();
    expect(ctx.router).toBeDefined();
    expect(ctx.state).toBeDefined();
  });

  it('creates one method (siwx only) in OWS mode', () => {
    // OWS mode with explicit walletId/vaultPath (no private key)
    const ctx = routerFromConfig({
      walletId: 'test-wallet',
      vaultPath: '/tmp/test-vault',
    });
    expect(ctx.methods).toHaveLength(1);
  });

  it('uses OWS defaults when neither privateKey nor walletId are set', () => {
    // Empty config = OWS mode with defaults
    const ctx = routerFromConfig({});
    expect(ctx.methods).toHaveLength(1);
    expect(ctx.wallet).toBeDefined();
  });

  it('passes custom chainIds to private key adapter', () => {
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      chainIds: ['eip155:8453'],
    });
    // The adapter should be configured — we verify by checking canSign
    expect(ctx.wallet.canSign('eip155:8453')).resolves.toBe(true);
    expect(ctx.wallet.canSign('eip155:1')).resolves.toBe(false);
  });

  it('passes rpcUrls.tempo to Tempo method', () => {
    // Just verify this doesn't throw — the RPC URL is used at call time
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      rpcUrls: { tempo: 'https://custom-tempo.example.com' },
    });
    expect(ctx.methods).toHaveLength(3);
  });

  it('merges user policy with implicit x402 boost in private key mode', () => {
    const ctx = routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      policy: [{ type: 'deny-protocol', protocol: 'mpp' }],
    });
    // Should not throw — both user policy and implicit x402 boost are applied
    expect(ctx.router).toBeDefined();
    expect(ctx.methods).toHaveLength(3);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter mindwallet exec vitest run src/router-from-config.test.ts`

Expected: FAIL — `routerFromConfig({})` throws because `OwsWalletAdapter` receives `undefined` for `walletId` and `vaultPath`. The mutual exclusion test fails because no validation exists.

**Step 3: Write minimal implementation**

Replace the entire content of `packages/cli/src/router-from-config.ts`:

```typescript
// ABOUTME: Builds a MindRouter from a MindwalletConfig, wiring protocols and policy rules
// ABOUTME: Supports both OWS vault wallets (SIWX) and private key wallets (SIWX + x402 + Tempo)

import { join } from 'node:path';
import { homedir } from 'node:os';
import { privateKeyToAccount } from 'viem/accounts';
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
    const account = privateKeyToAccount(config.privateKey);
    const wallet = new PrivateKeyWalletAdapter({
      privateKey: config.privateKey,
      chainIds: config.chainIds,
    });

    const methods: RouterMethod[] = [
      createSiwxMethod(),
      createX402Method({ account }),
      createTempoMethod({ account, rpcUrl: config.rpcUrls?.['tempo'], store: state }),
    ];

    const policy: PolicyRule[] = [
      ...userPolicy,
      { type: 'prefer-protocol', protocol: 'x402' as any, boost: 0.1 },
    ];

    const router = createRouter({ methods, state, policy });
    return { router, wallet, state, methods };
  }

  // OWS branch
  const wallet = new OwsWalletAdapter({
    walletId: config.walletId ?? 'default',
    vaultPath: config.vaultPath ?? join(homedir(), '.minds', 'wallet', 'vault'),
    passphrase: config.passphrase,
  });

  const methods: RouterMethod[] = [createSiwxMethod()];
  const router = createRouter({ methods, state, policy: userPolicy });
  return { router, wallet, state, methods };
}
```

**Key changes to verify:**
1. `RouterContext.wallet` type is now `WalletAdapter` (was `OwsWalletAdapter`). Downstream callers (`wrapFetch`, `fetchCommand`, `payCommand`, `createMcpServer`) all accept `WalletAdapter` — no breakage expected.
2. `privateKeyToAccount` imported from `viem/accounts` (now a production dependency from Task 4).
3. The OWS branch provides defaults: `walletId ?? 'default'`, `vaultPath ?? join(homedir(), '.minds', 'wallet', 'vault')`.
4. The private key branch creates all three methods and appends `prefer-protocol: x402` with boost 0.1 to user policy.

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter mindwallet exec vitest run src/router-from-config.test.ts`

Expected: PASS — all tests green (8 existing convertPolicy + 7 new routerFromConfig = 15 tests).

**Step 5: Run typecheck to verify downstream compatibility**

Run: `pnpm --filter mindwallet typecheck`

Expected: PASS. The `RouterContext.wallet` type widened from `OwsWalletAdapter` to `WalletAdapter`. Check these files aren't broken:
- `packages/cli/src/commands/fetch.ts:24` — `wrapFetch({ ...wallet })` → `WrapFetchOptions.wallet` is `WalletAdapter` ✓
- `packages/cli/src/commands/pay.ts:22` — same pattern ✓
- `packages/cli/src/mcp-server.ts:17` — same pattern ✓
- `packages/cli/src/index.ts` — exports `RouterContext` type ✓

If typecheck finds issues with code accessing OWS-specific methods on `RouterContext.wallet`, those callers need to be updated to use only `WalletAdapter` interface methods.

**Step 6: Run full test suite**

Run: `pnpm --filter mindwallet exec vitest run`

Expected: All tests pass.

**Step 7: Commit**

```bash
git add packages/cli/src/router-from-config.ts packages/cli/src/router-from-config.test.ts
git commit -m "feat(cli): add private key wallet branch to routerFromConfig with x402 + Tempo"
```

---

### Task 6: Export new functions from public API

Add `resolveConfig` and `readEnvOverrides` to the public API surface.

**Files:**
- Modify: `packages/cli/src/index.ts`

**Step 1: Add exports**

Add these two lines to `packages/cli/src/index.ts`:

```typescript
export { resolveConfig, readEnvOverrides } from './config.js';
```

The full file should look like:

```typescript
// ABOUTME: Public API surface for mindwallet CLI package
// ABOUTME: Re-exports router factory and configuration helpers

export { loadConfig, saveConfig, configPath, resolveConfig, readEnvOverrides } from './config.js';
export type { MindwalletConfig, PolicyRuleConfig } from './config.js';
export { routerFromConfig } from './router-from-config.js';
export type { RouterContext } from './router-from-config.js';
export { createMcpServer, startMcpServer } from './mcp-server.js';
export { discoverCommand } from './commands/discover.js';
export type { DiscoverCommandOptions } from './commands/discover.js';
export { searchCommand } from './commands/search.js';
export type { SearchCommandOptions } from './commands/search.js';
export { keyCreateCommand, keyRevokeCommand, keyListCommand } from './commands/key.js';
export type { KeyCreateOptions, KeyRevokeOptions, KeyListOptions } from './commands/key.js';
```

**Step 2: Run typecheck + build**

Run: `pnpm --filter mindwallet check`

Expected: typecheck PASS, build PASS, test PASS.

**Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): export resolveConfig and readEnvOverrides from public API"
```

---

### Task 7: Integration test — private key wallet with SIWX flow

This test verifies the full end-to-end path: private key config → `routerFromConfig` → `wrapFetch` → SIWX 402 resolution. It uses the existing `startSiwxTestServer()` helper (no OWS vault needed, no `OWS_PASSPHRASE` needed).

**Files:**
- Modify: `packages/cli/src/commands/fetch.test.ts`

**Step 1: Write the failing test**

Add a new `describe` block at the **bottom** of `packages/cli/src/commands/fetch.test.ts`. Note this test only needs `RUN_INTEGRATION_TESTS` — no `OWS_PASSPHRASE` required:

```typescript
const pkSkip = !process.env['RUN_INTEGRATION_TESTS'];

describe.skipIf(pkSkip)('fetchCommand: private key wallet + SIWX 402 integration', () => {
  let srv: SiwxTestServer;
  let config: MindwalletConfig;

  // Hardhat account #0 — a well-known test private key, not a real secret
  const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

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

  it('includes verbose output with private key wallet', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await fetchCommand(`${srv.url}/resource`, config, { verbose: true });
      const errOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(errOutput).toContain('HTTP 200');
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });
});
```

Make sure the file's existing imports include `beforeAll`, `afterAll`, and `vi` from vitest (they already do based on the existing test).

**Step 2: Run test to verify it fails**

Run: `RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/commands/fetch.test.ts`

Expected: FAIL if Tasks 1-5 not yet complete; PASS if they are. This test validates the integration.

**Step 3: No new implementation needed**

This test exercises code already implemented in Tasks 1-5.

**Step 4: Run test to verify it passes**

Run: `RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/commands/fetch.test.ts`

Expected: PASS — all tests green (2 existing OWS SIWX + 2 new private key SIWX = 4 tests, though OWS tests may be skipped without `OWS_PASSPHRASE`).

**Step 5: Commit**

```bash
git add packages/cli/src/commands/fetch.test.ts
git commit -m "test(cli): add private key wallet integration test for fetchCommand"
```

---

### Task 8: Final verification

No new code. Run the full verification suite to confirm everything works.

**Step 1: Run all CLI unit tests (no integration gate)**

Run: `pnpm --filter mindwallet exec vitest run`

Expected: All unit tests PASS. Integration tests are skipped (no `RUN_INTEGRATION_TESTS` set).

**Step 2: Run all CLI tests including integration**

Run: `RUN_INTEGRATION_TESTS=1 OWS_PASSPHRASE=test pnpm --filter mindwallet exec vitest run`

Expected: All tests PASS — both OWS integration tests and private key integration tests.

**Step 3: Run typecheck**

Run: `pnpm --filter mindwallet typecheck`

Expected: PASS — no type errors.

**Step 4: Run build**

Run: `pnpm --filter mindwallet build`

Expected: PASS — `dist/` produced with all new exports.

**Step 5: Run full monorepo check**

Run: `pnpm -r check`

Expected: PASS — all packages typecheck, build, and test successfully. This catches any cross-package breakage from the `RouterContext.wallet` type change.

**Step 6: If any test fails**

- Read the error output carefully
- Check if the failure is in a file you modified or a downstream consumer
- The most likely failure points:
  - `RouterContext.wallet` type change breaking a caller that expects `OwsWalletAdapter`
  - `MindwalletConfig.walletId` becoming optional breaking a caller that assumed `string`
  - `viem` import resolution issues if the dependency move wasn't picked up by pnpm
