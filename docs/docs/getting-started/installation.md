---
sidebar_position: 1
---

# Installation

## CLI (recommended for agents)

```bash
brew install remyjkim/tap/mindwallet
```

Alternate install path:

```bash
npm install -g mindwallet
```

## Library (for SDK consumers)

```bash
# Core selection pipeline + wallet interface
npm install @mindwallet/core

# Protocol implementations (x402, Tempo, SIWX)
npm install @mindwallet/protocols

# Optional: discovery and registry search
npm install @mindwallet/discovery
```

## Requirements

- Node.js >= 20.0
- For OWS wallet mode: `@open-wallet-standard/core` (bundled with CLI)
- For private key mode: `viem` (bundled with CLI)
