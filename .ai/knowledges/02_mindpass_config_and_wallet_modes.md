# Mindpass Config And Wallet Modes

**Category**: Reference
**Tags**: config, env, wallet, ows, private-key
**Last Updated**: 2026-03-27
**References**: `packages/cli/src/config.ts`, `packages/cli/src/router-from-config.ts`, `packages/discovery/src/registry.ts`

---

## Overview

Mindpass configuration is represented by `MindpassConfig`.

The CLI resolves configuration in this order:

```ts
env vars > config file > defaults
```

Two wallet modes exist:

- OWS vault mode
- private-key mode

## `MindpassConfig`

Current shape:

```ts
interface MindpassConfig {
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

## Config File Path

Default config file:

```text
~/.config/mindpass/config.json
```

Override:

```bash
CONFIG_PATH=/custom/path/config.json mindpass fetch https://api.example.com
```

Behavior:

- missing file returns an empty config object
- malformed JSON still throws
- `saveConfig()` creates parent directories automatically

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
- vault-backed MCP operation

Limits:

- no x402 support
- no Tempo support

### Private-key mode

Private-key mode is used when `privateKey` is present.

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
- agent automation through MCP

### Mutual exclusion rule

`privateKey` and `walletId` must not both be set.

The router enforces this by throwing:

```text
Cannot set both privateKey and walletId
```

## Supported Env Vars

These are read directly into config resolution:

- `MINDPASS_PRIVATE_KEY`
- `MINDPASS_CHAIN_IDS`
- `MINDPASS_WALLET_ID`
- `MINDPASS_VAULT_PATH`
- `MINDPASS_TEMPO_GAS`
- `MINDPASS_RPC_BASE`
- `MINDPASS_RPC_TEMPO`

Other operator env vars used by the CLI and discovery layer:

- `CONFIG_PATH`
- `OWS_PASSPHRASE`
- `MINDPASS_REGISTRY_URL`

## CLI Resolution Behavior

The CLI entrypoint uses:

```ts
const config = resolveConfig()
```

Implications:

- CLI users and library consumers share the same config structure
- env-only operation is supported for private-key usage
- config files remain first-class for stable operator setups
- `CONFIG_PATH` overrides the file location
- `OWS_PASSPHRASE` still applies to OWS-backed operations

## `chainIds`

Used only in private-key mode.

Env parsing behavior:

- comma-separated
- trims whitespace
- filters empty entries

Example:

```bash
export MINDPASS_CHAIN_IDS='eip155:8453, eip155:42431'
```

## `tempoGas`

`tempoGas` is a string in config and is converted to `bigint` when constructing the Tempo method.

Purpose:

- fixed gas override for live Tempo charge signing
- reduced dependence on gas estimation during automated flows

## `rpcUrls`

Current special keys used by the router:

- `base`
- `tempo`

Example:

```json
{
  "rpcUrls": {
    "base": "https://mainnet.base.org",
    "tempo": "https://rpc.mainnet.tempo.xyz"
  }
}
```

## Registry Configuration

Registry search defaults to the Bazaar registry, but the base URL can be overridden:

```bash
export MINDPASS_REGISTRY_URL=https://registry.example.com
mindpass search maps
```

This affects CLI `search` because the discovery layer resolves registry base URL from `MINDPASS_REGISTRY_URL`.

## Policy Rules

Current config-level rule types:

- `budget`
- `deny-protocol`
- `prefer-protocol`

Example:

```json
[
  { "type": "budget", "currency": "USDC", "limit": "1000000", "window": "daily" },
  { "type": "deny-protocol", "protocol": "mpp" },
  { "type": "prefer-protocol", "protocol": "x402", "boost": 0.2 }
]
```

Notes:

- private-key mode already adds an implicit x402 preference
- explicit user policy is still merged in

## Practical Config Examples

### OWS config file

```json
{
  "walletId": "default",
  "vaultPath": "/Users/you/.minds/wallet/vault",
  "policy": [
    { "type": "prefer-protocol", "protocol": "siwx", "boost": 0.1 }
  ]
}
```

### Private-key config file

```json
{
  "privateKey": "0xYOUR_PRIVATE_KEY",
  "chainIds": ["eip155:8453", "eip155:42431"],
  "tempoGas": "200000",
  "rpcUrls": {
    "base": "https://mainnet.base.org",
    "tempo": "https://rpc.mainnet.tempo.xyz"
  },
  "policy": [
    { "type": "deny-protocol", "protocol": "mpp" }
  ]
}
```

### Env-only private-key usage

```bash
export MINDPASS_PRIVATE_KEY=0x...
export MINDPASS_CHAIN_IDS=eip155:8453,eip155:42431
export MINDPASS_RPC_TEMPO=https://rpc.mainnet.tempo.xyz
mindpass fetch https://paid-api.example.com/data
```

### Registry override example

```bash
export MINDPASS_REGISTRY_URL=https://registry.example.com
mindpass search images --json
```

## Practical Guidance

### Choose OWS mode when

- you need wallet inspection
- you need API key management
- you already operate an OWS vault

### Choose private-key mode when

- you need x402 or Tempo support
- you are building CI or agent automation
- you want the simplest non-OWS signer for tests and bots

### Config files are optional for private-key CLI usage

If the required `MINDPASS_*` env vars are present, the CLI can run without a config file.
