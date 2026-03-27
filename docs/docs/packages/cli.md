---
sidebar_position: 4
---

# mindwallet CLI

CLI and MCP server that wires all `@mindwallet/*` packages together.

## Commands

### fetch

Make a paid HTTP request:

```bash
mindwallet fetch https://api.example.com/data
mindwallet fetch https://api.example.com/data --verbose
mindwallet fetch https://api.example.com/data --method POST --body '{"query": "hello"}'
```

### pay

Probe first, then pay:

```bash
mindwallet pay https://api.example.com/data
mindwallet pay https://api.example.com/data --verbose
```

### discover

Probe an origin for payment requirements:

```bash
mindwallet discover https://api.example.com
```

### search

Search the registry for paid APIs:

```bash
mindwallet search "weather data"
```

### wallet

Manage OWS wallets:

```bash
mindwallet wallet create
mindwallet wallet list
```

### key

Manage OWS agent keys:

```bash
mindwallet key create --name my-agent
mindwallet key list
mindwallet key revoke <key-id>
```

### serve

Start the MCP server:

```bash
mindwallet serve --transport stdio
```

## Configuration

See [Environment Variables](/docs/guides/env-vars) and [Private Key Wallet](/docs/guides/private-key-wallet) guides.
