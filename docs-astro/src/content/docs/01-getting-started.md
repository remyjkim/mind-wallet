---
title: "Getting Started"
description: "Install mindpass and make your first paid request."
date: 2026-03-27
order: 1
---

## CLI (recommended for agents)

```bash
brew tap remyjkim/mindpass
brew install mindpass
```

Alternate install path:

```bash
npm install -g mindpass-cli
```

## Library (for SDK consumers)

```bash
# Core selection pipeline + wallet interface
npm install @mindpass/core

# Protocol implementations (x402, Tempo, SIWX)
npm install @mindpass/protocols

# Optional: discovery and registry search
npm install @mindpass/discovery
```

## Requirements

- Node.js >= 20.0
- For OWS wallet mode: `@open-wallet-standard/core` (bundled with CLI)
- For private key mode: `viem` (bundled with CLI)

---

## Quick Start

### Private Key Mode (fastest)

Set your private key and go:

```bash
export MINDPASS_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
mindpass fetch https://api.example.com/paid-endpoint
mindpass discover https://api.example.com/paid-endpoint --json
```

This enables all three protocols (x402, Tempo, SIWX) with an implicit x402 preference.

### OWS Vault Mode (production)

Use an existing OWS vault or the bootstrap example, then inspect the wallet and generate an agent key:

```bash
# From an existing OWS vault
mindpass wallet
mindpass key create my-agent
```

For a disposable local setup, use the runnable example in `examples/ows`:

```bash
cd examples/ows
bun run bootstrap
bun run start
```

### MCP Server (for AI agents)

Start the MCP server so your AI agent can make paid requests:

```bash
mindpass mcp
```

The server exposes two tools:
- `fetch_with_payment` — fetch a URL with automatic 402 handling
- `probe_origin` — discover payment requirements for a URL

### Library Usage

```typescript
import { createRouter, wrapFetch, PrivateKeyWalletAdapter, createMemoryStore } from '@mindpass/core';
import { createSiwxMethod, createX402Method, createTempoMethod } from '@mindpass/protocols';
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
