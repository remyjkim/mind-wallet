---
title: "mindpass CLI"
description: "CLI commands, MCP server, and configuration reference."
date: 2026-03-27
order: 3
---

CLI and MCP server that wires all `@mindpass/*` packages together.

## Commands

### fetch

Make a paid HTTP request:

```bash
mindpass fetch https://api.example.com/data
mindpass fetch https://api.example.com/data --verbose
mindpass fetch https://api.example.com/data --method POST
```

### pay

Probe first, then pay:

```bash
mindpass pay https://api.example.com/data
mindpass pay https://api.example.com/data --verbose
```

### discover

Probe an origin for payment requirements:

```bash
mindpass discover https://api.example.com
mindpass discover https://api.example.com --json
```

### search

Search the registry for paid APIs:

```bash
mindpass search "weather data"
mindpass search "weather data" --json
```

### wallet

Inspect an existing OWS wallet:

```bash
mindpass wallet
```

### key

Manage OWS agent keys:

```bash
mindpass key create my-agent
mindpass key list
mindpass key revoke <key-id>
```

### mcp

Start the MCP server:

```bash
mindpass mcp
```

### version

Print the installed CLI version:

```bash
mindpass --version
```

## Configuration

See the [Guides](/docs/02-guides) page for environment variables and private key wallet setup.
