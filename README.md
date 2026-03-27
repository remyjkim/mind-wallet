# mindwallet

**Agent payment SDK for the multi-protocol economy.**

AI agents need to pay for APIs, authenticate their identity, and manage budgets — all without human intervention. Today's payment landscape is fragmented across competing protocols (x402, MPP/Tempo, SIWX), each with different challenge formats, credential types, and signing requirements. An agent that works with one protocol is blind to the others.

mindwallet solves this by wrapping `fetch()` with an intelligent payment layer that automatically detects, evaluates, and resolves HTTP 402 challenges across all major agent payment protocols. Your agent writes `fetch(url)` and mindwallet handles the rest — protocol detection, candidate scoring, policy enforcement, credential signing, and retry.

```bash
# Fastest path: use the CLI with a private key wallet
npm install -g mindwallet

export MINDWALLET_PRIVATE_KEY=0x...
mindwallet fetch https://paid-api.example.com/data
```

## Why mindwallet?

| Problem | How mindwallet solves it |
|---------|--------------------------|
| Agents fail on 402 responses | `wrapFetch` intercepts 402s and resolves them transparently |
| Multiple payment protocols with different formats | Unified selection pipeline normalizes x402, Tempo, and SIWX into a common candidate model |
| No budget controls for autonomous agents | Policy engine enforces spending caps, protocol allow/deny lists, and preference rules |
| Wallet setup complexity | Two modes: raw private key (one env var) or OWS vault (production-grade custody) |
| No visibility into payment decisions | Structured audit trail of every candidate considered, scored, and selected |

## Supported Protocols

| Protocol | What It Does | Credential Type |
|----------|-------------|-----------------|
| **x402** | EVM USDC micropayments | EIP-3009 `transferWithAuthorization` signature |
| **Tempo** | MPP charge and session payments | Signed EVM transaction (pull or push mode) |
| **SIWX** | Zero-cost identity authentication | Signed SIWE message |

## Quick Start

### CLI

```bash
npm install -g mindwallet

# Private key mode (fastest — one env var, all protocols enabled)
export MINDWALLET_PRIVATE_KEY=0x...
mindwallet fetch https://paid-api.example.com/data
mindwallet discover https://paid-api.example.com/data --json

# Inspect an existing OWS vault
mindwallet wallet

# Create an OWS API key from an existing vault
mindwallet key create my-agent

# Check the installed CLI version
mindwallet --version
```

### MCP Server (for AI agents)

```bash
# Expose mindwallet as MCP tools for your AI agent
mindwallet mcp
```

Tools: `fetch_with_payment`, `probe_origin`

### Library

```bash
npm install @mindwallet/core @mindwallet/protocols
```

```typescript
import { createMemoryStore, createRouter, PrivateKeyWalletAdapter, wrapFetch } from '@mindwallet/core';
import { createSiwxMethod, createX402Method, createTempoMethod } from '@mindwallet/protocols';
import { privateKeyToAccount } from 'viem/accounts';

const privateKey = process.env.MINDWALLET_PRIVATE_KEY!;
const account = privateKeyToAccount(privateKey);
const state = createMemoryStore();
const wallet = new PrivateKeyWalletAdapter({ privateKey });
const router = createRouter({
  methods: [
    createSiwxMethod(),
    createX402Method({ account }),
    createTempoMethod({ account, store: state }),
  ],
  state,
  policy: [],
});

const paidFetch = wrapFetch({ fetch, router, state, wallet });
const res = await paidFetch('https://api.example.com/data');
console.log(await res.text());
```

## Packages

| Package | Description |
|---------|-------------|
| [`@mindwallet/core`](packages/core) | Selection pipeline, wallet adapters, state, policy engine, `wrapFetch` |
| [`@mindwallet/protocols`](packages/protocols) | x402, Tempo, and SIWX `RouterMethod` implementations |
| [`@mindwallet/discovery`](packages/discovery) | Origin probing and registry search |
| [`mindwallet`](packages/cli) | CLI + MCP server |

## How It Works

```
Agent calls fetch(url)
         │
         ▼
    ┌─────────┐
    │ Request  │──── 200 OK ──── Done
    └─────────┘
         │
       402?
         │
         ▼
  ┌──────────────┐
  │   Detect     │  Parse PAYMENT-REQUIRED (x402),
  │  Candidates  │  WWW-Authenticate (Tempo), body (SIWX)
  └──────────────┘
         │
         ▼
  ┌──────────────┐
  │   Policy     │  Budget caps, deny/allow lists,
  │   Filter     │  protocol preferences
  └──────────────┘
         │
         ▼
  ┌──────────────┐
  │    Score     │  Cost, latency, success rate,
  │   & Select   │  warm channel availability
  └──────────────┘
         │
         ▼
  ┌──────────────┐
  │    Sign      │  Wallet adapter creates credential
  │  Credential  │  (EIP-3009, signed tx, or SIWE message)
  └──────────────┘
         │
         ▼
  ┌──────────────┐
  │    Retry     │  Re-issue request with credential
  │   Request    │  attached as header
  └──────────────┘
         │
         ▼
       Done
```

## Configuration

mindwallet can be configured entirely through environment variables — no config file required.

```bash
# Private key wallet (enables x402 + Tempo + SIWX)
export MINDWALLET_PRIVATE_KEY=0x...
export MINDWALLET_CHAIN_IDS=eip155:8453,eip155:4217

# OWS wallet (SIWX only, production custody)
export MINDWALLET_WALLET_ID=default
export MINDWALLET_VAULT_PATH=~/.minds/wallet/vault

# RPC overrides
export MINDWALLET_RPC_BASE=https://mainnet.base.org
export MINDWALLET_RPC_TEMPO=https://rpc.mainnet.tempo.xyz
```

Resolution order: **env vars > config file > defaults**. See the [env vars guide](docs/docs/guides/env-vars.md) for the full reference.

## Onboarding Paths

### Private key CLI

- Install `mindwallet`
- Set `MINDWALLET_PRIVATE_KEY`
- Run `mindwallet fetch <url>` or `mindwallet pay <url>`

### OWS setup

- Use an existing OWS vault, or bootstrap the repo example in [`examples/ows`](examples/ows)
- Point the CLI at that vault with `CONFIG_PATH` or `MINDWALLET_WALLET_ID` / `MINDWALLET_VAULT_PATH`
- Run `mindwallet wallet` and `mindwallet key create <name>`

### MCP usage

- Start the stdio MCP server with `mindwallet mcp`
- Use the exposed `fetch_with_payment` and `probe_origin` tools from your MCP client

## Project Files

- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)

## Policy Rules

Control what your agent is allowed to spend:

```json
{
  "policy": [
    { "type": "budget", "currency": "USDC", "limit": "1000000", "window": "daily" },
    { "type": "deny-protocol", "protocol": "mpp" },
    { "type": "prefer-protocol", "protocol": "x402", "boost": 0.2 }
  ]
}
```

mindwallet's policy engine is designed for extension. Future capabilities include:

- **Optimization routers** — external scoring services that factor in real-time gas prices, liquidity, and historical success rates across protocols
- **Agent guardrails** — permission boundaries that constrain what URLs, domains, and operations an agent can pay for, preventing confused-deputy attacks and budget overruns
- **Approval workflows** — delegated approval rules where high-value transactions require human sign-off or multi-agent consensus before execution
- **Telemetry and audit** — structured event hooks for every payment decision, enabling dashboards, alerting, and compliance reporting

## Development

This monorepo uses Bun for local development and verification. End users can still install the published CLI and SDK packages with `npm`.

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run all tests
bun run test

# Typecheck
bun run typecheck

# Run docs site locally
cd docs && bun run start
```

## License

MIT
