# Mindwallet Config And Wallet Modes

**Category**: Reference
**Tags**: config, env, wallet, ows, private-key
**Last Updated**: 2026-03-26
**References**: `packages/cli/src/config.ts`, `packages/cli/src/router-from-config.ts`, `packages/cli/src/index.ts`

---

## Overview

Mindwallet configuration is represented by `MindwalletConfig`.

Two wallet modes exist:

- OWS vault mode
- Private key mode

The config model supports both, but the active CLI binary still loads config from file via `loadConfig()` rather than `resolveConfig()`. This doc therefore separates:

- the supported config model
- the current CLI behavior

## `MindwalletConfig`

Current shape:

```ts
interface MindwalletConfig {
  walletId?: string
  vaultPath?: string
  passphrase?: string
  privateKey?: `0x${string}`
  chainIds?: string[]
  tempoGas?: string
  policy?: PolicyRuleConfig[]
  rpcUrls?: Record<string, string>
}
```

## Wallet Modes

### OWS vault mode

OWS mode is used when `privateKey` is absent.

Defaults:

- `walletId`: `default`
- `vaultPath`: `~/.minds/wallet/vault`

Enabled payment methods:

- `siwx`

Primary use cases:

- local operator wallet usage
- OWS-backed signing
- OWS API key management

### Private key mode

Private key mode is used when `privateKey` is present.

Enabled payment methods:

- `siwx`
- `x402`
- `tempo`

Additional behavior:

- appends an implicit `prefer-protocol: x402` policy boost

Primary use cases:

- CI automation
- testing with raw EVM keys
- x402 and Tempo payment flows

### Mutual exclusion rule

`privateKey` and `walletId` should not both be set.

The router enforces this by throwing:

```text
Cannot set both privateKey and walletId
```

## Config File Path

Default config file:

```text
~/.config/mindwallet/config.json
```

Override:

```bash
CONFIG_PATH=/custom/path/config.json mindwallet fetch https://api.example.com
```

Behavior:

- missing file returns an empty config object
- malformed JSON still throws

## Recommended Config File Examples

### OWS vault mode

```json
{
  "walletId": "default",
  "vaultPath": "/Users/you/.minds/wallet/vault",
  "policy": [
    { "type": "prefer-protocol", "protocol": "siwx", "boost": 0.1 }
  ]
}
```

### Private key mode

```json
{
  "privateKey": "0xYOUR_PRIVATE_KEY",
  "chainIds": ["eip155:8453", "eip155:42431"],
  "tempoGas": "200000",
  "rpcUrls": {
    "tempo": "https://rpc.moderato.tempo.xyz"
  },
  "policy": [
    { "type": "deny-protocol", "protocol": "mpp" }
  ]
}
```

## Supported Env Vars In The Config Layer

These are read by `readEnvOverrides()`:

- `MINDWALLET_PRIVATE_KEY`
- `MINDWALLET_CHAIN_IDS`
- `MINDWALLET_WALLET_ID`
- `MINDWALLET_VAULT_PATH`
- `MINDWALLET_TEMPO_GAS`
- `MINDWALLET_RPC_BASE`
- `MINDWALLET_RPC_TEMPO`

Other env vars used elsewhere:

- `CONFIG_PATH`
- `OWS_PASSPHRASE`
- `MINDWALLET_REGISTRY_URL`

## Current CLI Caveat

The config layer supports:

```ts
resolveConfig() // env > file
```

But the CLI entrypoint currently does:

```ts
const config = loadConfig()
```

Implication:

- library consumers can rely on env override support
- CLI users should not assume `MINDWALLET_*` env vars are merged yet

If you need CLI reliability today, prefer:

1. a config file
2. `CONFIG_PATH` if the file lives elsewhere
3. `OWS_PASSPHRASE` for OWS flows

## `chainIds`

Used only in private-key mode.

Examples:

- `eip155:8453` for Base
- `eip155:42431` for Tempo Moderato testnet

Config-layer env parsing:

- comma-separated
- trims whitespace
- filters out empty entries

Example:

```bash
export MINDWALLET_CHAIN_IDS='eip155:8453, eip155:42431'
```

## `tempoGas`

`tempoGas` is a string in config and is converted to `bigint` when constructing the Tempo method.

Purpose:

- fixed gas override for live Tempo charge signing
- reduces dependence on gas estimation during test and automation flows

Example:

```json
{
  "tempoGas": "200000"
}
```

## `rpcUrls`

Current special keys used by the router:

- `tempo`

Examples:

```json
{
  "rpcUrls": {
    "tempo": "https://rpc.moderato.tempo.xyz"
  }
}
```

## Policy Rules

Current config-level rule types:

- `budget`
- `deny-protocol`
- `prefer-protocol`

Examples:

```json
[
  { "type": "budget", "currency": "USDC", "limit": "1000000", "window": "daily" },
  { "type": "deny-protocol", "protocol": "mpp" },
  { "type": "prefer-protocol", "protocol": "x402", "boost": 0.2 }
]
```

Notes:

- private-key mode already adds an implicit x402 preference
- explicit user policy is still accepted and merged

## Practical Guidance

### Choose OWS mode when

- you need OWS wallet inspection
- you need OWS key management
- you already operate an OWS vault

### Choose private-key mode when

- you need x402 or Tempo support
- you are building CI or agent automation
- you want a simpler signer for tests and bots

### Prefer config files today when using the CLI binary

That is the safest operator-facing path until the CLI switches from `loadConfig()` to `resolveConfig()`.
