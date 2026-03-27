---
sidebar_position: 1
---

# Installation

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
