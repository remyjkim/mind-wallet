# CLI Systematic Payment Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add systematic CLI and shared test coverage for private-key x402, private-key MCP, invalid env/config cases, and live-gated Tempo CLI flows.

**Architecture:** Extend the current CLI integration suite in layers. First, add shared test helpers so CLI tests can reuse the local payment server and standard private-key config. Next, add local deterministic tests for x402 and MPP/Tempo discovery/probe flows. Finally, add live-gated Tempo credential/payment tests that run only when `RUN_INTEGRATION_TESTS=1`, `TEST_PRIVATE_KEY`, and `TEMPO_RPC_URL` are present, with a minimal CLI test seam for gas configuration if needed.

**Tech Stack:** TypeScript, vitest, `@mindwallet/test-server`, `@mindwallet/core`, `@mindwallet/protocols`, `@mindwallet/discovery`, viem

---

## Target State

After this work:

1. `payCommand` is covered for private-key x402 end-to-end with a local test server.
2. `createMcpServer` is covered for private-key x402 end-to-end with in-memory MCP transport.
3. CLI discovery/probe behavior is covered for local Tempo/MPP challenges.
4. Env/config validation edge cases are covered with focused tests.
5. Live CLI Tempo tests exist and are explicitly gated by required env vars.
6. Shared helper infrastructure removes duplicated test setup across CLI integration suites.

## Approaches Considered

### Approach A: CLI-only additions

Add missing tests directly inside existing CLI test files, embedding any extra setup inline.

**Pros**
- Lowest initial code movement
- Fastest to start

**Cons**
- Duplicates private-key config and server startup logic
- Makes future payment-protocol tests harder to extend
- Scatters live-gated test assumptions across files

### Approach B: Shared helper + layered coverage strategy (Recommended)

Add reusable CLI test helpers for private-key config and payment server startup, then build local and live-gated tests on top.

**Pros**
- Stronger structure and less duplicated setup
- Keeps x402 local tests deterministic
- Makes Tempo live gating explicit and maintainable
- Best fit for systematic testing

**Cons**
- Slightly more up-front helper work

### Approach C: Mostly live integration

Push most new coverage into live-gated tests with real keys and RPC.

**Pros**
- Highest realism

**Cons**
- Slower and more brittle
- Weakens default local verification
- Overkill for x402 and invalid-config cases

**Decision:** Use Approach B.

## Key Risks And Constraints

1. Tempo charge credential creation in `packages/protocols/src/tempo.ts` may require gas estimation unless a fixed gas override is provided.
2. `routerFromConfig()` currently passes `rpcUrl` and `store` to `createTempoMethod`, but not `gas`.
3. Local test infrastructure can fully cover x402 and MPP challenge discovery, but full Tempo payment execution still requires live RPC + private key.
4. Existing OWS integration tests must remain green and their env gating must not regress.

## Proposed Test Matrix

| Area | Local deterministic | Live-gated |
|---|---|---|
| `fetchCommand` SIWX | Already covered | Already covered |
| `payCommand` private-key x402 | Add | Not needed |
| `createMcpServer` private-key x402 | Add | Not needed |
| CLI probe/discovery for Tempo MPP | Add | Not needed |
| Invalid env/config cases | Add | Not needed |
| CLI Tempo credential/payment flow | Minimal probe coverage only | Add |

## Environment Contract

### Default local runs

- `pnpm --filter mindwallet exec vitest run`
- No private secrets required
- New x402 + MPP probe tests must pass here

### Integration runs

- `RUN_INTEGRATION_TESTS=1`
- `OWS_PASSPHRASE=test` for OWS-gated tests
- `TEST_PRIVATE_KEY=0x...` for live private-key protocol tests
- `TEMPO_RPC_URL=https://...` for live Tempo CLI tests

If Tempo charge execution still needs a fixed gas override for reliability, add a dedicated CLI test-only config/env seam in this plan rather than depending on a funded account.

---

### Task 1: Add shared CLI payment test helpers

**Files:**
- Modify: `packages/cli/src/test-helpers.ts`
- Test: `packages/cli/src/commands/fetch.test.ts`
- Test: `packages/cli/src/commands/pay.test.ts`
- Test: `packages/cli/src/mcp-server.test.ts`

**Step 1: Write the failing test**

Add a minimal helper usage to one existing CLI integration test file so it imports helper functions that do not exist yet:

```typescript
import {
  startLocalPaymentTestServer,
  makePrivateKeyConfig,
} from '../test-helpers.js';
```

Use them in a single existing test setup block.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter mindwallet exec vitest run src/commands/pay.test.ts
```

Expected: FAIL with module export or missing symbol errors for the new helpers.

**Step 3: Write minimal implementation**

Extend `packages/cli/src/test-helpers.ts` with:

```typescript
import { startTestServer, type TestServerHandle } from '@mindwallet/test-server';
import type { MindwalletConfig } from './config.js';

export const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

export function makePrivateKeyConfig(overrides: Partial<MindwalletConfig> = {}): MindwalletConfig {
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
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter mindwallet exec vitest run src/commands/pay.test.ts
```

Expected: PASS or return to the next intended failing condition in the touched test file.

**Step 5: Commit**

```bash
git add packages/cli/src/test-helpers.ts packages/cli/src/commands/pay.test.ts
git commit -m "[test] add shared CLI payment test helpers"
```

---

### Task 2: Add private-key x402 integration tests for `payCommand`

**Files:**
- Modify: `packages/cli/src/commands/pay.test.ts`
- Test: `packages/cli/src/test-helpers.ts`

**Step 1: Write the failing test**

Add a new describe block gated only on `RUN_INTEGRATION_TESTS`:

```typescript
const pkSkip = !process.env['RUN_INTEGRATION_TESTS'];

describe.skipIf(pkSkip)('payCommand: private key x402 integration', () => {
  let server: TestServerHandle;
  let config: MindwalletConfig;

  beforeAll(async () => {
    server = await startLocalPaymentTestServer();
    config = makePrivateKeyConfig({ chainIds: ['eip155:84532'] });
  });

  afterAll(async () => {
    await server.close();
  });

  it('probes, pays, and writes x402 response body to stdout', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await payCommand(`${server.url}/x402/data`, config);
      const output = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toContain('paid x402 content');
    } finally {
      stdoutSpy.mockRestore();
    }
  });

  it('prints x402 discovery details in verbose mode', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await payCommand(`${server.url}/x402/data`, config, { verbose: true });
      const errOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(errOutput).toContain('x402');
      expect(errOutput).toContain('HTTP 200');
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/commands/pay.test.ts
```

Expected: FAIL because either the helper is missing, the private-key config uses the wrong chain/network, or the current test file has not been wired for x402 local flow.

**Step 3: Write minimal implementation**

If the new helper from Task 1 is not sufficient, make only the smallest adjustment necessary. The preferred implementation is test-only setup, not production changes.

**Step 4: Run test to verify it passes**

Run:

```bash
RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/commands/pay.test.ts
```

Expected: PASS with OWS tests skipped unless `OWS_PASSPHRASE` is also set.

**Step 5: Commit**

```bash
git add packages/cli/src/commands/pay.test.ts packages/cli/src/test-helpers.ts
git commit -m "[test] add private key x402 integration tests for payCommand"
```

---

### Task 3: Add private-key x402 integration tests for MCP server tools

**Files:**
- Modify: `packages/cli/src/mcp-server.test.ts`
- Test: `packages/cli/src/test-helpers.ts`

**Step 1: Write the failing test**

Add a second describe block using `createMcpServer(makePrivateKeyConfig(...))` and `startLocalPaymentTestServer()`:

```typescript
describe.skipIf(pkSkip)('MCP server tools: private key x402 integration', () => {
  let server: TestServerHandle;
  let client: Client;

  beforeAll(async () => {
    server = await startLocalPaymentTestServer();
    const mcpServer = createMcpServer(makePrivateKeyConfig({ chainIds: ['eip155:84532'] }));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)]);
  });

  afterAll(async () => {
    await server.close();
  });

  it('fetch_with_payment resolves x402 and returns paid content', async () => {
    const result = await client.callTool({
      name: 'fetch_with_payment',
      arguments: { url: `${server.url}/x402/data` },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('paid x402 content');
    expect(result.isError).toBeFalsy();
  });

  it('probe_origin detects x402 candidates', async () => {
    const result = await client.callTool({
      name: 'probe_origin',
      arguments: { url: `${server.url}/x402/data` },
    });
    const parsed = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
    expect(parsed.requires402).toBe(true);
    expect(parsed.candidates[0].protocol).toBe('x402');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/mcp-server.test.ts
```

Expected: FAIL until the new setup path is correct.

**Step 3: Write minimal implementation**

Prefer test-only fixes. Only touch production code if the MCP server cannot route private-key x402 correctly and the failure proves a real product bug.

**Step 4: Run test to verify it passes**

Run:

```bash
RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/mcp-server.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/cli/src/mcp-server.test.ts packages/cli/src/test-helpers.ts
git commit -m "[test] add private key x402 MCP integration coverage"
```

---

### Task 4: Add local Tempo/MPP probe and discovery coverage at the CLI layer

**Files:**
- Modify: `packages/cli/src/commands/pay.test.ts`
- Modify: `packages/cli/src/mcp-server.test.ts`
- Test: `packages/cli/src/test-helpers.ts`

**Step 1: Write the failing test**

Add tests that hit `${server.url}/mpp/data` using private-key config and assert probe/discovery behavior without requiring live Tempo RPC:

```typescript
it('verbose pay output reports tempo payment candidates from local MPP challenge', async () => {
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  try {
    await payCommand(`${server.url}/mpp/data`, makePrivateKeyConfig(), { verbose: true });
    const errOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(errOutput).toContain('tempo');
  } finally {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  }
});
```

In MCP tests:

```typescript
it('probe_origin detects tempo candidates from local MPP challenge', async () => {
  const result = await client.callTool({
    name: 'probe_origin',
    arguments: { url: `${server.url}/mpp/data` },
  });
  const parsed = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
  expect(parsed.requires402).toBe(true);
  expect(parsed.candidates.some((c: { method: string }) => c.method === 'tempo')).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/commands/pay.test.ts src/mcp-server.test.ts
```

Expected: FAIL if current assertions or helper setup do not align with actual MPP challenge output.

**Step 3: Write minimal implementation**

Adjust helper/server setup or test expectations only as required by the actual MPP challenge structure. Do not add live RPC dependency here.

**Step 4: Run test to verify it passes**

Run:

```bash
RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/commands/pay.test.ts src/mcp-server.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/cli/src/commands/pay.test.ts packages/cli/src/mcp-server.test.ts packages/cli/src/test-helpers.ts
git commit -m "[test] add local Tempo challenge discovery coverage for CLI"
```

---

### Task 5: Add invalid env/config edge-case tests

**Files:**
- Modify: `packages/cli/src/config.test.ts`
- Modify: `packages/cli/src/router-from-config.test.ts`
- Modify: `packages/cli/src/index.ts` (only if needed for public API coverage)

**Step 1: Write the failing tests**

Add focused tests for:

```typescript
it('preserves empty config when MINDWALLET_CHAIN_IDS is unset', () => {
  delete process.env['MINDWALLET_CHAIN_IDS'];
  expect(readEnvOverrides().chainIds).toBeUndefined();
});

it('keeps empty chain entries trimmed out', () => {
  process.env['MINDWALLET_CHAIN_IDS'] = ' eip155:8453 , , eip155:4217 ';
  try {
    expect(readEnvOverrides().chainIds).toEqual(['eip155:8453', 'eip155:4217']);
  } finally {
    delete process.env['MINDWALLET_CHAIN_IDS'];
  }
});

it('throws for mutually exclusive privateKey and walletId through routerFromConfig', () => {
  expect(() =>
    routerFromConfig({
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      walletId: 'default',
    }),
  ).toThrow();
});
```

If you choose to add private-key format validation in config resolution, include that test here first.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter mindwallet exec vitest run src/config.test.ts src/router-from-config.test.ts
```

Expected: FAIL on the newly asserted edge case.

**Step 3: Write minimal implementation**

Likely change in `readEnvOverrides()`:

```typescript
if (chainIds) {
  overrides.chainIds = chainIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
```

Add further validation only if driven by a failing test and needed by the product contract.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter mindwallet exec vitest run src/config.test.ts src/router-from-config.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/cli/src/config.test.ts packages/cli/src/router-from-config.test.ts packages/cli/src/config.ts
git commit -m "[test] add env and config edge case coverage for CLI wallet modes"
```

---

### Task 6: Add a minimal Tempo test seam for CLI live integration

**Files:**
- Modify: `packages/cli/src/config.ts`
- Modify: `packages/cli/src/router-from-config.ts`
- Modify: `packages/cli/src/config.test.ts`
- Modify: `packages/cli/src/router-from-config.test.ts`

**Step 1: Write the failing tests**

Add config-resolution and router tests for a Tempo gas override env/config field. The least invasive option is a dedicated optional config field:

```typescript
interface MindwalletConfig {
  tempoGas?: string;
}
```

Config test:

```typescript
it('reads MINDWALLET_TEMPO_GAS', () => {
  process.env['MINDWALLET_TEMPO_GAS'] = '200000';
  try {
    expect(readEnvOverrides().tempoGas).toBe('200000');
  } finally {
    delete process.env['MINDWALLET_TEMPO_GAS'];
  }
});
```

Router test:

```typescript
it('passes tempoGas to Tempo method in private key mode', () => {
  const ctx = routerFromConfig({
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    tempoGas: '200000',
  });
  expect(ctx.methods).toHaveLength(3);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter mindwallet exec vitest run src/config.test.ts src/router-from-config.test.ts
```

Expected: FAIL because `tempoGas` is not yet part of the config or router.

**Step 3: Write minimal implementation**

Add:

```typescript
tempoGas?: string;
```

to `MindwalletConfig`, read `MINDWALLET_TEMPO_GAS`, and pass:

```typescript
createTempoMethod({
  account,
  rpcUrl: config.rpcUrls?.['tempo'],
  gas: config.tempoGas !== undefined ? BigInt(config.tempoGas) : undefined,
  store: state,
})
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter mindwallet exec vitest run src/config.test.ts src/router-from-config.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/src/router-from-config.ts packages/cli/src/config.test.ts packages/cli/src/router-from-config.test.ts
git commit -m "[test] add Tempo gas test seam for live CLI integration"
```

---

### Task 7: Add live-gated CLI Tempo integration tests

**Files:**
- Modify: `packages/cli/src/commands/pay.test.ts`
- Modify: `packages/cli/src/mcp-server.test.ts`
- Test: `packages/cli/src/test-helpers.ts`

**Step 1: Write the failing tests**

Add live-gated Tempo tests with:

```typescript
const tempoSkip =
  !process.env['RUN_INTEGRATION_TESTS'] ||
  !process.env['TEST_PRIVATE_KEY'] ||
  !process.env['TEMPO_RPC_URL'];
```

For `pay.test.ts`:

```typescript
describe.skipIf(tempoSkip)('payCommand: live Tempo integration', () => {
  let server: TestServerHandle;
  let config: MindwalletConfig;

  beforeAll(async () => {
    server = await startLocalPaymentTestServer();
    config = {
      privateKey: process.env['TEST_PRIVATE_KEY'] as `0x${string}`,
      chainIds: ['eip155:42431'],
      rpcUrls: { tempo: process.env['TEMPO_RPC_URL']! },
      tempoGas: '200000',
    };
  });

  afterAll(async () => {
    await server.close();
  });

  it('pays a local Tempo/MPP challenge and writes paid content', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await payCommand(`${server.url}/mpp/data`, config);
      const output = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toContain('paid mpp content');
    } finally {
      stdoutSpy.mockRestore();
    }
  });
});
```

Add an MCP variant that hits `fetch_with_payment` against `/mpp/data`.

**Step 2: Run test to verify it fails**

Run:

```bash
RUN_INTEGRATION_TESTS=1 TEST_PRIVATE_KEY="$TEST_PRIVATE_KEY" TEMPO_RPC_URL="$TEMPO_RPC_URL" pnpm --filter mindwallet exec vitest run src/commands/pay.test.ts src/mcp-server.test.ts
```

Expected: FAIL initially due to missing seam or real integration mismatch.

**Step 3: Write minimal implementation**

Make only the smallest production change required for real CLI Tempo execution. If Task 6 was implemented correctly, this step should be test-only or no-op.

**Step 4: Run test to verify it passes**

Run:

```bash
RUN_INTEGRATION_TESTS=1 TEST_PRIVATE_KEY="$TEST_PRIVATE_KEY" TEMPO_RPC_URL="$TEMPO_RPC_URL" pnpm --filter mindwallet exec vitest run src/commands/pay.test.ts src/mcp-server.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/cli/src/commands/pay.test.ts packages/cli/src/mcp-server.test.ts packages/cli/src/test-helpers.ts packages/cli/src/config.ts packages/cli/src/router-from-config.ts
git commit -m "[test] add live Tempo CLI integration coverage"
```

---

### Task 8: Full verification

**Files:**
- Verify only

**Step 1: Run unit/default CLI suite**

Run:

```bash
pnpm --filter mindwallet exec vitest run
```

Expected: PASS with live-gated tests skipped.

**Step 2: Run private-key local integration suite**

Run:

```bash
RUN_INTEGRATION_TESTS=1 pnpm --filter mindwallet exec vitest run src/commands/fetch.test.ts src/commands/pay.test.ts src/mcp-server.test.ts
```

Expected: PASS for local SIWX/x402 paths; live Tempo tests skipped unless env vars are present.

**Step 3: Run full CLI integration suite**

Run:

```bash
RUN_INTEGRATION_TESTS=1 OWS_PASSPHRASE=test TEST_PRIVATE_KEY="$TEST_PRIVATE_KEY" TEMPO_RPC_URL="$TEMPO_RPC_URL" pnpm --filter mindwallet exec vitest run
```

Expected: PASS, including OWS, private-key x402, MCP, and live Tempo tests.

**Step 4: Run package check**

Run:

```bash
pnpm --filter mindwallet check
```

Expected: PASS.

**Step 5: Run monorepo check**

Run:

```bash
pnpm -r check
```

Expected: PASS.

**Step 6: Commit**

```bash
git status --short
git diff --name-only
```

Review the diff, then commit only the intended files using scoped `[test]` and `[chore]` messages per task.
