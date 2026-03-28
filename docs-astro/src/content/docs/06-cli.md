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

## MCP Server for Claude Code

The `mindpass mcp` command starts a Model Context Protocol server over stdio, letting AI agents make paid requests and probe origins directly.

### Tools Exposed

| Tool | Description |
|------|-------------|
| `fetch_with_payment` | Fetch a URL, automatically handling HTTP 402 payment challenges |
| `probe_origin` | Probe an HTTP origin to discover its payment protocol requirements |

### Setup with Claude Code

**1. Install mindpass globally:**

```bash
brew tap remyjkim/mindpass
brew install mindpass
```

**2. Set your private key:**

```bash
export MINDPASS_PRIVATE_KEY=0x_YOUR_PRIVATE_KEY_HERE
```

**3. Add to your Claude Code MCP config:**

Add the following to your `~/.claude/claude_desktop_config.json` (or your project's `.mcp.json`):

```json
{
  "mcpServers": {
    "mindpass": {
      "command": "mindpass",
      "args": ["mcp"],
      "env": {
        "MINDPASS_PRIVATE_KEY": "0x_YOUR_PRIVATE_KEY_HERE"
      }
    }
  }
}
```

That's it. Claude Code will now have access to `fetch_with_payment` and `probe_origin` tools, enabling it to call paid APIs and discover payment requirements on your behalf.

### Usage Examples

Once connected, Claude Code can:

- **Fetch paid content:** "Fetch the data from https://api.example.com/premium-endpoint"
- **Discover payment requirements:** "What payment protocols does https://api.example.com support?"

## Configuration

See the [Guides](/docs/02-guides) page for environment variables and private key wallet setup.
