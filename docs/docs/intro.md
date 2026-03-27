---
sidebar_position: 1
slug: /intro
---

# Introduction

mindwallet is a full-stack agent payment SDK for the multi-protocol payment economy. It combines intelligent multi-challenge selection, protocol coverage across x402, MPP/Tempo, and SIWX, and secure local wallet custody via the Open Wallet Standard (OWS) into a unified, layered system.

## Packages

The system ships as four npm packages in a monorepo:

| Package | Role |
|---|---|
| `@mindwallet/core` | Protocol-agnostic selection pipeline, wallet interface, state, HTTP adapter |
| `@mindwallet/protocols` | Concrete x402, Tempo, and SIWX `RouterMethod` implementations |
| `@mindwallet/discovery` | Pre-flight registry search, origin probing |
| `mindwallet` | CLI + MCP server; wires all above with OWS or private key wallets |

Library consumers depend on `@mindwallet/core` + `@mindwallet/protocols`. CLI/MCP consumers install `mindwallet`.

## Key Features

- **Multi-protocol support** — x402 (EVM USDC), MPP/Tempo (charge + session), SIWX (zero-cost identity)
- **Intelligent selection** — normalize, filter, score, select pipeline with policy enforcement
- **Dual wallet modes** — OWS vault (production custody) or raw private key (CI/testing)
- **CLI + MCP server** — `mindwallet fetch`, `mindwallet pay`, and MCP tools for AI agents
- **Environment-first config** — `MINDWALLET_*` env vars override config file; no config file required

## Quick Start

```bash
# Install the CLI
npm install -g mindwallet

# Use with a private key (simplest)
export MINDWALLET_PRIVATE_KEY=0x...
mindwallet fetch https://api.example.com/paid-endpoint

# Or inspect an existing OWS vault
mindwallet wallet
mindwallet key create my-agent
```
