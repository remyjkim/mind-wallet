# mindpass

CLI and MCP server for payment-gated HTTP APIs across SIWX, x402, and Tempo-compatible flows.

## Install

```bash
brew tap remyjkim/mindpass
brew install mindpass
```

Alternate install path:

```bash
npm install -g mindpass-cli
```

## Commands

```bash
mindpass wallet
mindpass fetch <url>
mindpass pay <url>
mindpass discover <origin>
mindpass search <query>
mindpass key list
mindpass key create <name>
mindpass key revoke <id>
mindpass mcp
```

## Quick Start

```bash
export MINDPASS_PRIVATE_KEY=0x...
mindpass fetch https://api.example.com/data
```

## MCP

```bash
mindpass mcp
```

This starts the stdio MCP server and exposes:

- `fetch_with_payment`
- `probe_origin`

See the root repo for docs, examples, and configuration details:
https://github.com/remyjkim/mindpass
