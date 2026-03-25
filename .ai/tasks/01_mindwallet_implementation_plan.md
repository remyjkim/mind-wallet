# mindwallet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build mindwallet — a full-stack agent payment SDK that unifies x402, MPP/Tempo, and SIWX payment protocols with intelligent multi-challenge selection, OWS-based wallet custody, and a CLI/MCP server.

**Architecture:** Four-package pnpm monorepo: `@mindwallet/core` (protocol-agnostic selection pipeline + interfaces), `@mindwallet/protocols` (x402, MPP, SIWX RouterMethod implementations), `@mindwallet/discovery` (registry search + origin probing), `mindwallet` (CLI + MCP server). OWS (`@open-wallet-standard/core`) is the default wallet adapter via a `WalletAdapter` interface that any signer can implement. All payment protocol selection goes through a unified 5-stage pipeline (parse → normalize → filter → score → select); protocol preference is a policy rule, not a code branch.

**Tech Stack:** TypeScript, pnpm workspaces, tsup (build), vitest (tests), Node.js 20+, `@open-wallet-standard/core` (wallet), `@coinbase/x402` (x402 protocol), `mppx` (MPP/Tempo), `@modelcontextprotocol/sdk` (MCP server), `yargs` (CLI), `zod` (validation)

**Reference:** `/Users/pureicis/dev/mind-wallet/.ai/analyses/03_mindwallet_architecture.md`

---

## Phase 0: Monorepo Scaffold

### Task 1: Initialize pnpm workspace

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

**Step 1: Create root package.json**

```json
{
  "name": "mindwallet-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "check": "pnpm -r check"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsup": "^8.0.0",
    "vitest": "^1.6.0"
  }
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  }
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
*.tgz
.env
.env.local
```

**Step 5: Create package scaffolds**

```bash
mkdir -p packages/core packages/protocols packages/discovery packages/cli
```

**Step 6: Run install**

```bash
pnpm install
```
Expected: lockfile created, no errors.

**Step 7: Initialize git and commit**

```bash
git init
git add pnpm-workspace.yaml package.json tsconfig.base.json .gitignore packages/
git commit -m "chore: initialize monorepo scaffold"
```

---

### Task 2: Scaffold `@mindwallet/core` package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts`

**Step 1: Create packages/core/package.json**

```json
{
  "name": "@mindwallet/core",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "check": "pnpm typecheck && pnpm build && pnpm test"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "tsup": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

**Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Create packages/core/tsup.config.ts**

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

**Step 4: Create packages/core/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 5: Create packages/core/src/index.ts (empty barrel)**

```typescript
// ABOUTME: Public API surface for @mindwallet/core
// ABOUTME: Re-exports all types, interfaces, and factory functions
```

**Step 6: Commit**

```bash
git add packages/core/
git commit -m "chore: scaffold @mindwallet/core package"
```

---

### Task 3: Scaffold `@mindwallet/protocols`, `@mindwallet/discovery`, `mindwallet`

Repeat the same scaffold pattern for the remaining three packages with appropriate package names and inter-package dependencies.

**packages/protocols/package.json** — add `"@mindwallet/core": "workspace:*"` to dependencies.

**packages/discovery/package.json** — add `"@mindwallet/core": "workspace:*"` to dependencies.

**packages/cli/package.json** — name `"mindwallet"`, add all three `@mindwallet/*` packages as dependencies. Add `"bin": { "mindwallet": "dist/cli.js" }`.

**Step 1: Create all three package.json files** (same pattern as Task 2 with adjusted names/deps)

**Step 2: Create tsconfig.json, tsup.config.ts, vitest.config.ts** for each (same pattern)

**Step 3: Create empty src/index.ts** for each

**Step 4: Run install**

```bash
pnpm install
```
Expected: workspace symlinks created, no errors.

**Step 5: Commit**

```bash
git add packages/protocols/ packages/discovery/ packages/cli/
git commit -m "chore: scaffold remaining packages"
```

---

## Phase 1: `@mindwallet/core` — Types

### Task 4: Wallet types

**Files:**
- Create: `packages/core/src/types/wallet.ts`
- Create: `packages/core/src/types/wallet.test.ts`

**Step 1: Write failing test**

```typescript
// packages/core/src/types/wallet.test.ts
import { describe, it, expect } from 'vitest';
import type { WalletAdapter, WalletAccount, SignRequest, MessageRequest } from './wallet.js';

describe('WalletAdapter', () => {
  it('is satisfied by a mock object with the required methods', () => {
    const account: WalletAccount = {
      chainId: 'eip155:8453',
      address: '0xabc',
    };

    const adapter: WalletAdapter = {
      sign: async (_req: SignRequest) => '0xsig',
      signMessage: async (_req: MessageRequest) => '0xmessagesig',
      getAccount: async (_walletId: string, _chainId: string) => account,
      canSign: async (_chainId: string) => true,
    };

    expect(adapter).toBeDefined();
    expect(account.chainId).toBe('eip155:8453');
  });
});
```

**Step 2: Run test — expect compile error (types don't exist yet)**

```bash
cd packages/core && pnpm test
```
Expected: FAIL — cannot find module './wallet.js'

**Step 3: Implement wallet types**

```typescript
// packages/core/src/types/wallet.ts
// ABOUTME: WalletAdapter interface and related types for signing operations
// ABOUTME: OWS-compatible; any signer that implements this interface is usable

export interface WalletAccount {
  chainId: string;   // CAIP-2: e.g. "eip155:8453", "solana:5eykt4..."
  address: string;   // CAIP-10 address
}

export interface SignRequest {
  walletId: string;
  chainId: string;
  transaction: unknown;  // chain-specific transaction object
}

export interface MessageRequest {
  walletId: string;
  chainId: string;
  message: string;
  encoding?: 'utf8' | 'hex';
  accountIndex?: number;
}

export interface WalletAdapter {
  sign(request: SignRequest): Promise<string>;
  signMessage(request: MessageRequest): Promise<string>;
  getAccount(walletId: string, chainId: string): Promise<WalletAccount>;
  canSign(chainId: string): Promise<boolean>;
}
```

**Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/types/wallet.ts packages/core/src/types/wallet.test.ts
git commit -m "feat(core): add WalletAdapter interface"
```

---

### Task 5: Payment challenge and candidate types

**Files:**
- Create: `packages/core/src/types/challenge.ts`
- Create: `packages/core/src/types/challenge.test.ts`

**Step 1: Write failing test**

```typescript
// packages/core/src/types/challenge.test.ts
import { describe, it, expect } from 'vitest';
import type { PaymentCandidate, NormalizedPayment, Protocol } from './challenge.js';

describe('PaymentCandidate', () => {
  it('accepts all three protocol values', () => {
    const protocols: Protocol[] = ['x402', 'mpp', 'siwx'];
    expect(protocols).toHaveLength(3);
  });

  it('normalized payment has required fields', () => {
    const norm: NormalizedPayment = {
      realm: 'https://api.example.com',
      protocol: 'mpp',
      method: 'tempo',
      intent: 'charge',
      hasDigestBinding: false,
    };
    expect(norm.realm).toBe('https://api.example.com');
    expect(norm.protocol).toBe('mpp');
  });

  it('siwx candidate has zero cost (undefined amount)', () => {
    const norm: NormalizedPayment = {
      realm: 'https://api.example.com',
      protocol: 'siwx',
      method: 'siwx',
      intent: 'identity',
      hasDigestBinding: false,
    };
    expect(norm.amount).toBeUndefined();
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test
```

**Step 3: Implement types**

```typescript
// packages/core/src/types/challenge.ts
// ABOUTME: Unified payment candidate types covering x402, MPP, and SIWX protocols
// ABOUTME: All protocols normalize into PaymentCandidate before entering the selection pipeline

import type { RouterMethod } from './method.js';

export type Protocol = 'x402' | 'mpp' | 'siwx';

export interface NormalizedPayment {
  realm: string;
  protocol: Protocol;
  method: string;
  intent: string;
  amount?: bigint;
  currency?: string;
  recipient?: string;
  expiresAt?: number;
  hasDigestBinding: boolean;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

export interface PaymentCandidate {
  id: string;
  protocol: Protocol;
  method: RouterMethod;
  normalized: NormalizedPayment;
  raw: unknown;
  eligible: boolean;
  rejectionReason?: string;
  score?: number;
}
```

Also create the `RouterMethod` stub that `PaymentCandidate` depends on:

```typescript
// packages/core/src/types/method.ts
// ABOUTME: RouterMethod interface implemented by each payment protocol
// ABOUTME: Bridges the selection pipeline to protocol-specific credential creation

import type { PaymentCandidate, NormalizedPayment, Protocol } from './challenge.js';
import type { WalletAdapter } from './wallet.js';

export interface RouterMethod {
  id: string;
  protocol: Protocol;
  canHandle(candidate: PaymentCandidate): boolean;
  normalize(raw: unknown): NormalizedPayment;
  createCredential(args: {
    candidate: PaymentCandidate;
    wallet: WalletAdapter;
  }): Promise<string>;
}
```

**Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test
```

**Step 5: Commit**

```bash
git add packages/core/src/types/
git commit -m "feat(core): add PaymentCandidate and RouterMethod types"
```

---

### Task 6: Selection outcome, policy, and state types

**Files:**
- Create: `packages/core/src/types/selection.ts`
- Create: `packages/core/src/types/policy.ts`
- Create: `packages/core/src/types/state.ts`
- Create: `packages/core/src/types/telemetry.ts`
- Create: `packages/core/src/types/index.ts`

**Step 1: Write failing test**

```typescript
// packages/core/src/types/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  SelectionOutcome, PolicyRule, RouterStateStore, Telemetry, PaymentError
} from './index.js';

describe('SelectionOutcome', () => {
  it('ok variant has a decision', () => {
    const outcome: SelectionOutcome = {
      ok: true,
      decision: {
        challenge: {} as any,
        candidate: {} as any,
        score: 0.8,
        reasons: [],
        considered: [],
      },
    };
    expect(outcome.ok).toBe(true);
  });

  it('error variant has a code', () => {
    const outcome: SelectionOutcome = {
      ok: false,
      error: 'NO_COMPATIBLE_METHOD',
      detail: 'no methods registered',
      considered: [],
    };
    expect(outcome.error).toBe('NO_COMPATIBLE_METHOD');
  });
});

describe('PolicyRule', () => {
  it('prefer-protocol has a boost field', () => {
    const rule: PolicyRule = {
      type: 'prefer-protocol',
      protocol: 'mpp',
      boost: 0.2,
    };
    expect(rule.boost).toBe(0.2);
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test
```

**Step 3: Implement types**

```typescript
// packages/core/src/types/selection.ts
// ABOUTME: Selection outcome, decision, and error types for the payment pipeline
// ABOUTME: SelectionDecision carries a full audit trail of all considered candidates

import type { PaymentCandidate } from './challenge.js';
import type { RouterMethod } from './method.js';

export interface SelectionDecision {
  challenge: unknown;        // raw challenge (protocol-specific)
  candidate: PaymentCandidate;
  score: number;
  reasons: Array<{ code: string; detail: string }>;
  considered: PaymentCandidate[];
}

export type PaymentErrorCode =
  | 'NO_COMPATIBLE_METHOD'
  | 'ALL_EXPIRED'
  | 'POLICY_DENIED'
  | 'WALLET_ERROR'
  | 'CREDENTIAL_ERROR'
  | 'INVALID_CHALLENGES';

export interface PaymentError {
  code: PaymentErrorCode;
  detail: string;
  considered: PaymentCandidate[];
}

export type SelectionOutcome =
  | { ok: true; decision: SelectionDecision }
  | { ok: false; error: PaymentErrorCode; detail: string; considered: PaymentCandidate[] };
```

```typescript
// packages/core/src/types/policy.ts
// ABOUTME: Policy rule union type for the payment selection policy engine
// ABOUTME: prefer-protocol adds a score boost; deny rules hard-filter candidates

import type { Protocol } from './challenge.js';

export type PolicyRule =
  | { type: 'budget'; currency: string; maxAmount: bigint; window: 'daily' | 'weekly' | 'monthly' }
  | { type: 'allow-realm'; realms: string[] }
  | { type: 'deny-realm'; realms: string[] }
  | { type: 'allow-protocol'; protocols: Protocol[] }
  | { type: 'deny-protocol'; protocols: Protocol[] }
  | { type: 'prefer-protocol'; protocol: Protocol; boost: number }
  | { type: 'max-amount'; currency: string; amount: bigint }
  | { type: 'require-digest-binding' }
  | { type: 'delegate'; provider: ApprovalProvider };

export interface PolicyResult {
  allow: boolean;
  reason?: string;
  scoreBoost?: number;
}

export interface PolicyEngine {
  evaluate(candidate: import('./challenge.js').PaymentCandidate): Promise<PolicyResult>;
}

export interface ApprovalProvider {
  approve(candidate: import('./challenge.js').PaymentCandidate): Promise<boolean>;
}
```

```typescript
// packages/core/src/types/state.ts
// ABOUTME: State store interface for session channels, outcomes, and SIWX entitlements
// ABOUTME: Outcome history feeds the scorer; entitlement cache enables pay-once-reuse

import type { Protocol } from './challenge.js';

export interface SessionChannelState {
  realm: string;
  channelId: string;
  method: string;
  deposit?: bigint;
  acceptedCumulative?: bigint;
  spent?: bigint;
  updatedAt: number;
  scopeKey: string;
}

export interface OutcomeRecord {
  realm: string;
  method: string;
  protocol: Protocol;
  intent: string;
  ok: boolean;
  durationMs?: number;
  amount?: bigint;
  currency?: string;
  at: number;
}

export interface EntitlementRecord {
  realm: string;
  token: string;
  expiresAt: number;
  walletAddress: string;
}

export interface OutcomeFilter {
  realm?: string;
  method?: string;
  protocol?: Protocol;
  intent?: string;
  currency?: string;
  since: number;
}

export interface RouterStateStore {
  getSessionChannel(scopeKey: string): Promise<SessionChannelState | undefined>;
  putSessionChannel(state: SessionChannelState): Promise<void>;
  deleteSessionChannel(scopeKey: string): Promise<void>;
  recordOutcome(event: OutcomeRecord): Promise<void>;
  getOutcomes(filter: OutcomeFilter): Promise<OutcomeRecord[]>;
  getEntitlement(realm: string): Promise<EntitlementRecord | undefined>;
  putEntitlement(record: EntitlementRecord): Promise<void>;
  deleteEntitlement(realm: string): Promise<void>;
}
```

```typescript
// packages/core/src/types/telemetry.ts
// ABOUTME: Telemetry hook interface for fire-and-forget observability
// ABOUTME: Credential material must never appear in these hooks

import type { Protocol } from './challenge.js';
import type { SelectionDecision } from './selection.js';

export interface RouterContext {
  transport: 'http' | 'mcp' | (string & {});
  realm?: string;
  url?: string;
  operationId?: string;
  jsonRpcMethod?: string;
  now?: Date;
}

export interface CandidateSummary {
  id: string;
  protocol: Protocol;
  method: string;
  intent: string;
}

export interface PaymentReceipt {
  status: 'success';
  method: string;
  timestamp: string;
  reference: string;
  externalId?: string;
  challengeId?: string;
}

export interface Telemetry {
  onChallengeSeen?(args: {
    transport: string;
    realm: string;
    candidates: CandidateSummary[];
    ctx: RouterContext;
  }): void;
  onDecision?(decision: SelectionDecision, ctx: RouterContext): void;
  onAttempt?(args: {
    candidateId: string;
    protocol: Protocol;
    method: string;
    phase: 'createCredential' | 'sendPaidRequest';
    ctx: RouterContext;
  }): void;
  onReceipt?(args: {
    receipt: PaymentReceipt;
    transport: string;
    realm?: string;
    ctx: RouterContext;
  }): void;
  onEntitlementCached?(args: {
    realm: string;
    expiresAt: number;
    ctx: RouterContext;
  }): void;
  onError?(args: {
    code: string;
    message: string;
    transport: string;
    ctx: RouterContext;
  }): void;
  onAlert?(args: {
    severity: 'info' | 'warn' | 'error';
    code: string;
    message: string;
    ctx: RouterContext;
  }): void;
}
```

```typescript
// packages/core/src/types/index.ts
// ABOUTME: Re-exports all types from @mindwallet/core
// ABOUTME: Consumers import from '@mindwallet/core' not from sub-paths

export type { WalletAdapter, WalletAccount, SignRequest, MessageRequest } from './wallet.js';
export type { Protocol, NormalizedPayment, PaymentCandidate } from './challenge.js';
export type { RouterMethod } from './method.js';
export type {
  SelectionDecision, SelectionOutcome, PaymentError, PaymentErrorCode
} from './selection.js';
export type { PolicyRule, PolicyResult, PolicyEngine, ApprovalProvider } from './policy.js';
export type {
  SessionChannelState, OutcomeRecord, EntitlementRecord, OutcomeFilter, RouterStateStore
} from './state.js';
export type {
  RouterContext, CandidateSummary, PaymentReceipt, Telemetry
} from './telemetry.js';
```

**Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test
```

**Step 5: Update packages/core/src/index.ts to re-export types**

```typescript
// ABOUTME: Public API surface for @mindwallet/core
// ABOUTME: Re-exports all types, interfaces, and factory functions

export type * from './types/index.js';
```

**Step 6: Commit**

```bash
git add packages/core/src/
git commit -m "feat(core): add all core type definitions"
```

---

## Phase 2: `@mindwallet/core` — OWS Wallet Adapter

### Task 7: OWS WalletAdapter implementation

> **TDD note:** `canSign` is pure logic (a Set lookup) — unit-testable without OWS. `signMessage`
> and `getAccount` call OWS native bindings — tested against a real vault in Task 7b.
> **Never mock `@open-wallet-standard/core`.** Mocking native bindings tests call signatures,
> not integration correctness. The agentcash codebase learned this the hard way.

**Files:**
- Create: `packages/core/src/wallet/ows.ts`
- Create: `packages/core/src/wallet/ows.test.ts`

**Step 1: Install OWS dependency**

```bash
cd packages/core && pnpm add @open-wallet-standard/core
```

**Step 2: Write failing unit test (pure logic only — no OWS calls)**

```typescript
// packages/core/src/wallet/ows.test.ts
import { describe, it, expect } from 'vitest';
import { OwsWalletAdapter } from './ows.js';

// Unit tests cover only pure logic that does not call OWS.
// Real OWS vault integration tests live in ows.integration.test.ts (Task 7b).

describe('OwsWalletAdapter — canSign', () => {
  const adapter = new OwsWalletAdapter({
    walletId: 'test-wallet',
    vaultPath: '/tmp/does-not-matter-for-this-test',
    // agentToken omitted intentionally — not needed for canSign
  });

  it('returns true for Base (eip155:8453)', async () => {
    expect(await adapter.canSign('eip155:8453')).toBe(true);
  });

  it('returns true for Tempo (eip155:65536)', async () => {
    expect(await adapter.canSign('eip155:65536')).toBe(true);
  });

  it('returns true for Solana mainnet', async () => {
    expect(await adapter.canSign('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBe(true);
  });

  it('returns false for Ethereum mainnet (not in allowed set)', async () => {
    expect(await adapter.canSign('eip155:1')).toBe(false);
  });

  it('returns false for an unknown chain', async () => {
    expect(await adapter.canSign('cosmos:cosmoshub-4')).toBe(false);
  });
});

describe('OwsWalletAdapter — implements WalletAdapter interface', () => {
  it('has all required methods', () => {
    const adapter = new OwsWalletAdapter({ walletId: 'w', vaultPath: '/tmp/v' });
    expect(typeof adapter.sign).toBe('function');
    expect(typeof adapter.signMessage).toBe('function');
    expect(typeof adapter.getAccount).toBe('function');
    expect(typeof adapter.canSign).toBe('function');
  });
});
```

**Step 3: Run test — expect FAIL (module not found)**

```bash
cd packages/core && pnpm test src/wallet/ows.test.ts
```
Expected: FAIL — cannot find module './ows.js'

**Step 4: Implement OwsWalletAdapter**

Note: `agentToken` is optional — when omitted, OWS falls back to `OWS_PASSPHRASE` env var.
This lets integration tests (Task 7b) run without a pre-created agent token.

```typescript
// packages/core/src/wallet/ows.ts
// ABOUTME: WalletAdapter implementation backed by Open Wallet Standard Node.js bindings
// ABOUTME: agentToken is optional; omit it to use OWS_PASSPHRASE env var (e.g. in tests)

import {
  signMessage,
  signTransaction,
  getWallet,
} from '@open-wallet-standard/core';
import type {
  WalletAdapter, WalletAccount, SignRequest, MessageRequest
} from '../types/wallet.js';

// Chains this adapter is permitted to sign for.
// In production these must match the allowed_chains on the OWS agent token policy.
const SUPPORTED_CHAINS = new Set([
  'eip155:8453',          // Base
  'eip155:65536',         // Tempo
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana mainnet
]);

export interface OwsAdapterConfig {
  walletId: string;
  vaultPath: string;    // e.g. ~/.minds/wallet/vault
  agentToken?: string;  // ows_key_* scoped token; if omitted, OWS uses OWS_PASSPHRASE env var
}

export class OwsWalletAdapter implements WalletAdapter {
  constructor(private readonly config: OwsAdapterConfig) {}

  async sign(request: SignRequest): Promise<string> {
    const result = signTransaction(
      request.walletId,
      request.chainId,
      request.transaction,
      this.config.agentToken,
      0,
      this.config.vaultPath,
    );
    return (result as { signedTx: string }).signedTx;
  }

  async signMessage(request: MessageRequest): Promise<string> {
    const result = signMessage(
      request.walletId,
      request.chainId,
      request.message,
      this.config.agentToken,
      request.encoding ?? 'utf8',
      request.accountIndex ?? 0,
      this.config.vaultPath,
    );
    return (result as { signature: string }).signature;
  }

  async getAccount(walletId: string, chainId: string): Promise<WalletAccount> {
    const wallet = getWallet(walletId, this.config.agentToken, this.config.vaultPath);
    const accounts = (wallet as { accounts: Array<{ chain_id: string; address: string }> }).accounts;
    const account = accounts.find(a => a.chain_id === chainId);
    if (!account) {
      throw new Error(`No account for chain ${chainId} in wallet ${walletId}`);
    }
    return { chainId: account.chain_id, address: account.address };
  }

  async canSign(chainId: string): Promise<boolean> {
    return SUPPORTED_CHAINS.has(chainId);
  }
}
```

**Step 5: Run unit test — expect PASS**

```bash
cd packages/core && pnpm test src/wallet/ows.test.ts
```
Expected: PASS (5 tests, no OWS vault needed)

**Step 6: Export from index.ts**

Add to `packages/core/src/index.ts`:
```typescript
export { OwsWalletAdapter } from './wallet/ows.js';
export type { OwsAdapterConfig } from './wallet/ows.js';
```

**Step 7: Commit**

```bash
git add packages/core/src/wallet/ows.ts packages/core/src/wallet/ows.test.ts packages/core/src/index.ts
git commit -m "feat(core): add OWS wallet adapter"
```

---

### Task 7b: OWS local vault integration test

> This task tests `OwsWalletAdapter` against a **real local OWS vault** in a temp directory.
> It exercises the actual Rust native bindings — not mocks.
>
> **Prerequisite:** OWS installed (`pnpm add @open-wallet-standard/core` done in Task 7).
> **Guard:** Tests are skipped when `OWS_PASSPHRASE` env var is not set, so CI passes
> without a pre-configured vault. Set `OWS_PASSPHRASE=test-passphrase mindwallet` locally
> to run the full suite.

**Files:**
- Create: `packages/core/src/wallet/ows.integration.test.ts`

**Step 1: Write integration test**

```typescript
// packages/core/src/wallet/ows.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWallet, listWallets } from '@open-wallet-standard/core';
import { OwsWalletAdapter } from './ows.js';

// Skip entire suite when OWS_PASSPHRASE is not set.
// Run locally with: OWS_PASSPHRASE=test-passphrase pnpm test src/wallet/ows.integration.test.ts
const skip = !process.env.OWS_PASSPHRASE;

describe.skipIf(skip)('OwsWalletAdapter — local vault integration', () => {
  let vaultPath: string;

  beforeAll(() => {
    // Create an isolated temp vault for this test run
    vaultPath = mkdtempSync(join(tmpdir(), 'mindwallet-ows-test-'));
    // Create a test wallet using the real OWS Node SDK
    createWallet('test-wallet', undefined, 12, vaultPath);
  });

  afterAll(() => {
    // Clean up temp vault — contains no real funds
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('wallet is visible in listWallets after creation', () => {
    const wallets = listWallets(vaultPath);
    const found = (wallets as Array<{ name: string }>).find(w => w.name === 'test-wallet');
    expect(found).toBeDefined();
  });

  it('signMessage returns a valid EVM signature (0x + 130 hex chars)', async () => {
    const adapter = new OwsWalletAdapter({
      walletId: 'test-wallet',
      vaultPath,
      // No agentToken — uses OWS_PASSPHRASE env var
    });

    const sig = await adapter.signMessage({
      walletId: 'test-wallet',
      chainId: 'eip155:8453',
      message: 'hello from mindwallet integration test',
    });

    // EVM personal_sign produces a 65-byte signature: 0x + 130 hex chars
    expect(sig).toMatch(/^0x[0-9a-fA-F]{130}$/);
  });

  it('getAccount returns a checksummed EVM address for Base', async () => {
    const adapter = new OwsWalletAdapter({
      walletId: 'test-wallet',
      vaultPath,
    });

    const account = await adapter.getAccount('test-wallet', 'eip155:8453');
    expect(account.chainId).toBe('eip155:8453');
    // EVM address: 0x + 40 hex chars
    expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('signing with the same wallet twice produces a deterministic signature', async () => {
    const adapter = new OwsWalletAdapter({ walletId: 'test-wallet', vaultPath });
    const msg = 'determinism check';

    const sig1 = await adapter.signMessage({ walletId: 'test-wallet', chainId: 'eip155:8453', message: msg });
    const sig2 = await adapter.signMessage({ walletId: 'test-wallet', chainId: 'eip155:8453', message: msg });

    // EVM ECDSA signing is deterministic for the same key + message
    expect(sig1).toBe(sig2);
  });

  it('throws when wallet does not exist in vault', async () => {
    const adapter = new OwsWalletAdapter({ walletId: 'nonexistent-wallet', vaultPath });

    await expect(
      adapter.getAccount('nonexistent-wallet', 'eip155:8453')
    ).rejects.toThrow();
  });

  it('canSign is independent of vault — returns true for supported chains regardless', async () => {
    const adapter = new OwsWalletAdapter({ walletId: 'test-wallet', vaultPath });
    // canSign does not call OWS — verified here for completeness alongside real adapter
    expect(await adapter.canSign('eip155:8453')).toBe(true);
    expect(await adapter.canSign('eip155:1')).toBe(false);
  });
});
```

**Step 2: Run test without env var set — expect SKIP**

```bash
cd packages/core && pnpm test src/wallet/ows.integration.test.ts
```
Expected: 0 tests run, suite skipped (no `OWS_PASSPHRASE`)

**Step 3: Run test with env var set — expect PASS**

```bash
cd packages/core && OWS_PASSPHRASE=test-passphrase pnpm test src/wallet/ows.integration.test.ts
```
Expected: PASS (6 tests, real vault operations)

**Step 4: Commit**

```bash
git add packages/core/src/wallet/ows.integration.test.ts
git commit -m "test(core): add OWS local vault integration tests"
```

---

## Phase 3: `@mindwallet/core` — Selection Pipeline

### Task 8: In-memory state store

**Files:**
- Create: `packages/core/src/state/memory.ts`
- Create: `packages/core/src/state/memory.test.ts`

**Step 1: Write failing test**

```typescript
// packages/core/src/state/memory.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryStore } from './memory.js';
import type { RouterStateStore } from '../types/state.js';

describe('createMemoryStore', () => {
  let store: RouterStateStore;

  beforeEach(() => {
    store = createMemoryStore();
  });

  it('returns undefined for missing session channel', async () => {
    const result = await store.getSessionChannel('missing-key');
    expect(result).toBeUndefined();
  });

  it('stores and retrieves a session channel', async () => {
    await store.putSessionChannel({
      realm: 'https://api.example.com',
      channelId: 'ch-1',
      method: 'tempo',
      updatedAt: Date.now(),
      scopeKey: 'https://api.example.com:tempo',
    });
    const result = await store.getSessionChannel('https://api.example.com:tempo');
    expect(result?.channelId).toBe('ch-1');
  });

  it('records and retrieves outcomes', async () => {
    const now = Date.now();
    await store.recordOutcome({
      realm: 'https://api.example.com',
      method: 'tempo',
      protocol: 'mpp',
      intent: 'charge',
      ok: true,
      durationMs: 120,
      at: now,
    });
    const outcomes = await store.getOutcomes({
      realm: 'https://api.example.com',
      since: now - 1000,
    });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.durationMs).toBe(120);
  });

  it('stores and retrieves entitlements', async () => {
    await store.putEntitlement({
      realm: 'https://api.example.com',
      token: 'bearer-token-123',
      expiresAt: Date.now() + 3600_000,
      walletAddress: '0xabc',
    });
    const ent = await store.getEntitlement('https://api.example.com');
    expect(ent?.token).toBe('bearer-token-123');
  });

  it('deletes entitlement', async () => {
    await store.putEntitlement({
      realm: 'https://api.example.com',
      token: 'tok',
      expiresAt: Date.now() + 3600_000,
      walletAddress: '0x1',
    });
    await store.deleteEntitlement('https://api.example.com');
    expect(await store.getEntitlement('https://api.example.com')).toBeUndefined();
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test src/state/memory.test.ts
```

**Step 3: Implement memory store**

```typescript
// packages/core/src/state/memory.ts
// ABOUTME: In-memory RouterStateStore implementation for development and testing
// ABOUTME: All state is lost on process exit; use a persistent store for production

import type {
  RouterStateStore, SessionChannelState, OutcomeRecord, EntitlementRecord, OutcomeFilter
} from '../types/state.js';

export function createMemoryStore(): RouterStateStore {
  const channels = new Map<string, SessionChannelState>();
  const outcomes: OutcomeRecord[] = [];
  const entitlements = new Map<string, EntitlementRecord>();

  return {
    async getSessionChannel(scopeKey) {
      return channels.get(scopeKey);
    },
    async putSessionChannel(state) {
      channels.set(state.scopeKey, state);
    },
    async deleteSessionChannel(scopeKey) {
      channels.delete(scopeKey);
    },
    async recordOutcome(event) {
      outcomes.push(event);
    },
    async getOutcomes(filter: OutcomeFilter) {
      return outcomes.filter(o => {
        if (o.at < filter.since) return false;
        if (filter.realm && o.realm !== filter.realm) return false;
        if (filter.method && o.method !== filter.method) return false;
        if (filter.protocol && o.protocol !== filter.protocol) return false;
        if (filter.intent && o.intent !== filter.intent) return false;
        if (filter.currency && o.currency !== filter.currency) return false;
        return true;
      });
    },
    async getEntitlement(realm) {
      return entitlements.get(realm);
    },
    async putEntitlement(record) {
      entitlements.set(record.realm, record);
    },
    async deleteEntitlement(realm) {
      entitlements.delete(realm);
    },
  };
}
```

**Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test src/state/memory.test.ts
```

**Step 5: Commit**

```bash
git add packages/core/src/state/
git commit -m "feat(core): add in-memory state store"
```

---

### Task 9: Policy engine

**Files:**
- Create: `packages/core/src/policy/evaluator.ts`
- Create: `packages/core/src/policy/evaluator.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/core/src/policy/evaluator.test.ts
import { describe, it, expect } from 'vitest';
import { createPolicyEngine } from './evaluator.js';
import { createMemoryStore } from '../state/memory.js';
import type { PaymentCandidate } from '../types/challenge.js';

function makeCandidate(overrides: Partial<PaymentCandidate['normalized']> = {}): PaymentCandidate {
  return {
    id: 'test-id',
    protocol: 'mpp',
    method: {} as any,
    normalized: {
      realm: 'https://api.example.com',
      protocol: 'mpp',
      method: 'tempo',
      intent: 'charge',
      amount: 1_000_000n,
      currency: 'USDC',
      hasDigestBinding: false,
      ...overrides,
    },
    raw: {},
    eligible: true,
  };
}

describe('createPolicyEngine', () => {
  it('allows when no rules', async () => {
    const engine = createPolicyEngine([]);
    const result = await engine.evaluate(makeCandidate());
    expect(result.allow).toBe(true);
  });

  it('deny-realm blocks matching realm', async () => {
    const engine = createPolicyEngine([
      { type: 'deny-realm', realms: ['https://api.example.com'] },
    ]);
    const result = await engine.evaluate(makeCandidate());
    expect(result.allow).toBe(false);
    expect(result.reason).toMatch(/realm/i);
  });

  it('deny-protocol blocks matching protocol', async () => {
    const engine = createPolicyEngine([
      { type: 'deny-protocol', protocols: ['mpp'] },
    ]);
    const result = await engine.evaluate(makeCandidate({ protocol: 'mpp' }));
    expect(result.allow).toBe(false);
  });

  it('allow-protocol permits only listed protocols', async () => {
    const engine = createPolicyEngine([
      { type: 'allow-protocol', protocols: ['x402'] },
    ]);
    const mppResult = await engine.evaluate(makeCandidate({ protocol: 'mpp' }));
    expect(mppResult.allow).toBe(false);
  });

  it('max-amount blocks candidates exceeding limit', async () => {
    const engine = createPolicyEngine([
      { type: 'max-amount', currency: 'USDC', amount: 500_000n },
    ]);
    const result = await engine.evaluate(makeCandidate({ amount: 1_000_000n, currency: 'USDC' }));
    expect(result.allow).toBe(false);
  });

  it('prefer-protocol adds score boost to matching protocol', async () => {
    const engine = createPolicyEngine([
      { type: 'prefer-protocol', protocol: 'mpp', boost: 0.2 },
    ]);
    const result = await engine.evaluate(makeCandidate({ protocol: 'mpp' }));
    expect(result.allow).toBe(true);
    expect(result.scoreBoost).toBe(0.2);
  });

  it('prefer-protocol does not boost non-matching protocol', async () => {
    const engine = createPolicyEngine([
      { type: 'prefer-protocol', protocol: 'x402', boost: 0.2 },
    ]);
    const result = await engine.evaluate(makeCandidate({ protocol: 'mpp' }));
    expect(result.allow).toBe(true);
    expect(result.scoreBoost ?? 0).toBe(0);
  });

  it('first deny rule short-circuits', async () => {
    const engine = createPolicyEngine([
      { type: 'deny-realm', realms: ['https://api.example.com'] },
      { type: 'allow-protocol', protocols: ['mpp'] },
    ]);
    const result = await engine.evaluate(makeCandidate());
    expect(result.allow).toBe(false);
    expect(result.reason).toMatch(/realm/i);
  });

  describe('budget rule', () => {
    it('allows when no prior spend', async () => {
      const state = createMemoryStore();
      const engine = createPolicyEngine(
        [{ type: 'budget', currency: 'USDC', amount: 1_000_000n, window: 'daily' }],
        state,
      );
      const result = await engine.evaluate(makeCandidate({ amount: 100_000n, currency: 'USDC' }));
      expect(result.allow).toBe(true);
    });

    it('allows when cumulative spend is under limit', async () => {
      const state = createMemoryStore();
      await state.recordOutcome({
        realm: 'https://api.example.com', method: 'GET /', protocol: 'mpp',
        intent: 'charge', currency: 'USDC', amount: 400_000n, at: Date.now(),
      });
      const engine = createPolicyEngine(
        [{ type: 'budget', currency: 'USDC', amount: 1_000_000n, window: 'daily' }],
        state,
      );
      const result = await engine.evaluate(makeCandidate({ amount: 400_000n, currency: 'USDC' }));
      expect(result.allow).toBe(true);
    });

    it('blocks when cumulative spend would exceed limit', async () => {
      const state = createMemoryStore();
      await state.recordOutcome({
        realm: 'https://api.example.com', method: 'GET /', protocol: 'mpp',
        intent: 'charge', currency: 'USDC', amount: 800_000n, at: Date.now(),
      });
      const engine = createPolicyEngine(
        [{ type: 'budget', currency: 'USDC', amount: 1_000_000n, window: 'daily' }],
        state,
      );
      const result = await engine.evaluate(makeCandidate({ amount: 300_000n, currency: 'USDC' }));
      expect(result.allow).toBe(false);
      expect(result.reason).toMatch(/budget/i);
    });

    it('does not count outcomes older than the window', async () => {
      const state = createMemoryStore();
      const yesterday = Date.now() - 25 * 60 * 60 * 1000; // 25h ago
      await state.recordOutcome({
        realm: 'https://api.example.com', method: 'GET /', protocol: 'mpp',
        intent: 'charge', currency: 'USDC', amount: 900_000n, at: yesterday,
      });
      const engine = createPolicyEngine(
        [{ type: 'budget', currency: 'USDC', amount: 1_000_000n, window: 'daily' }],
        state,
      );
      const result = await engine.evaluate(makeCandidate({ amount: 500_000n, currency: 'USDC' }));
      expect(result.allow).toBe(true);
    });

    it('respects weekly window', async () => {
      const state = createMemoryStore();
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      await state.recordOutcome({
        realm: 'https://api.example.com', method: 'GET /', protocol: 'mpp',
        intent: 'charge', currency: 'USDC', amount: 800_000n, at: threeDaysAgo,
      });
      const engine = createPolicyEngine(
        [{ type: 'budget', currency: 'USDC', amount: 1_000_000n, window: 'weekly' }],
        state,
      );
      const result = await engine.evaluate(makeCandidate({ amount: 300_000n, currency: 'USDC' }));
      expect(result.allow).toBe(false);
      expect(result.reason).toMatch(/budget/i);
    });
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test src/policy/evaluator.test.ts
```

**Step 3: Implement policy engine**

```typescript
// packages/core/src/policy/evaluator.ts
// ABOUTME: Policy engine that evaluates PaymentCandidates against a set of rules
// ABOUTME: First deny rule short-circuits; prefer-protocol adds a score boost without denying

import type { PolicyRule, PolicyResult, PolicyEngine } from '../types/policy.js';
import type { PaymentCandidate } from '../types/challenge.js';
import type { RouterStateStore } from '../types/state.js';

const WINDOW_MS: Record<'daily' | 'weekly' | 'monthly', number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export function createPolicyEngine(rules: PolicyRule[], state?: RouterStateStore): PolicyEngine {
  return {
    async evaluate(candidate: PaymentCandidate): Promise<PolicyResult> {
      let scoreBoost = 0;

      for (const rule of rules) {
        switch (rule.type) {
          case 'deny-realm':
            if (rule.realms.includes(candidate.normalized.realm)) {
              return { allow: false, reason: `realm ${candidate.normalized.realm} is denied` };
            }
            break;

          case 'allow-realm':
            if (!rule.realms.includes(candidate.normalized.realm)) {
              return { allow: false, reason: `realm ${candidate.normalized.realm} not in allow list` };
            }
            break;

          case 'deny-protocol':
            if (rule.protocols.includes(candidate.normalized.protocol)) {
              return { allow: false, reason: `protocol ${candidate.normalized.protocol} is denied` };
            }
            break;

          case 'allow-protocol':
            if (!rule.protocols.includes(candidate.normalized.protocol)) {
              return { allow: false, reason: `protocol ${candidate.normalized.protocol} not in allow list` };
            }
            break;

          case 'max-amount':
            if (
              candidate.normalized.currency === rule.currency &&
              candidate.normalized.amount !== undefined &&
              candidate.normalized.amount > rule.amount
            ) {
              return {
                allow: false,
                reason: `amount ${candidate.normalized.amount} exceeds max ${rule.amount} ${rule.currency}`,
              };
            }
            break;

          case 'prefer-protocol':
            if (candidate.normalized.protocol === rule.protocol) {
              scoreBoost += rule.boost;
            }
            break;

          case 'require-digest-binding':
            if (!candidate.normalized.hasDigestBinding) {
              return { allow: false, reason: 'digest binding required but not present' };
            }
            break;

          case 'budget': {
            if (state && candidate.normalized.currency === rule.currency && candidate.normalized.amount !== undefined) {
              const windowMs = WINDOW_MS[rule.window];
              const since = Date.now() - windowMs;
              const past = await state.getOutcomes({ since, currency: rule.currency });
              const spent = past.reduce((sum, o) => sum + (o.amount ?? 0n), 0n);
              if (spent + candidate.normalized.amount > rule.amount) {
                return {
                  allow: false,
                  reason: `budget limit ${rule.amount} ${rule.currency} (${rule.window}) would be exceeded`,
                };
              }
            }
            break;
          }

          case 'delegate':
            const approved = await rule.provider.approve(candidate);
            if (!approved) {
              return { allow: false, reason: 'delegate approval denied' };
            }
            break;
        }
      }

      return { allow: true, scoreBoost: scoreBoost > 0 ? scoreBoost : undefined };
    },
  };
}
```

**Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test src/policy/evaluator.test.ts
```

**Step 5: Commit**

```bash
git add packages/core/src/policy/
git commit -m "feat(core): add policy engine"
```

---

### Task 10: Scorer

**Files:**
- Create: `packages/core/src/pipeline/scorer.ts`
- Create: `packages/core/src/pipeline/scorer.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/core/src/pipeline/scorer.test.ts
import { describe, it, expect } from 'vitest';
import { scoreCandidates, DEFAULT_WEIGHTS } from './scorer.js';
import { createMemoryStore } from '../state/memory.js';
import type { PaymentCandidate } from '../types/challenge.js';

function makeCandidate(id: string, overrides: Partial<PaymentCandidate['normalized']> = {}): PaymentCandidate {
  return {
    id,
    protocol: 'mpp',
    method: {} as any,
    normalized: {
      realm: 'https://api.example.com',
      protocol: 'mpp',
      method: 'tempo',
      intent: 'charge',
      amount: 1_000_000n,
      currency: 'USDC',
      hasDigestBinding: false,
      ...overrides,
    },
    raw: {},
    eligible: true,
  };
}

describe('scoreCandidates', () => {
  it('assigns scores to eligible candidates', async () => {
    const state = createMemoryStore();
    const candidates = [makeCandidate('a'), makeCandidate('b', { amount: 500_000n })];
    await scoreCandidates(candidates, DEFAULT_WEIGHTS, state, { transport: 'http' });
    expect(candidates[0]?.score).toBeDefined();
    expect(candidates[1]?.score).toBeDefined();
  });

  it('cheaper candidate scores higher when amounts differ', async () => {
    const state = createMemoryStore();
    const expensive = makeCandidate('expensive', { amount: 1_000_000n });
    const cheap = makeCandidate('cheap', { amount: 100_000n });
    await scoreCandidates([expensive, cheap], DEFAULT_WEIGHTS, state, { transport: 'http' });
    expect(cheap.score!).toBeGreaterThan(expensive.score!);
  });

  it('ineligible candidates are skipped', async () => {
    const state = createMemoryStore();
    const ineligible = { ...makeCandidate('skip'), eligible: false, score: undefined };
    await scoreCandidates([ineligible], DEFAULT_WEIGHTS, state, { transport: 'http' });
    expect(ineligible.score).toBeUndefined();
  });

  it('warm session channel boosts score', async () => {
    const state = createMemoryStore();
    const cold = makeCandidate('cold', { intent: 'session' });
    const warm = makeCandidate('warm', { intent: 'session' });
    await state.putSessionChannel({
      realm: 'https://api.example.com',
      channelId: 'ch-1',
      method: 'tempo',
      updatedAt: Date.now(),
      scopeKey: 'https://api.example.com:tempo',
    });
    await scoreCandidates([cold, warm], DEFAULT_WEIGHTS, state, { transport: 'http' });
    // warm candidate's warm_score = 1.0 vs cold = 0.0
    expect(warm.score!).toBeGreaterThan(cold.score!);
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test src/pipeline/scorer.test.ts
```

**Step 3: Implement scorer** (same logic as mpp-router's scorer, extended for protocol awareness and SIWX)

```typescript
// packages/core/src/pipeline/scorer.ts
// ABOUTME: Scores eligible PaymentCandidates across cost, latency, success, and warmth dimensions
// ABOUTME: Protocol preference boosts from the policy engine are applied after scoring

import type { PaymentCandidate } from '../types/challenge.js';
import type { RouterStateStore } from '../types/state.js';
import type { RouterContext } from '../types/telemetry.js';

export interface ScoringWeights {
  cost: number;
  latency: number;
  success: number;
  warm: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  cost: 0.4,
  latency: 0.15,
  success: 0.3,
  warm: 0.15,
};

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;
const NEUTRAL = 0.5;

export async function scoreCandidates(
  candidates: PaymentCandidate[],
  weights: ScoringWeights,
  state: RouterStateStore,
  ctx: RouterContext,
): Promise<void> {
  const eligible = candidates.filter(c => c.eligible);
  if (eligible.length === 0) return;

  const now = (ctx.now ?? new Date()).getTime();

  const costScores = computeCostScores(eligible);
  const latencyScores = await computeLatencyScores(eligible, state, now);
  const successScores = await computeSuccessScores(eligible, state, now);
  const warmScores = await computeWarmScores(eligible, state);

  for (let i = 0; i < eligible.length; i++) {
    eligible[i]!.score =
      weights.cost * costScores[i]! +
      weights.latency * latencyScores[i]! +
      weights.success * successScores[i]! +
      weights.warm * warmScores[i]!;
  }
}

function computeCostScores(eligible: PaymentCandidate[]): number[] {
  // SIWX candidates are always free (no amount) — assign perfect cost score
  const amounts = eligible.map(c =>
    c.normalized.protocol === 'siwx' ? 0 :
    c.normalized.amount !== undefined ? Number(c.normalized.amount) : undefined
  );

  const currencies = new Set(
    eligible
      .filter(c => c.normalized.protocol !== 'siwx')
      .map(c => c.normalized.currency)
      .filter(Boolean)
  );

  if (currencies.size > 1) return eligible.map(() => NEUTRAL);

  const defined = amounts.filter((a): a is number => a !== undefined);
  if (defined.length === 0) return eligible.map(() => NEUTRAL);

  const max = Math.max(...defined);

  return amounts.map(a => {
    if (a === undefined) return NEUTRAL;
    if (max === 0) return 1;
    return 1 - a / max;
  });
}

async function computeLatencyScores(
  eligible: PaymentCandidate[],
  state: RouterStateStore,
  now: number,
): Promise<number[]> {
  const medians: (number | undefined)[] = [];

  for (const c of eligible) {
    try {
      const outcomes = await state.getOutcomes({
        realm: c.normalized.realm,
        method: c.normalized.method,
        since: now - ONE_HOUR_MS,
      });
      const durations = outcomes
        .map(o => o.durationMs)
        .filter((d): d is number => d !== undefined);

      medians.push(durations.length > 0 ? median(durations) : undefined);
    } catch {
      medians.push(undefined);
    }
  }

  const defined = medians.filter((m): m is number => m !== undefined);
  if (defined.length === 0) return eligible.map(() => NEUTRAL);

  const max = Math.max(...defined);
  return medians.map(m => m === undefined ? NEUTRAL : max === 0 ? 1 : 1 - m / max);
}

async function computeSuccessScores(
  eligible: PaymentCandidate[],
  state: RouterStateStore,
  now: number,
): Promise<number[]> {
  const scores: number[] = [];

  for (const c of eligible) {
    try {
      const outcomes = await state.getOutcomes({
        realm: c.normalized.realm,
        method: c.normalized.method,
        since: now - TWENTY_FOUR_HOURS_MS,
      });
      if (outcomes.length === 0) {
        scores.push(NEUTRAL);
      } else {
        scores.push(outcomes.filter(o => o.ok).length / outcomes.length);
      }
    } catch {
      scores.push(NEUTRAL);
    }
  }

  return scores;
}

async function computeWarmScores(
  eligible: PaymentCandidate[],
  state: RouterStateStore,
): Promise<number[]> {
  const scores: number[] = [];

  for (const c of eligible) {
    // SIWX with a valid entitlement is "warm" — effectively free and ready
    if (c.normalized.protocol === 'siwx') {
      const ent = await state.getEntitlement(c.normalized.realm).catch(() => undefined);
      scores.push(ent && ent.expiresAt > Date.now() ? 1.0 : 0.0);
      continue;
    }

    if (c.normalized.intent === 'session') {
      const scopeKey = `${c.normalized.realm}:${c.normalized.method}`;
      const channel = await state.getSessionChannel(scopeKey).catch(() => undefined);
      scores.push(channel ? 1.0 : 0.0);
      continue;
    }

    scores.push(NEUTRAL);
  }

  return scores;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}
```

**Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test src/pipeline/scorer.test.ts
```

**Step 5: Commit**

```bash
git add packages/core/src/pipeline/scorer.ts packages/core/src/pipeline/scorer.test.ts
git commit -m "feat(core): add candidate scorer"
```

---

### Task 11: Selection pipeline (filter + select)

**Files:**
- Create: `packages/core/src/pipeline/filter.ts`
- Create: `packages/core/src/pipeline/select.ts`
- Create: `packages/core/src/pipeline/select.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/core/src/pipeline/select.test.ts
import { describe, it, expect } from 'vitest';
import { createSelector } from './select.js';
import { createMemoryStore } from '../state/memory.js';
import { createPolicyEngine } from '../policy/evaluator.js';
import type { PaymentCandidate } from '../types/challenge.js';

function makeMethod(id: string) {
  return {
    id,
    protocol: 'mpp' as const,
    canHandle: () => true,
    normalize: (raw: unknown) => raw as any,
    createCredential: async () => 'auth-header',
  };
}

function makeCandidate(id: string, amount: bigint): PaymentCandidate {
  return {
    id,
    protocol: 'mpp',
    method: makeMethod('tempo'),
    normalized: {
      realm: 'https://api.example.com',
      protocol: 'mpp',
      method: 'tempo',
      intent: 'charge',
      amount,
      currency: 'USDC',
      hasDigestBinding: false,
    },
    raw: {},
    eligible: true,
  };
}

describe('createSelector', () => {
  it('selects the highest-scoring eligible candidate', async () => {
    const state = createMemoryStore();
    const policy = createPolicyEngine([]);
    const selector = createSelector({ state, policy });

    const candidates = [
      makeCandidate('expensive', 1_000_000n),
      makeCandidate('cheap', 100_000n),
    ];

    const outcome = await selector.select(candidates, { transport: 'http' });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.decision.candidate.id).toBe('cheap');
    }
  });

  it('returns NO_COMPATIBLE_METHOD when no candidates', async () => {
    const state = createMemoryStore();
    const policy = createPolicyEngine([]);
    const selector = createSelector({ state, policy });

    const outcome = await selector.select([], { transport: 'http' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('NO_COMPATIBLE_METHOD');
  });

  it('returns POLICY_DENIED when all candidates denied', async () => {
    const state = createMemoryStore();
    const policy = createPolicyEngine([
      { type: 'deny-protocol', protocols: ['mpp'] },
    ]);
    const selector = createSelector({ state, policy });

    const outcome = await selector.select([makeCandidate('a', 100n)], { transport: 'http' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('POLICY_DENIED');
  });

  it('returns ALL_EXPIRED when all candidates are past expiry', async () => {
    const state = createMemoryStore();
    const policy = createPolicyEngine([]);
    const selector = createSelector({ state, policy });

    const expired: PaymentCandidate = {
      ...makeCandidate('expired', 100n),
      normalized: {
        ...makeCandidate('expired', 100n).normalized,
        expiresAt: Date.now() - 1000,
      },
    };

    const outcome = await selector.select([expired], { transport: 'http' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('ALL_EXPIRED');
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test src/pipeline/select.test.ts
```

**Step 3: Implement filter.ts**

```typescript
// packages/core/src/pipeline/filter.ts
// ABOUTME: Hard-filter stage for the selection pipeline
// ABOUTME: Marks candidates ineligible for expiry, unsupported chains, and policy denial

import type { PaymentCandidate } from '../types/challenge.js';
import type { PolicyEngine } from '../types/policy.js';
import type { WalletAdapter } from '../types/wallet.js';

export async function applyHardFilters(
  candidates: PaymentCandidate[],
  policy: PolicyEngine,
  wallet?: WalletAdapter,
  now: number = Date.now(),
): Promise<void> {
  for (const candidate of candidates) {
    if (candidate.normalized.expiresAt !== undefined && candidate.normalized.expiresAt < now) {
      candidate.eligible = false;
      candidate.rejectionReason = 'EXPIRED';
      continue;
    }

    if (wallet) {
      const supported = await wallet.canSign(
        candidate.normalized.recipient ?? candidate.normalized.realm
      ).catch(() => false);
      // Only filter by chain if we can determine the chainId from the candidate
      // Chain filtering is protocol-specific; wallet check is optional here
    }

    const result = await policy.evaluate(candidate);
    if (!result.allow) {
      candidate.eligible = false;
      candidate.rejectionReason = result.reason ?? 'POLICY_DENIED';
    } else if (result.scoreBoost) {
      // Apply policy boost after scoring by storing it; scorer adds it
      candidate.score = (candidate.score ?? 0) + result.scoreBoost;
    }
  }
}
```

**Step 4: Implement select.ts**

```typescript
// packages/core/src/pipeline/select.ts
// ABOUTME: Top-level selector that runs the 5-stage pipeline and returns a SelectionOutcome
// ABOUTME: Stages: normalize → filter → score → policy boost → pick highest

import { applyHardFilters } from './filter.js';
import { scoreCandidates, DEFAULT_WEIGHTS } from './scorer.js';
import type { PaymentCandidate } from '../types/challenge.js';
import type { PolicyEngine } from '../types/policy.js';
import type { RouterStateStore } from '../types/state.js';
import type { RouterContext } from '../types/telemetry.js';
import type { SelectionOutcome } from '../types/selection.js';
import type { ScoringWeights } from './scorer.js';

export interface SelectorOptions {
  state: RouterStateStore;
  policy: PolicyEngine;
  weights?: ScoringWeights;
}

export interface Selector {
  select(candidates: PaymentCandidate[], ctx: RouterContext): Promise<SelectionOutcome>;
}

export function createSelector(options: SelectorOptions): Selector {
  const { state, policy, weights = DEFAULT_WEIGHTS } = options;

  return {
    async select(candidates, ctx) {
      if (candidates.length === 0) {
        return { ok: false, error: 'NO_COMPATIBLE_METHOD', detail: 'no candidates provided', considered: [] };
      }

      // Stage 3: hard filter (modifies candidates in place)
      await applyHardFilters(candidates, policy, undefined, (ctx.now ?? new Date()).getTime());

      const eligible = candidates.filter(c => c.eligible);

      if (eligible.length === 0) {
        const allExpired = candidates.every(c => c.rejectionReason === 'EXPIRED');
        if (allExpired) {
          return { ok: false, error: 'ALL_EXPIRED', detail: 'all challenges have expired', considered: candidates };
        }
        return { ok: false, error: 'POLICY_DENIED', detail: 'all candidates denied by policy', considered: candidates };
      }

      // Stage 4: score
      await scoreCandidates(candidates, weights, state, ctx);

      // Stage 5: pick highest score
      const best = eligible.reduce((a, b) => (b.score ?? 0) > (a.score ?? 0) ? b : a);

      return {
        ok: true,
        decision: {
          challenge: best.raw,
          candidate: best,
          score: best.score ?? 0,
          reasons: [],
          considered: candidates,
        },
      };
    },
  };
}
```

**Step 5: Run test — expect PASS**

```bash
cd packages/core && pnpm test src/pipeline/select.test.ts
```

**Step 6: Commit**

```bash
git add packages/core/src/pipeline/
git commit -m "feat(core): add filter and selector pipeline stages"
```

---

### Task 12: MindRouter factory

**Files:**
- Create: `packages/core/src/router.ts`
- Create: `packages/core/src/router.test.ts`

**Step 1: Write failing test**

```typescript
// packages/core/src/router.test.ts
import { describe, it, expect } from 'vitest';
import { createRouter } from './router.js';
import { createMemoryStore } from './state/memory.js';

describe('createRouter', () => {
  it('returns a router with a select method', () => {
    const router = createRouter({
      methods: [],
      state: createMemoryStore(),
      policy: [],
    });
    expect(typeof router.select).toBe('function');
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement router factory**

```typescript
// packages/core/src/router.ts
// ABOUTME: Factory function that wires together the selection pipeline components
// ABOUTME: Returns a MindRouter usable by HTTP and MCP adapters

import { createSelector } from './pipeline/select.js';
import { createPolicyEngine } from './policy/evaluator.js';
import type { RouterMethod } from './types/method.js';
import type { RouterStateStore } from './types/state.js';
import type { PolicyRule } from './types/policy.js';
import type { PaymentCandidate } from './types/challenge.js';
import type { RouterContext } from './types/telemetry.js';
import type { SelectionOutcome } from './types/selection.js';
import type { ScoringWeights } from './pipeline/scorer.js';

export interface MindRouterConfig {
  methods: RouterMethod[];
  state: RouterStateStore;
  policy: PolicyRule[];
  weights?: ScoringWeights;
}

export interface MindRouter {
  select(candidates: PaymentCandidate[], ctx: RouterContext): Promise<SelectionOutcome>;
  methods: RouterMethod[];
}

export function createRouter(config: MindRouterConfig): MindRouter {
  const policyEngine = createPolicyEngine(config.policy);
  const selector = createSelector({
    state: config.state,
    policy: policyEngine,
    weights: config.weights,
  });

  return {
    methods: config.methods,
    select: (candidates, ctx) => selector.select(candidates, ctx),
  };
}
```

**Step 4: Run test — expect PASS**

**Step 5: Update packages/core/src/index.ts** with all new exports

```typescript
export type * from './types/index.js';
export { OwsWalletAdapter } from './wallet/ows.js';
export type { OwsAdapterConfig } from './wallet/ows.js';
export { createMemoryStore } from './state/memory.js';
export { createPolicyEngine } from './policy/evaluator.js';
export { createRouter } from './router.js';
export type { MindRouter, MindRouterConfig } from './router.js';
export { DEFAULT_WEIGHTS } from './pipeline/scorer.js';
export type { ScoringWeights } from './pipeline/scorer.js';
```

**Step 6: Commit**

```bash
git add packages/core/src/
git commit -m "feat(core): add MindRouter factory and wire selection pipeline"
```

---

## Phase 4: `@mindwallet/core` — HTTP Adapter

### Task 13: HTTP challenge parsing

**Files:**
- Create: `packages/core/src/http/parse.ts`
- Create: `packages/core/src/http/parse.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/core/src/http/parse.test.ts
import { describe, it, expect } from 'vitest';
import { parseHttpChallenges } from './parse.js';
import type { RouterMethod } from '../types/method.js';

function makeTempoMethod(): RouterMethod {
  return {
    id: 'tempo',
    protocol: 'mpp',
    canHandle: (c) => c.normalized.method === 'tempo',
    normalize: (raw: any) => ({
      realm: raw.realm,
      protocol: 'mpp' as const,
      method: 'tempo',
      intent: raw.intent ?? 'charge',
      amount: raw.amount ? BigInt(raw.amount) : undefined,
      currency: raw.currency,
      hasDigestBinding: false,
    }),
    createCredential: async () => 'mpp-auth',
  };
}

function makeMppResponse(realm: string): Response {
  const request = Buffer.from(
    JSON.stringify({ realm, amount: '1000000', currency: 'USDC' })
  ).toString('base64url');

  return new Response(null, {
    status: 402,
    headers: {
      'WWW-Authenticate': `Payment id="ch-1" realm="${realm}" method="tempo" intent="charge" request="${request}"`,
    },
  });
}

describe('parseHttpChallenges', () => {
  it('parses MPP WWW-Authenticate header into candidate', () => {
    const response = makeMppResponse('https://api.example.com');
    const candidates = parseHttpChallenges(response, null, [makeTempoMethod()]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.protocol).toBe('mpp');
    expect(candidates[0]?.normalized.realm).toBe('https://api.example.com');
  });

  it('returns empty array when no payment headers', () => {
    const response = new Response(null, { status: 402 });
    const candidates = parseHttpChallenges(response, null, [makeTempoMethod()]);
    expect(candidates).toHaveLength(0);
  });

  it('marks candidate eligible by default', () => {
    const response = makeMppResponse('https://api.example.com');
    const candidates = parseHttpChallenges(response, null, [makeTempoMethod()]);
    expect(candidates[0]?.eligible).toBe(true);
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test src/http/parse.test.ts
```

**Step 3: Implement parse.ts**

Parse `WWW-Authenticate: Payment` headers for MPP, `PAYMENT-REQUIRED` header for x402, and the 402 body for SIWX and Bazaar schemas. Methods list is used to match and normalize each raw challenge.

```typescript
// packages/core/src/http/parse.ts
// ABOUTME: Parses all payment challenges from a 402 HTTP response
// ABOUTME: Reads WWW-Authenticate (MPP), PAYMENT-REQUIRED (x402), and response body (SIWX/Bazaar)

import type { RouterMethod } from '../types/method.js';
import type { PaymentCandidate } from '../types/challenge.js';

export function parseHttpChallenges(
  response: Response,
  body: unknown,
  methods: RouterMethod[],
): PaymentCandidate[] {
  const candidates: PaymentCandidate[] = [];

  // Parse MPP challenges from WWW-Authenticate headers
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() !== 'www-authenticate') continue;
    for (const raw of splitPaymentChallenges(value)) {
      const parsed = parsePaymentParams(raw);
      if (!parsed) continue;
      for (const method of methods) {
        const candidate: PaymentCandidate = {
          id: parsed.id ?? `mpp-${Date.now()}`,
          protocol: 'mpp',
          method,
          normalized: method.normalize(parsed),
          raw: parsed,
          eligible: true,
        };
        if (method.canHandle(candidate)) {
          candidates.push(candidate);
          break;
        }
      }
    }
  }

  // Parse x402 challenge from PAYMENT-REQUIRED header
  const paymentRequired = response.headers.get('payment-required');
  if (paymentRequired) {
    try {
      const decoded = Buffer.from(paymentRequired, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded);
      for (const method of methods) {
        const candidate: PaymentCandidate = {
          id: `x402-${Date.now()}`,
          protocol: 'x402',
          method,
          normalized: method.normalize(parsed),
          raw: parsed,
          eligible: true,
        };
        if (method.canHandle(candidate)) {
          candidates.push(candidate);
          break;
        }
      }
    } catch {
      // malformed x402 header — skip
    }
  }

  // Parse SIWX challenge from response body
  if (body && typeof body === 'object') {
    const extensions = (body as any)?.extensions;
    const siwx = extensions?.['sign-in-with-x'];
    const bazaar = extensions?.['bazaar'];

    if (siwx) {
      for (const method of methods) {
        const candidate: PaymentCandidate = {
          id: `siwx-${Date.now()}`,
          protocol: 'siwx',
          method,
          normalized: {
            ...method.normalize(siwx),
            inputSchema: bazaar?.inputSchema,
            outputSchema: bazaar?.outputSchema,
          },
          raw: siwx,
          eligible: true,
        };
        if (method.canHandle(candidate)) {
          candidates.push(candidate);
          break;
        }
      }
    }

    // Attach Bazaar schemas to existing candidates if present
    if (bazaar) {
      for (const c of candidates) {
        if (!c.normalized.inputSchema) c.normalized.inputSchema = bazaar.inputSchema;
        if (!c.normalized.outputSchema) c.normalized.outputSchema = bazaar.outputSchema;
      }
    }
  }

  return candidates;
}

function splitPaymentChallenges(header: string): string[] {
  const parts: string[] = [];
  const regex = /(?:^|,\s*)Payment\s+/gi;
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(header)) !== null) {
    starts.push(match.index + match[0].length);
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const end = i + 1 < starts.length ? findEnd(header, starts[i + 1]!) : header.length;
    parts.push(header.slice(start, end).trim());
  }
  return parts;
}

function findEnd(header: string, nextStart: number): number {
  let i = nextStart - 1;
  while (i > 0 && header[i] !== ',') i--;
  return i > 0 ? i : nextStart;
}

function parsePaymentParams(raw: string): Record<string, string> | null {
  const params: Record<string, string> = {};
  const regex = /(\w+)="([^"]*?)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(raw)) !== null) {
    params[m[1]!] = m[2]!;
  }
  if (!params['realm'] || !params['method'] || !params['intent']) return null;

  // Decode base64url request field
  if (params['request']) {
    try {
      const decoded = Buffer.from(params['request'], 'base64url').toString('utf8');
      const requestBody = JSON.parse(decoded);
      Object.assign(params, requestBody);
    } catch {
      return null;
    }
  }

  return params;
}
```

**Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test src/http/parse.test.ts
```

**Step 5: Commit**

```bash
git add packages/core/src/http/parse.ts packages/core/src/http/parse.test.ts
git commit -m "feat(core): add HTTP challenge parser"
```

---

### Task 14: HTTP adapter (wrapFetch)

**Files:**
- Create: `packages/core/src/http/adapter.ts`
- Create: `packages/core/src/http/adapter.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/core/src/http/adapter.test.ts
import { describe, it, expect, vi } from 'vitest';
import { wrapFetch } from './adapter.js';
import { createRouter } from '../router.js';
import { createMemoryStore } from '../state/memory.js';

function makeRouter() {
  return createRouter({ methods: [], state: createMemoryStore(), policy: [] });
}

describe('wrapFetch', () => {
  it('passes through 200 responses without payment', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const fetch = wrapFetch({ fetch: mockFetch, router: makeRouter(), state: createMemoryStore() });
    const response = await fetch('https://api.example.com/data');
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns 402 when no compatible method found', async () => {
    const body = JSON.stringify({});
    const mock402 = new Response(body, {
      status: 402,
      headers: { 'Content-Type': 'application/json' },
    });
    const mockFetch = vi.fn().mockResolvedValue(mock402);
    const fetch = wrapFetch({ fetch: mockFetch, router: makeRouter(), state: createMemoryStore() });
    const response = await fetch('https://api.example.com/paid');
    expect(response.status).toBe(402);
    expect(mockFetch).toHaveBeenCalledTimes(1); // no retry
  });

  it('uses cached SIWX entitlement before triggering 402', async () => {
    const state = createMemoryStore();
    await state.putEntitlement({
      realm: 'https://api.example.com',
      token: 'cached-token',
      expiresAt: Date.now() + 3_600_000,
      walletAddress: '0xabc',
    });

    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrappedFetch = wrapFetch({
      fetch: mockFetch,
      router: makeRouter(),
      state,
    });

    await wrappedFetch('https://api.example.com/protected');
    const call = mockFetch.mock.calls[0];
    const headers = new Headers((call?.[1] as RequestInit)?.headers);
    expect(headers.get('authorization')).toBe('Bearer cached-token');
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
cd packages/core && pnpm test src/http/adapter.test.ts
```

**Step 3: Implement wrapFetch**

```typescript
// packages/core/src/http/adapter.ts
// ABOUTME: Wraps fetch to handle the full HTTP 402 payment lifecycle
// ABOUTME: Checks SIWX entitlement cache first, then runs the selection pipeline

import { parseHttpChallenges } from './parse.js';
import type { MindRouter } from '../router.js';
import type { RouterStateStore } from '../types/state.js';
import type { Telemetry, RouterContext } from '../types/telemetry.js';

export interface WrapFetchOptions {
  fetch: typeof globalThis.fetch;
  router: MindRouter;
  state: RouterStateStore;
  wallet?: import('../types/wallet.js').WalletAdapter;
  telemetry?: Telemetry;
  maxRetries?: number;
}

export function wrapFetch(options: WrapFetchOptions): typeof globalThis.fetch {
  const { fetch: innerFetch, router, state, telemetry, maxRetries = 2 } = options;

  return async (input, init) => {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : (input as Request).url;

    // Check entitlement cache before making initial request
    const realm = new URL(url).origin;
    const entitlement = await state.getEntitlement(realm).catch(() => undefined);
    if (entitlement && entitlement.expiresAt > Date.now()) {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${entitlement.token}`);
      const response = await innerFetch(input, { ...init, headers });
      if (response.status !== 401 && response.status !== 402) return response;
      // Entitlement rejected — evict and fall through to normal flow
      await state.deleteEntitlement(realm).catch(() => {});
    }

    let response = await innerFetch(input, init);
    let retries = 0;

    while (response.status === 402 && retries < maxRetries) {
      retries++;

      // Clone response to read body without consuming it
      const bodyText = await response.clone().text().catch(() => '');
      let body: unknown = null;
      try { body = JSON.parse(bodyText); } catch {}

      const candidates = parseHttpChallenges(response, body, router.methods);

      const ctx: RouterContext = { transport: 'http', realm, url };

      telemetry?.onChallengeSeen?.({
        transport: 'http',
        realm,
        candidates: candidates.map(c => ({ id: c.id, protocol: c.protocol, method: c.normalized.method, intent: c.normalized.intent })),
        ctx,
      });

      if (candidates.length === 0) break;

      const outcome = await router.select(candidates, ctx);

      if (!outcome.ok) {
        telemetry?.onError?.({ code: outcome.error, message: outcome.detail, transport: 'http', ctx });
        break;
      }

      const { decision } = outcome;
      telemetry?.onDecision?.(decision, ctx);
      telemetry?.onAttempt?.({
        candidateId: decision.candidate.id,
        protocol: decision.candidate.protocol,
        method: decision.candidate.normalized.method,
        phase: 'createCredential',
        ctx,
      });

      let authorization: string;
      const startMs = Date.now();
      try {
        authorization = await decision.candidate.method.createCredential({
          candidate: decision.candidate,
          wallet: options.wallet!,
        });
      } catch (err) {
        telemetry?.onError?.({ code: 'CREDENTIAL_ERROR', message: String(err), transport: 'http', ctx });
        break;
      }

      telemetry?.onAttempt?.({
        candidateId: decision.candidate.id,
        protocol: decision.candidate.protocol,
        method: decision.candidate.normalized.method,
        phase: 'sendPaidRequest',
        ctx,
      });

      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set('Authorization', authorization);
      response = await innerFetch(input, { ...init, headers: retryHeaders });

      const durationMs = Date.now() - startMs;

      // Record outcome — always, regardless of response status
      await state.recordOutcome({
        realm,
        method: decision.candidate.normalized.method,
        protocol: decision.candidate.protocol,
        intent: decision.candidate.normalized.intent,
        ok: response.ok,
        durationMs,
        amount: decision.candidate.normalized.amount,
        currency: decision.candidate.normalized.currency,
        at: Date.now(),
      }).catch(() => {});

      if (response.ok) {
        // Parse receipt and fire telemetry
        const receipt = parseReceipt(response);
        if (receipt) {
          telemetry?.onReceipt?.({ receipt, transport: 'http', realm, ctx });
        }

        // Cache SIWX entitlement if server returns one
        const entitlementToken = response.headers.get('X-Entitlement-Token');
        const entitlementExpiry = response.headers.get('X-Entitlement-Expires');
        if (entitlementToken && options.wallet) {
          const expiresAt = entitlementExpiry
            ? new Date(entitlementExpiry).getTime()
            : Date.now() + 3_600_000;
          await state.putEntitlement({
            realm,
            token: entitlementToken,
            expiresAt,
            walletAddress: '',
          }).catch(() => {});
          telemetry?.onEntitlementCached?.({ realm, expiresAt, ctx });
        }
      }
    }

    return response;
  };
}

function parseReceipt(response: Response) {
  const header = response.headers.get('Payment-Receipt');
  if (!header) return null;
  try {
    const json = Buffer.from(header.trim(), 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed.status !== 'success') return null;
    return parsed;
  } catch {
    return null;
  }
}
```

**Step 4: Run test — expect PASS**

```bash
cd packages/core && pnpm test src/http/adapter.test.ts
```

**Step 5: Export from index.ts**

```typescript
export { wrapFetch } from './http/adapter.js';
export type { WrapFetchOptions } from './http/adapter.js';
```

**Step 6: Commit**

```bash
git add packages/core/src/http/
git commit -m "feat(core): add wrapFetch HTTP adapter with full lifecycle"
```

---

## Phase 5: `@mindwallet/protocols`

### Task 15: MPP/Tempo RouterMethod

**Files:**
- Create: `packages/protocols/src/mpp/method.ts`
- Create: `packages/protocols/src/mpp/method.test.ts`

**Step 1: Install mppx**

```bash
cd packages/protocols && pnpm add mppx
```

**Step 2: Write failing unit tests (pure logic — no mocks)**

Unit tests cover only `normalize()` and `canHandle()`, which are pure functions with no I/O.

```typescript
// packages/protocols/src/mpp/method.test.ts
// ABOUTME: Unit tests for MppMethod pure-logic functions
// ABOUTME: No mocks — normalize() and canHandle() have zero external dependencies
import { describe, it, expect } from 'vitest';
import { createMppMethod } from './method.js';

const method = createMppMethod({ evmAccount: {} as any, rpcUrl: 'https://rpc.example.com' });

describe('createMppMethod — protocol', () => {
  it('exposes protocol mpp', () => {
    expect(method.protocol).toBe('mpp');
  });
});

describe('createMppMethod — normalize()', () => {
  it('converts string amount to BigInt', () => {
    const n = method.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'charge', amount: '1000000', currency: 'USDC' });
    expect(n.amount).toBe(1_000_000n);
  });

  it('sets protocol to mpp', () => {
    const n = method.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'charge' });
    expect(n.protocol).toBe('mpp');
  });

  it('sets hasDigestBinding true when digest present', () => {
    const n = method.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'charge', digest: 'sha256=abc' });
    expect(n.hasDigestBinding).toBe(true);
  });

  it('sets hasDigestBinding false when digest absent', () => {
    const n = method.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'charge' });
    expect(n.hasDigestBinding).toBe(false);
  });

  it('sets amount undefined when absent', () => {
    const n = method.normalize({ realm: 'https://api.example.com', method: 'tempo', intent: 'charge' });
    expect(n.amount).toBeUndefined();
  });
});

describe('createMppMethod — canHandle()', () => {
  function makeCandidate(protocol: string, methodName: string) {
    return {
      id: 'c1', protocol: protocol as any, method,
      normalized: { realm: 'https://api.example.com', protocol: protocol as any, method: methodName, intent: 'charge', hasDigestBinding: false },
      raw: {}, eligible: true,
    };
  }

  it('returns true for mpp+tempo', () => {
    expect(method.canHandle(makeCandidate('mpp', 'tempo'))).toBe(true);
  });

  it('returns false for non-mpp protocol', () => {
    expect(method.canHandle(makeCandidate('x402', 'tempo'))).toBe(false);
  });

  it('returns false for mpp with unknown method name', () => {
    expect(method.canHandle(makeCandidate('mpp', 'other'))).toBe(false);
  });
});
```

**Step 2b: Write integration test (gated behind env var)**

```typescript
// packages/protocols/src/mpp/method.integration.test.ts
// ABOUTME: Integration test for MppMethod.createCredential against a real Tempo RPC
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=true and TEMPO_RPC_URL are set
import { describe, it, expect, beforeAll } from 'vitest';
import { createMppMethod } from './method.js';
import { privateKeyToAccount } from 'viem/accounts';

const skip = !process.env.RUN_INTEGRATION_TESTS || !process.env.TEMPO_RPC_URL || !process.env.TEST_PRIVATE_KEY;

describe.skipIf(skip)('MppMethod — createCredential (integration)', () => {
  let method: ReturnType<typeof createMppMethod>;

  beforeAll(() => {
    const account = privateKeyToAccount(process.env.TEST_PRIVATE_KEY as `0x${string}`);
    method = createMppMethod({ evmAccount: account, rpcUrl: process.env.TEMPO_RPC_URL! });
  });

  it('returns a non-empty Payment credential string', async () => {
    const candidate = {
      id: 'c1', protocol: 'mpp' as const, method,
      normalized: { realm: 'https://api.example.com', protocol: 'mpp' as const, method: 'tempo', intent: 'charge', amount: 1_000_000n, currency: 'USDC', hasDigestBinding: false },
      raw: { id: 'c1', realm: 'https://api.example.com', method: 'tempo', intent: 'charge', request: 'e30' },
      eligible: true,
    };
    const credential = await method.createCredential({ candidate });
    expect(typeof credential).toBe('string');
    expect(credential.length).toBeGreaterThan(0);
  });
});
```

Run unit tests: `cd packages/protocols && pnpm test src/mpp/method.test.ts`
Run integration tests: `RUN_INTEGRATION_TESTS=true TEMPO_RPC_URL=... TEST_PRIVATE_KEY=0x... pnpm test src/mpp/method.integration.test.ts`

**Step 3: Run test — expect FAIL**

**Step 4: Implement createMppMethod**

```typescript
// packages/protocols/src/mpp/method.ts
// ABOUTME: MPP/Tempo RouterMethod implementation using mppx for credential creation
// ABOUTME: Supports both charge and session intents; session intent uses Tempo payment channels

import { Mppx } from 'mppx';
import { tempo as tempoMethod } from 'mppx/tempo';
import { createClient, http } from 'viem';
import { tempo } from 'viem/chains';
import type { RouterMethod } from '@mindwallet/core';

export interface MppMethodConfig {
  evmAccount: any;   // viem Account
  rpcUrl: string;    // Tempo RPC URL
}

export function createMppMethod(config: MppMethodConfig): RouterMethod {
  return {
    id: 'tempo',
    protocol: 'mpp',

    canHandle(candidate) {
      return candidate.protocol === 'mpp' && candidate.normalized.method === 'tempo';
    },

    normalize(raw: any) {
      return {
        realm: raw.realm ?? '',
        protocol: 'mpp' as const,
        method: 'tempo',
        intent: raw.intent ?? 'charge',
        amount: raw.amount ? BigInt(raw.amount) : undefined,
        currency: raw.currency,
        recipient: raw.recipient,
        expiresAt: raw.expires ? new Date(raw.expires).getTime() : undefined,
        hasDigestBinding: Boolean(raw.digest),
      };
    },

    async createCredential({ candidate }) {
      const client = Mppx.create({
        polyfill: false,
        methods: [
          tempoMethod({
            account: config.evmAccount,
            getClient: () => createClient({
              chain: tempo,
              transport: http(config.rpcUrl),
            }),
          }),
        ],
      });

      // Reconstruct a Response-like object from the raw challenge for mppx
      const fakeResponse = new Response(null, {
        status: 402,
        headers: {
          'WWW-Authenticate': serializeMppChallenge(candidate.raw as Record<string, string>),
        },
      });

      return client.createCredential(fakeResponse);
    },
  };
}

function serializeMppChallenge(params: Record<string, string>): string {
  const parts = Object.entries(params)
    .filter(([k]) => ['id', 'realm', 'method', 'intent', 'request', 'expires', 'digest', 'opaque'].includes(k))
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `Payment ${parts}`;
}
```

**Step 5: Run test — expect PASS**

**Step 6: Commit**

```bash
git add packages/protocols/src/mpp/
git commit -m "feat(protocols): add MPP/Tempo RouterMethod"
```

---

### Task 16: x402 RouterMethod

**Files:**
- Create: `packages/protocols/src/x402/method.ts`
- Create: `packages/protocols/src/x402/method.test.ts`

Follow same TDD pattern as Task 15. x402 uses `@coinbase/x402` for encoding. The method parses the `PAYMENT-REQUIRED` header body (JSON with `accepts[]` array containing `scheme`, `network`, `maxAmountRequired`, `payTo`, `asset`). `createCredential` calls `wallet.sign(txRequest)` and encodes as x402 payment header.

**Step 1: Install dependency**

```bash
cd packages/protocols && pnpm add @coinbase/x402
```

**Step 2: Write failing unit tests (pure logic — no mocks)**

```typescript
// packages/protocols/src/x402/method.test.ts
// ABOUTME: Unit tests for X402Method pure-logic functions
// ABOUTME: No mocks — normalize() and canHandle() have zero external dependencies
import { describe, it, expect } from 'vitest';
import { createX402Method } from './method.js';

const method = createX402Method({ wallet: {} as any });

describe('createX402Method — normalize()', () => {
  it('extracts amount from first accept entry', () => {
    const n = method.normalize({ accepts: [{ network: 'base', maxAmountRequired: '2000000', payTo: '0xabc', asset: 'USDC' }] });
    expect(n.amount).toBe(2_000_000n);
  });

  it('sets protocol to x402', () => {
    const n = method.normalize({ accepts: [] });
    expect(n.protocol).toBe('x402');
  });

  it('encodes network in method name', () => {
    const n = method.normalize({ accepts: [{ network: 'base-sepolia', maxAmountRequired: '1000', payTo: '0x', asset: 'USDC' }] });
    expect(n.method).toBe('x402-base-sepolia');
  });

  it('defaults method to x402-evm when accepts is empty', () => {
    const n = method.normalize({ accepts: [] });
    expect(n.method).toBe('x402-evm');
  });

  it('sets hasDigestBinding false always', () => {
    const n = method.normalize({ accepts: [] });
    expect(n.hasDigestBinding).toBe(false);
  });
});

describe('createX402Method — canHandle()', () => {
  function makeCandidate(protocol: string) {
    return {
      id: 'c1', protocol: protocol as any, method,
      normalized: { realm: '', protocol: protocol as any, method: 'x402-evm', intent: 'payment', hasDigestBinding: false },
      raw: {}, eligible: true,
    };
  }

  it('returns true for x402 protocol', () => {
    expect(method.canHandle(makeCandidate('x402'))).toBe(true);
  });

  it('returns false for non-x402 protocol', () => {
    expect(method.canHandle(makeCandidate('mpp'))).toBe(false);
  });
});
```

**Step 2b: Write integration test (gated behind env var)**

```typescript
// packages/protocols/src/x402/method.integration.test.ts
// ABOUTME: Integration test for X402Method.createCredential against a real EVM node
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=true and TEST_PRIVATE_KEY are set
import { describe, it, expect, beforeAll } from 'vitest';
import { createX402Method } from './method.js';
import { OwsWalletAdapter } from '@mindwallet/core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallet } from '@open-wallet-standard/core';

const skip = !process.env.RUN_INTEGRATION_TESTS || !process.env.OWS_PASSPHRASE;

describe.skipIf(skip)('X402Method — createCredential (integration)', () => {
  let method: ReturnType<typeof createX402Method>;
  let vaultPath: string;

  beforeAll(() => {
    vaultPath = mkdtempSync(join(tmpdir(), 'mw-x402-test-'));
    createWallet('test-wallet', undefined, 12, vaultPath);
    const wallet = new OwsWalletAdapter({ walletId: 'test-wallet', vaultPath });
    method = createX402Method({ wallet });
  });

  it('returns an x402 payment header string', async () => {
    const candidate = {
      id: 'c1', protocol: 'x402' as const, method,
      normalized: { realm: '', protocol: 'x402' as const, method: 'x402-base', intent: 'payment', amount: 1_000_000n, currency: 'USDC', recipient: '0x0000000000000000000000000000000000000000', hasDigestBinding: false },
      raw: { accepts: [{ network: 'base', maxAmountRequired: '1000000', payTo: '0x0000000000000000000000000000000000000000', asset: 'USDC' }] },
      eligible: true,
    };
    const credential = await method.createCredential({ candidate });
    expect(typeof credential).toBe('string');
    expect(credential.length).toBeGreaterThan(0);
  });
});
```

**Steps 3–5:** Run unit test → fail → implement → pass

**Step 6: Commit**

```bash
git add packages/protocols/src/x402/
git commit -m "feat(protocols): add x402 RouterMethod"
```

---

### Task 17: SIWX RouterMethod

**Files:**
- Create: `packages/protocols/src/siwx/method.ts`
- Create: `packages/protocols/src/siwx/method.test.ts`

SIWX is a zero-cost candidate. `createCredential` calls `wallet.signMessage(siwxMessage)` where the message follows EIP-4361 (SIWE) format assembled from challenge fields: `domain`, `uri`, `version`, `chainId`, `nonce`, `issuedAt`.

**Step 1: Write failing unit tests (pure logic — no mocks)**

```typescript
// packages/protocols/src/siwx/method.test.ts
// ABOUTME: Unit tests for SiwxMethod pure-logic functions
// ABOUTME: No mocks — normalize(), canHandle(), and buildSiwxMessage() have zero external dependencies
import { describe, it, expect } from 'vitest';
import { createSiwxMethod, buildSiwxMessage } from './method.js';

const method = createSiwxMethod({ wallet: {} as any });

describe('createSiwxMethod — normalize()', () => {
  it('sets protocol to siwx', () => {
    const n = method.normalize({ domain: 'api.example.com', uri: 'https://api.example.com/', chainId: '1' });
    expect(n.protocol).toBe('siwx');
  });

  it('sets realm from domain', () => {
    const n = method.normalize({ domain: 'api.example.com', uri: 'https://api.example.com/', chainId: '1' });
    expect(n.realm).toBe('api.example.com');
  });

  it('sets intent to identity', () => {
    const n = method.normalize({ domain: 'api.example.com' });
    expect(n.intent).toBe('identity');
  });

  it('sets amount to undefined (zero cost)', () => {
    const n = method.normalize({ domain: 'api.example.com' });
    expect(n.amount).toBeUndefined();
  });

  it('sets hasDigestBinding false', () => {
    const n = method.normalize({ domain: 'api.example.com' });
    expect(n.hasDigestBinding).toBe(false);
  });
});

describe('createSiwxMethod — canHandle()', () => {
  function makeCandidate(protocol: string) {
    return {
      id: 'c1', protocol: protocol as any, method,
      normalized: { realm: '', protocol: protocol as any, method: 'siwx', intent: 'identity', hasDigestBinding: false },
      raw: {}, eligible: true,
    };
  }

  it('returns true for siwx protocol', () => {
    expect(method.canHandle(makeCandidate('siwx'))).toBe(true);
  });

  it('returns false for non-siwx protocol', () => {
    expect(method.canHandle(makeCandidate('mpp'))).toBe(false);
  });
});

describe('buildSiwxMessage()', () => {
  it('includes domain in message', () => {
    const msg = buildSiwxMessage({ domain: 'api.example.com', uri: 'https://api.example.com/', chainId: '1', nonce: 'abc123', issuedAt: '2026-03-25T00:00:00Z' });
    expect(msg).toContain('api.example.com');
  });

  it('includes nonce in message', () => {
    const msg = buildSiwxMessage({ domain: 'api.example.com', uri: 'https://api.example.com/', chainId: '1', nonce: 'uniquenonce', issuedAt: '2026-03-25T00:00:00Z' });
    expect(msg).toContain('uniquenonce');
  });

  it('includes URI in message', () => {
    const msg = buildSiwxMessage({ domain: 'api.example.com', uri: 'https://api.example.com/path', chainId: '1', nonce: 'n', issuedAt: '2026-03-25T00:00:00Z' });
    expect(msg).toContain('https://api.example.com/path');
  });
});
```

**Step 1b: Write integration test (gated behind env var)**

```typescript
// packages/protocols/src/siwx/method.integration.test.ts
// ABOUTME: Integration test for SiwxMethod.createCredential using a real OWS vault
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=true and OWS_PASSPHRASE are set
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSiwxMethod } from './method.js';
import { OwsWalletAdapter } from '@mindwallet/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallet } from '@open-wallet-standard/core';

const skip = !process.env.RUN_INTEGRATION_TESTS || !process.env.OWS_PASSPHRASE;

describe.skipIf(skip)('SiwxMethod — createCredential (integration)', () => {
  let method: ReturnType<typeof createSiwxMethod>;
  let vaultPath: string;

  beforeAll(() => {
    vaultPath = mkdtempSync(join(tmpdir(), 'mw-siwx-test-'));
    createWallet('test-wallet', undefined, 12, vaultPath);
    const wallet = new OwsWalletAdapter({ walletId: 'test-wallet', vaultPath });
    method = createSiwxMethod({ wallet });
  });

  afterAll(() => { rmSync(vaultPath, { recursive: true, force: true }); });

  it('returns a non-empty signature string', async () => {
    const candidate = {
      id: 'c1', protocol: 'siwx' as const, method,
      normalized: { realm: 'api.example.com', protocol: 'siwx' as const, method: 'siwx', intent: 'identity', hasDigestBinding: false },
      raw: { domain: 'api.example.com', uri: 'https://api.example.com/', chainId: '1', nonce: 'testnonce', issuedAt: new Date().toISOString() },
      eligible: true,
    };
    const credential = await method.createCredential({ candidate });
    expect(typeof credential).toBe('string');
    expect(credential.startsWith('0x')).toBe(true);
    expect(credential).toHaveLength(132); // 65-byte signature = 130 hex chars + 0x
  });
});
```

**Steps 2–4:** Run unit tests → fail → implement → pass

Run unit tests: `cd packages/protocols && pnpm test src/siwx/method.test.ts`
Run integration tests: `RUN_INTEGRATION_TESTS=true OWS_PASSPHRASE=test pnpm test src/siwx/method.integration.test.ts`

**Commit:**
```bash
git add packages/protocols/src/siwx/
git commit -m "feat(protocols): add SIWX RouterMethod"
```

---

### Task 18: Export protocols index

**Files:**
- Create: `packages/protocols/src/index.ts`

```typescript
// ABOUTME: Public API for @mindwallet/protocols
// ABOUTME: Exports all concrete RouterMethod factory functions

export { createMppMethod } from './mpp/method.js';
export type { MppMethodConfig } from './mpp/method.js';
export { createX402Method } from './x402/method.js';
export type { X402MethodConfig } from './x402/method.js';
export { createSiwxMethod } from './siwx/method.js';
export type { SiwxMethodConfig } from './siwx/method.js';
```

**Commit:**

```bash
git commit -m "feat(protocols): export all RouterMethod implementations"
```

---

## Phase 6: `@mindwallet/discovery`

### Task 19: Origin prober

**Files:**
- Create: `packages/discovery/src/probe.ts`
- Create: `packages/discovery/src/probe.test.ts`

**Step 1: Write failing test**

```typescript
// packages/discovery/src/probe.test.ts
import { describe, it, expect, vi } from 'vitest';
import { probeOrigin } from './probe.js';

describe('probeOrigin', () => {
  it('fetches /.well-known/x402 and returns endpoint descriptors', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        endpoints: [
          { path: '/api/enrich', method: 'POST', authMode: 'paid', protocols: ['x402', 'mpp'], pricing: { from: '0.001', currency: 'USDC' } },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const result = await probeOrigin('https://api.example.com', { fetch: mockFetch });
    expect(result.origin).toBe('https://api.example.com');
    expect(result.endpoints).toHaveLength(1);
    expect(result.endpoints[0]?.path).toBe('/api/enrich');
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/.well-known/x402');
  });

  it('returns empty endpoints when /.well-known/x402 is not found', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const result = await probeOrigin('https://api.example.com', { fetch: mockFetch });
    expect(result.endpoints).toHaveLength(0);
  });
});
```

**Step 2–5:** TDD cycle. Implement `probeOrigin` that fetches `/.well-known/x402`, parses endpoint catalog, and returns `DiscoveryResult`.

**Commit:**

```bash
git commit -m "feat(discovery): add origin prober"
```

---

### Task 20: Compliance auditor

**Files:**
- Create: `packages/discovery/src/audit.ts`
- Create: `packages/discovery/src/audit.test.ts`

Tests cover each `AuditWarning` code: `MISSING_RECEIPT_HEADER`, `MALFORMED_WWW_AUTHENTICATE`, `EXPIRED_CHALLENGE`, `MISSING_BAZAAR_SCHEMA`, `SIWX_NO_NONCE`, `X402_MISSING_RECIPIENT`.

**Commit:**

```bash
git commit -m "feat(discovery): add compliance auditor"
```

---

### Task 21: Registry client

**Files:**
- Create: `packages/discovery/src/registry.ts`
- Create: `packages/discovery/src/registry.test.ts`

```typescript
export function createRegistryClient(config: { url: string; fetch?: typeof globalThis.fetch }): RegistryClient {
  const f = config.fetch ?? globalThis.fetch;
  return {
    async search(query) {
      const response = await f(`${config.url}/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) return [];
      return response.json();
    },
  };
}
```

**Commit:**

```bash
git commit -m "feat(discovery): add registry client"
```

---

## Phase 7: `mindwallet` CLI + MCP Server

### Task 22: Config loading

**Files:**
- Create: `packages/cli/src/config.ts`
- Create: `packages/cli/src/config.test.ts`

Loads `~/.minds/wallet/config.json`. Merges with defaults. Validates required fields. Returns typed `MindWalletConfig`.

```typescript
export interface MindWalletConfig {
  wallet: {
    adapter: 'ows';
    owsVaultPath: string;
    walletId: string;
    owsAgentToken: string;
  };
  policy: PolicyRule[];
  scoring: ScoringWeights;
  registry: { url: string };
  rpc: { tempo: string; base: string; solana: string };
}

export const DEFAULT_CONFIG: MindWalletConfig = {
  wallet: {
    adapter: 'ows',
    owsVaultPath: '~/.minds/wallet/vault',
    walletId: 'default',
    owsAgentToken: '',
  },
  policy: [],
  scoring: DEFAULT_WEIGHTS,
  registry: { url: 'https://registry.agentcash.dev' },
  rpc: {
    tempo: 'https://rpc.mainnet.tempo.xyz',
    base: 'https://mainnet.base.org',
    solana: 'https://api.mainnet-beta.solana.com',
  },
};
```

**Commit:**

```bash
git commit -m "feat(cli): add config loader"
```

---

### Task 23: `fetch` command

**Files:**
- Create: `packages/cli/src/commands/fetch.ts`
- Create: `packages/cli/src/commands/fetch.test.ts`

Wires `loadConfig → createRouter → createOWSAdapter → wrapFetch → innerFetch`. Uses `yargs` for argument parsing. Prints response body to stdout.

Test: mock `wrapFetch` to verify correct argument assembly.

**Commit:**

```bash
git commit -m "feat(cli): add fetch command"
```

---

### Task 24: `discover` and `search` commands

**Files:**
- Create: `packages/cli/src/commands/discover.ts`
- Create: `packages/cli/src/commands/search.ts`

`discover <origin>` — calls `probeOrigin`, prints endpoint table + audit warnings.
`search <query>` — calls `createRegistryClient.search`, prints matching origins.

**Commit:**

```bash
git commit -m "feat(cli): add discover and search commands"
```

---

### Task 25: Wallet management commands

**Files:**
- Create: `packages/cli/src/commands/wallet.ts`

Subcommands: `create`, `list`, `import`. Thin wrappers around OWS Node SDK calls (`createWallet`, `listWallets`, `importWalletMnemonic`). All pass `config.wallet.owsVaultPath`.

**Commit:**

```bash
git commit -m "feat(cli): add wallet management commands"
```

---

### Task 26: Key management commands

**Files:**
- Create: `packages/cli/src/commands/key.ts`

`key create` — wraps OWS `createApiKey` with payment-focused policy defaults (Base + Solana + Tempo chain allowlist, 90-day expiry). Saves token to `config.wallet.owsAgentToken` (shows once, warns user).

`key revoke <id>` — wraps OWS key revocation.

**Commit:**

```bash
git commit -m "feat(cli): add key management commands"
```

---

### Task 27: CLI entry point

**Files:**
- Create: `packages/cli/src/cli.ts`

Assembles all commands into yargs. Handles top-level `--help`, `--version`. Entry point for `mindwallet` binary.

```typescript
// packages/cli/src/cli.ts
// ABOUTME: CLI entry point for mindwallet binary
// ABOUTME: Assembles all commands and delegates to yargs

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
// ... import commands

yargs(hideBin(process.argv))
  .command(fetchCommand)
  .command(discoverCommand)
  .command(searchCommand)
  .command(walletCommand)
  .command(keyCommand)
  .command(settingsCommand)
  .command(serveCommand)
  .demandCommand()
  .help()
  .parse();
```

**Commit:**

```bash
git commit -m "feat(cli): add CLI entry point"
```

---

### Task 28: MCP server

**Files:**
- Create: `packages/cli/src/mcp/server.ts`

Exposes all CLI operations as MCP tools using `@modelcontextprotocol/sdk`. Tool input schemas are derived from the same typed option structs as the CLI.

```bash
cd packages/cli && pnpm add @modelcontextprotocol/sdk
```

Key tools: `mindwallet_fetch`, `mindwallet_discover`, `mindwallet_search`, `mindwallet_wallet_list`, `mindwallet_get_balance`.

**Commit:**

```bash
git commit -m "feat(cli): add MCP server"
```

---

## Phase 8: Integration Tests

### Task 29: End-to-end HTTP payment test

**Files:**
- Create: `packages/cli/src/test/e2e-http.test.ts`
- Create: `packages/cli/src/test/server.ts` (local test server)

**Local test server** issues real 402 challenges (both MPP `WWW-Authenticate` and x402 `PAYMENT-REQUIRED` headers) and verifies incoming credentials.

Test scenarios:
1. MPP charge payment — 402 → select → credential → 200 + receipt
2. x402 payment — 402 → select → credential → 200
3. SIWX entitlement cache — first call pays, second call uses cached Bearer token
4. Policy denial — `deny-protocol: mpp` → `POLICY_DENIED`, no retry
5. Cheaper candidate wins — two candidates with different amounts → cheaper selected

```bash
git commit -m "test: add end-to-end HTTP payment tests"
```

---

### Task 30: Final typecheck, build, and test pass

**Step 1: Run full typecheck**

```bash
pnpm -r typecheck
```
Expected: zero errors

**Step 2: Run full build**

```bash
pnpm -r build
```
Expected: all packages build cleanly

**Step 3: Run all tests**

```bash
pnpm -r test
```
Expected: all green

**Step 4: Final commit**

```bash
git add -A
git status  # verify only expected files
git commit -m "chore: all packages build and tests pass"
```

---

## Appendix: Key Invariants to Verify During Implementation

Refer to `03_mindwallet_architecture.md` §Key Design Invariants. Before marking any task complete, verify:

1. `@mindwallet/core` imports no payment protocol packages (`@coinbase/x402`, `mppx`)
2. `@mindwallet/core` imports no wallet packages (`@open-wallet-standard/core`)
3. Protocol preference uses `prefer-protocol` policy rule — no `if protocol === 'mpp'` in pipeline code
4. `recordOutcome` is called after every paid response in `wrapFetch` (success or failure)
5. `telemetry.onReceipt` is called after every successful paid response
6. No telemetry hook receives a credential value (only `candidateId`, `method`, `phase`)
7. Config is read from `~/.minds/wallet/config.json`; OWS vault is at `config.wallet.owsVaultPath`
8. No test file uses `vi.mock` on `@open-wallet-standard/core`, `mppx`, `@coinbase/x402`, or any chain/RPC layer — only pure-logic functions are unit-tested; all I/O paths are covered by integration tests gated behind env vars
9. `createPolicyEngine` always receives `state` when a `budget` rule is present; the budget case sums `getOutcomes` spend within the window before allowing
10. `OutcomeRecord` carries a `currency` field; `OutcomeFilter.currency` is used by the budget rule to scope spend queries to the correct denomination
