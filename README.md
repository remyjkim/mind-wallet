# mindwallet

**Agent payment SDK for the multi-protocol economy.**

AI agents need to pay for APIs, authenticate their identity, and manage budgets — all without human intervention. Today's payment landscape is fragmented across competing protocols (x402, MPP/Tempo, SIWX), each with different challenge formats, credential types, and signing requirements. An agent that works with one protocol is blind to the others.

mindwallet solves this by wrapping `fetch()` with an intelligent payment layer that automatically detects, evaluates, and resolves HTTP 402 challenges across all major agent payment protocols. Your agent writes `fetch(url)` and mindwallet handles the rest — protocol detection, candidate scoring, policy enforcement, credential signing, and retry.

```typescript
import { createRouter, wrapFetch, createMemoryStore, PrivateKeyWalletAdapter } from '@mindwallet/core';
import { createSiwxMethod, createX402Method, createTempoMethod } from '@mindwallet/protocols';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');
const wallet = new PrivateKeyWalletAdapter({ privateKey: '0x...' });
const state = createMemoryStore();
const methods = [createSiwxMethod(), createX402Method({ account }), createTempoMethod({ account, store: state })];
const router = createRouter({ methods, state, policy: [] });

// Drop-in fetch replacement — handles 402s automatically
const paidFetch = wrapFetch({ fetch, router, state, wallet });
const response = await paidFetch('https://paid-api.example.com/data');
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

# OWS vault mode (production custody)
mindwallet wallet create
mindwallet key create --name my-agent
mindwallet fetch https://paid-api.example.com/data
```

### MCP Server (for AI agents)

```bash
# Expose mindwallet as MCP tools for your AI agent
mindwallet serve --transport stdio
```

Tools: `fetch_with_payment`, `probe_origin`

### Library

```bash
npm install @mindwallet/core @mindwallet/protocols
```

```typescript
const paidFetch = wrapFetch({ fetch, router, state, wallet });

// That's it. Use paidFetch exactly like fetch().
const res = await paidFetch('https://api.example.com/data');
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

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Typecheck
pnpm typecheck

# Run docs site locally
cd docs && npm install && npm start
```

## License

MIT
