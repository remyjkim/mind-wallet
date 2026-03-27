# mindwallet

CLI and MCP server for payment-gated HTTP APIs across SIWX, x402, and Tempo-compatible flows.

## Install

```bash
npm install -g mindwallet
```

## Commands

```bash
mindwallet wallet
mindwallet fetch <url>
mindwallet pay <url>
mindwallet discover <origin>
mindwallet search <query>
mindwallet key list
mindwallet key create <name>
mindwallet key revoke <id>
mindwallet mcp
```

## Quick Start

```bash
export MINDWALLET_PRIVATE_KEY=0x...
mindwallet fetch https://api.example.com/data
```

## MCP

```bash
mindwallet mcp
```

This starts the stdio MCP server and exposes:

- `fetch_with_payment`
- `probe_origin`

See the root repo for docs, examples, and configuration details:
https://github.com/remyjkim/mind-wallet
