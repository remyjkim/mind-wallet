---
title: "MCP Server"
description: "Connect mindpass to Claude Code and other AI agents via MCP."
date: 2026-03-27
order: 4
---

The `mindpass mcp` command starts a Model Context Protocol server over stdio, letting AI agents make paid requests and probe origins directly.

## Tools

| Tool | Description |
|------|-------------|
| `fetch_with_payment` | Fetch a URL, automatically handling HTTP 402 payment challenges |
| `probe_origin` | Probe an HTTP origin to discover its payment protocol requirements |

## Setup with Claude Code

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

## Usage Examples

Once connected, Claude Code can:

- **Fetch paid content:** "Fetch the data from https://api.example.com/premium-endpoint"
- **Discover payment requirements:** "What payment protocols does https://api.example.com support?"
