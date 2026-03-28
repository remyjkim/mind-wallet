---
title: "Guides"
description: "Policy rules, private key setup, and environment variables."
date: 2026-03-27
order: 2
---

## Policy Rules

Policy rules control which payment protocols and amounts mindpass will accept. They are evaluated during the selection pipeline's filter stage.

### Configuration

Add policy rules to your config file:

```json
{
  "policy": [
    { "type": "budget", "currency": "USDC", "limit": "10000000", "window": "daily" },
    { "type": "deny-protocol", "protocol": "mpp" },
    { "type": "prefer-protocol", "protocol": "x402", "boost": 0.2 }
  ]
}
```

### Rule Types

#### budget

Caps spending within a time window.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `currency` | string | `"USDC"` | Currency to track |
| `limit` | string | `"0"` | Maximum amount (in smallest unit) |
| `window` | string | `"daily"` | Time window: `daily`, `weekly`, `monthly` |

#### deny-protocol

Blocks a specific payment protocol entirely.

| Field | Type | Description |
|-------|------|-------------|
| `protocol` | string | Protocol to deny: `x402`, `mpp`, `siwx` |

#### prefer-protocol

Adds a score boost to candidates of a specific protocol, making it more likely to be selected.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `protocol` | string | — | Protocol to prefer |
| `boost` | number | `0.1` | Score boost (0.0 to 1.0) |

### Implicit Rules

In private key mode, an implicit `prefer-protocol: x402` rule with boost `0.1` is added automatically. This makes x402 the default when multiple protocols can handle a challenge.

### Examples

#### Allow only SIWX (no payments)

```json
{
  "policy": [
    { "type": "deny-protocol", "protocol": "x402" },
    { "type": "deny-protocol", "protocol": "mpp" }
  ]
}
```

#### Daily budget of 1 USDC

```json
{
  "policy": [
    { "type": "budget", "currency": "USDC", "limit": "1000000", "window": "daily" }
  ]
}
```

#### Prefer Tempo over x402

```json
{
  "policy": [
    { "type": "prefer-protocol", "protocol": "mpp", "boost": 0.3 }
  ]
}
```

---

## Private Key Wallet

mindpass supports a raw EVM private key as an alternative to OWS vault custody. This is useful for CI pipelines, testing, and quick-start scenarios.

### Setup

Set the private key via environment variable:

```bash
export MINDPASS_PRIVATE_KEY=0x_YOUR_PRIVATE_KEY_HERE
```

Or in the config file (`~/.config/mindpass/config.json`):

```json
{
  "privateKey": "0x_YOUR_PRIVATE_KEY_HERE",
  "chainIds": ["eip155:8453"]
}
```

### What It Enables

Private key mode enables all three payment protocols:

| Protocol | Description |
|----------|-------------|
| SIWX | Zero-cost identity authentication |
| x402 | EVM USDC payments (EIP-3009) |
| Tempo | MPP charge and session payments |

An implicit `prefer-protocol: x402` boost (0.1) is applied, making x402 the default when multiple protocols are available.

### Chain IDs

By default, the private key adapter supports:
- `eip155:1` — Ethereum mainnet
- `eip155:8453` — Base
- `eip155:4217` — Tempo mainnet
- `eip155:42431` — Tempo Moderato testnet

Override with `MINDPASS_CHAIN_IDS`:

```bash
export MINDPASS_CHAIN_IDS=eip155:8453,eip155:4217
```

### Mutual Exclusion

Private key mode and OWS mode are mutually exclusive. Setting both `privateKey` and `walletId` will produce an error:

```
Error: Cannot set both privateKey and walletId — choose one wallet mode
```

### Comparison with OWS

| Feature | Private Key | OWS Vault |
|---------|------------|-----------|
| Protocols | SIWX + x402 + Tempo | SIWX only |
| Setup | One env var | Create wallet + agent key |
| Security | Key in memory/env | Encrypted vault, scoped tokens |
| Use case | CI, testing, dev | Production, multi-chain |

---

## Environment Variables

mindpass can be configured entirely through environment variables. Env vars override config file values; no config file is required.

### Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `MINDPASS_PRIVATE_KEY` | Raw EVM private key (hex, 0x-prefixed) | `0xac09...` |
| `MINDPASS_CHAIN_IDS` | Comma-separated CAIP-2 chain IDs | `eip155:8453,eip155:4217` |
| `MINDPASS_WALLET_ID` | OWS wallet name/ID | `default` |
| `MINDPASS_VAULT_PATH` | OWS vault directory | `~/.minds/wallet/vault` |
| `MINDPASS_TEMPO_GAS` | Fixed gas limit for Tempo charges | `200000` |
| `MINDPASS_RPC_BASE` | Base chain RPC URL | `https://mainnet.base.org` |
| `MINDPASS_RPC_TEMPO` | Tempo chain RPC URL | `https://rpc.mainnet.tempo.xyz` |

### Resolution Order

Configuration is resolved by merging three sources:

```
env vars  >  config file  >  hardcoded defaults
```

1. **Hardcoded defaults** — `walletId: "default"`, `vaultPath: ~/.minds/wallet/vault`
2. **Config file** — `~/.config/mindpass/config.json` (returns `{}` if missing)
3. **Env vars** — `MINDPASS_*` variables override everything

### Examples

#### CI pipeline with private key

```bash
export MINDPASS_PRIVATE_KEY=$SECRET_KEY
export MINDPASS_CHAIN_IDS=eip155:8453
mindpass fetch https://api.example.com/data
```

#### Custom RPC URLs

```bash
export MINDPASS_RPC_BASE=https://base-mainnet.g.alchemy.com/v2/...
export MINDPASS_RPC_TEMPO=https://rpc.testnet.tempo.xyz
mindpass fetch https://api.example.com/data
```
