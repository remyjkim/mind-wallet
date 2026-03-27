---
sidebar_position: 2
---

# Environment Variables

mindpass can be configured entirely through environment variables. Env vars override config file values; no config file is required.

## Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `MINDPASS_PRIVATE_KEY` | Raw EVM private key (hex, 0x-prefixed) | `0xac09...` |
| `MINDPASS_CHAIN_IDS` | Comma-separated CAIP-2 chain IDs | `eip155:8453,eip155:4217` |
| `MINDPASS_WALLET_ID` | OWS wallet name/ID | `default` |
| `MINDPASS_VAULT_PATH` | OWS vault directory | `~/.minds/wallet/vault` |
| `MINDPASS_TEMPO_GAS` | Fixed gas limit for Tempo charges | `200000` |
| `MINDPASS_RPC_BASE` | Base chain RPC URL | `https://mainnet.base.org` |
| `MINDPASS_RPC_TEMPO` | Tempo chain RPC URL | `https://rpc.mainnet.tempo.xyz` |

## Legacy Variables

| Variable | Description |
|----------|-------------|
| `CONFIG_PATH` | Override config file path (default: `~/.config/mindpass/config.json`) |
| `OWS_PASSPHRASE` | OWS vault passphrase (read by OWS internally) |

## Resolution Order

Configuration is resolved by merging three sources:

```
env vars  >  config file  >  hardcoded defaults
```

1. **Hardcoded defaults** — `walletId: "default"`, `vaultPath: ~/.minds/wallet/vault`
2. **Config file** — `~/.config/mindpass/config.json` (returns `{}` if missing)
3. **Env vars** — `MINDPASS_*` variables override everything

## Examples

### CI pipeline with private key

```bash
export MINDPASS_PRIVATE_KEY=$SECRET_KEY
export MINDPASS_CHAIN_IDS=eip155:8453
mindpass fetch https://api.example.com/data
```

### Custom RPC URLs

```bash
export MINDPASS_RPC_BASE=https://base-mainnet.g.alchemy.com/v2/...
export MINDPASS_RPC_TEMPO=https://rpc.testnet.tempo.xyz
mindpass fetch https://api.example.com/data
```

### Override config file wallet

```bash
# Config file says walletId: "production"
# Env var overrides to "staging"
export MINDPASS_WALLET_ID=staging
mindpass fetch https://api.example.com/data
```
