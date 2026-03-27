---
sidebar_position: 2
---

# Quick Start

## Private Key Mode (fastest)

Set your private key and go:

```bash
export MINDWALLET_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
mindwallet fetch https://api.example.com/paid-endpoint
```

This enables all three protocols (x402, Tempo, SIWX) with an implicit x402 preference.

## OWS Vault Mode (production)

Create a wallet, generate an agent key, then fetch:

```bash
# Create a new OWS wallet
mindwallet wallet create

# Generate a scoped agent key for payments
mindwallet key create --name my-agent --chains eip155:8453,eip155:65536

# Fetch a paid endpoint
mindwallet fetch https://api.example.com/paid-endpoint
```

## MCP Server (for AI agents)

Start the MCP server so your AI agent can make paid requests:

```bash
mindwallet serve --transport stdio
```

The server exposes two tools:
- `fetch_with_payment` — fetch a URL with automatic 402 handling
- `probe_origin` — discover payment requirements for a URL

## Library Usage

```typescript
import { createRouter, wrapFetch, PrivateKeyWalletAdapter, createMemoryStore } from '@mindwallet/core';
import { createSiwxMethod, createX402Method, createTempoMethod } from '@mindwallet/protocols';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');
const wallet = new PrivateKeyWalletAdapter({ privateKey: '0x...' });
const state = createMemoryStore();

const router = createRouter({
  methods: [createSiwxMethod(), createX402Method({ account }), createTempoMethod({ account, store: state })],
  state,
  policy: [],
});

const fetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });
const response = await fetch('https://api.example.com/paid-endpoint');
```
