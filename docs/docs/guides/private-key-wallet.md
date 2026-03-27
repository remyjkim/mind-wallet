---
sidebar_position: 1
---

# Private Key Wallet

mindpass supports a raw EVM private key as an alternative to OWS vault custody. This is useful for CI pipelines, testing, and quick-start scenarios.

## Setup

Set the private key via environment variable:

```bash
export MINDPASS_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Or in the config file (`~/.config/mindpass/config.json`):

```json
{
  "privateKey": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "chainIds": ["eip155:8453"]
}
```

## What It Enables

Private key mode enables all three payment protocols:

| Protocol | Description |
|----------|-------------|
| SIWX | Zero-cost identity authentication |
| x402 | EVM USDC payments (EIP-3009) |
| Tempo | MPP charge and session payments |

An implicit `prefer-protocol: x402` boost (0.1) is applied, making x402 the default when multiple protocols are available.

## Chain IDs

By default, the private key adapter supports:
- `eip155:1` — Ethereum mainnet
- `eip155:8453` — Base
- `eip155:4217` — Tempo mainnet
- `eip155:42431` — Tempo Moderato testnet

Override with `MINDPASS_CHAIN_IDS`:

```bash
export MINDPASS_CHAIN_IDS=eip155:8453,eip155:4217
```

## Mutual Exclusion

Private key mode and OWS mode are mutually exclusive. Setting both `privateKey` and `walletId` will produce an error:

```
Error: Cannot set both privateKey and walletId — choose one wallet mode
```

## Comparison with OWS

| Feature | Private Key | OWS Vault |
|---------|------------|-----------|
| Protocols | SIWX + x402 + Tempo | SIWX only |
| Setup | One env var | Create wallet + agent key |
| Security | Key in memory/env | Encrypted vault, scoped tokens |
| Use case | CI, testing, dev | Production, multi-chain |
