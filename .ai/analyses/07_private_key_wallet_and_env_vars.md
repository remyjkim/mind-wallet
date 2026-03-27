# Private Key Wallet Support & Env Var Management

## Problem

The CLI currently requires an OWS vault for all operations. This blocks two important use cases:

1. **Quick-start / CI usage** — developers and pipelines that have a raw private key (e.g. from a test faucet or a deployed agent) and want to make paid requests without setting up OWS infrastructure.
2. **x402 and Tempo protocols** — these require a viem `Account` at method instantiation time. The current `routerFromConfig` only creates the SIWX method because it has no access to a viem-compatible signer.

Additionally, the CLI lacks a coherent env var story. Config values are scattered across `CONFIG_PATH`, `OWS_PASSPHRASE`, and ad-hoc `process.env` reads inside individual commands.

---

## Design Decisions

### 1. Config Schema: Optional Fields (not discriminated union)

The current `MindwalletConfig` gains two optional fields:

```typescript
interface MindwalletConfig {
  // --- existing OWS fields (all optional) ---
  walletId?: string;
  vaultPath?: string;
  passphrase?: string;

  // --- new private key fields ---
  privateKey?: `0x${string}`;
  chainIds?: string[];          // CAIP-2, e.g. ["eip155:8453"]

  // --- shared ---
  policy?: PolicyRuleConfig[];
  rpcUrls?: Record<string, string>;
}
```

**Mutually exclusive**: if both `privateKey` and `walletId` are set, `routerFromConfig` throws. If neither is set, it falls back to OWS defaults (vault at `~/.minds/wallet/vault`, wallet ID `"default"`).

**Why optional fields over a discriminated union**: the config file is optional (env-var-only usage is valid), and both modes share `policy` and `rpcUrls`. A discriminator like `wallet.adapter: "ows" | "privateKey"` adds schema complexity that doesn't pay for itself at this stage.

### 2. Env Var Resolution

A new `resolveConfig()` function merges three sources in priority order:

```
env vars  >  config file  >  hardcoded defaults
```

#### Env var mapping

| Env Var | Config Field | Notes |
|---------|-------------|-------|
| `MINDWALLET_PRIVATE_KEY` | `privateKey` | Hex-encoded, `0x`-prefixed |
| `MINDWALLET_CHAIN_IDS` | `chainIds` | Comma-separated CAIP-2 IDs |
| `MINDWALLET_WALLET_ID` | `walletId` | OWS wallet ID |
| `MINDWALLET_VAULT_PATH` | `vaultPath` | OWS vault directory |
| `MINDWALLET_RPC_BASE` | `rpcUrls.base` | Base RPC URL |
| `MINDWALLET_RPC_TEMPO` | `rpcUrls.tempo` | Tempo RPC URL |
| `MINDWALLET_REGISTRY_URL` | (discovery) | Already implemented |

#### Backward compatibility

| Legacy Var | Maps To | Deprecation |
|-----------|---------|-------------|
| `CONFIG_PATH` | config file path | Kept, no `MINDWALLET_` equivalent needed |
| `OWS_PASSPHRASE` | `passphrase` | Kept, OWS reads it internally |

`MINDWALLET_` prefix is canonical for all new env vars. No `MINDWALLET_CONFIG_PATH` or `MINDWALLET_PASSPHRASE` — these legacy vars are sufficient and OWS owns the passphrase read.

#### `resolveConfig` signature

```typescript
function resolveConfig(): MindwalletConfig {
  const file = loadConfig();           // returns {} on ENOENT
  const env = readEnvOverrides();      // reads MINDWALLET_* vars
  return { ...defaults, ...file, ...env };
}
```

### 3. `loadConfig` Changes

Current behavior: throws on missing file. New behavior:

- **Missing file** → returns `{}`
- **Malformed JSON** → still throws (user error, not optional)
- **Parse succeeds** → returns parsed config

This enables env-var-only usage (no config file needed) and simplifies CI pipelines.

### 4. `routerFromConfig` Changes

Two explicit branches based on which wallet fields are present:

#### Private key branch

When `config.privateKey` is set:

```typescript
const account = privateKeyToAccount(config.privateKey);
const wallet = new PrivateKeyWalletAdapter(account, config.chainIds);
const methods = [
  createSiwxMethod(),
  createX402Method({ account }),
  createTempoMethod({ account, rpcUrl: config.rpcUrls?.tempo }),
];
// Implicit prefer-protocol: x402 boost (0.1)
const policy = [
  ...convertPolicy(config.policy),
  { type: 'prefer-protocol', protocol: 'x402', boost: 0.1 },
];
```

All three protocols are enabled. x402 gets an implicit score boost because it's the most widely deployed paid protocol and the natural default for private key users.

#### OWS branch

When `config.privateKey` is not set (existing behavior):

```typescript
const wallet = new OwsWalletAdapter({
  walletId: config.walletId,
  vaultPath: config.vaultPath,
  passphrase: config.passphrase,
});
const methods = [createSiwxMethod()];
```

SIWX only. x402 and Tempo require viem `Account` objects that OWS doesn't expose directly — enabling them for OWS is future work that requires an OWS-to-viem bridge.

#### Validation

`routerFromConfig` throws if both `privateKey` and `walletId` are set. The error message is explicit: `"Cannot set both privateKey and walletId — choose one wallet mode"`.

### 5. Testing Strategy

#### Unit tests

- `resolveConfig`: env vars override file values; file values override defaults; missing file returns `{}`
- `readEnvOverrides`: each `MINDWALLET_*` var maps correctly; unset vars are absent from result
- Validation: mutual exclusion of `privateKey` + `walletId`; `privateKey` without `0x` prefix rejected

#### Integration test

- Private key x402 flow: use `PrivateKeyWalletAdapter` + local test-server x402 endpoint → verify 402 is resolved and paid response is returned
- This mirrors the existing SIWX integration tests in `fetch.test.ts` and `pay.test.ts`

---

## What This Does NOT Change

- **OWS remains the default.** No config + no env vars = OWS mode with default vault path.
- **No new CLI commands.** Private key mode is activated purely through config/env vars.
- **No changes to `@mindwallet/core` or `@mindwallet/protocols`.** The `PrivateKeyWalletAdapter` and protocol methods already exist.
- **No scoring weight changes.** The `prefer-protocol: x402` boost uses the same mechanism as user-configured policy rules.

---

## Files Touched

| File | Change |
|------|--------|
| `packages/cli/src/config.ts` | Add `resolveConfig`, `readEnvOverrides`; change `loadConfig` to return `{}` on ENOENT; add `privateKey`/`chainIds` to `MindwalletConfig` |
| `packages/cli/src/router-from-config.ts` | Add private key branch; add mutual exclusion validation |
| `packages/cli/src/config.test.ts` | Unit tests for `resolveConfig`, `readEnvOverrides`, validation |
| `packages/cli/src/router-from-config.test.ts` | Add tests for private key branch, validation error |
| `packages/cli/src/commands/fetch.test.ts` | Add x402 integration test with private key wallet |

---

## Relationship to Target Architecture

The target architecture (`.ai/analyses/03_mindwallet_architecture.md`) envisions a more structured config with `wallet.adapter` discriminator and additional features (scoring weights, telemetry sink, agent tokens). This design is a stepping stone: it adds private key support with minimal schema changes, deferring the full config restructure to when the scoring and telemetry systems are implemented.

The two designs are compatible — migrating from optional fields to a discriminated union is straightforward and can be done when the richer config features justify the schema complexity.
