# Mindwallet MCP And Agent Usage

**Category**: Reference
**Tags**: mcp, agents, stdio, payments, integration
**Last Updated**: 2026-03-26
**References**: `packages/cli/src/mcp-server.ts`, `packages/cli/src/router-from-config.ts`, `packages/cli/src/commands/fetch.ts`, `packages/cli/src/commands/pay.ts`

---

## Overview

Mindwallet can run as an MCP server over stdio.

This lets an agent use mindwallet as a payment-aware network tool without reimplementing:

- payment challenge parsing
- credential selection
- wallet-backed signing
- payment retries

The MCP server is a thin wrapper over the same router and wrapped fetch path used by the CLI commands.

## Starting The MCP Server

```bash
mindwallet mcp
```

It exposes tools over stdio using `@modelcontextprotocol/sdk`.

## Exposed Tools

### `fetch_with_payment`

Purpose:

- fetch a URL
- automatically handle HTTP 402 payment challenges

Arguments:

```json
{
  "url": "https://api.example.com/resource",
  "method": "GET",
  "headers": {
    "Accept": "application/json"
  },
  "body": "optional request body"
}
```

Behavior:

- returns normal response body on success
- returns `isError: true` with `HTTP <status>` text on non-OK response

### `probe_origin`

Purpose:

- inspect whether a target requires payment
- return normalized candidate summaries without actually paying

Arguments:

```json
{
  "url": "https://api.example.com/resource"
}
```

Response summary fields:

- `url`
- `requires402`
- `candidates[].protocol`
- `candidates[].method`
- `candidates[].intent`
- `candidates[].amount`
- `candidates[].currency`

## Wallet Behavior In MCP Mode

The MCP server uses `routerFromConfig()`, so wallet behavior matches the configured mode.

### OWS mode

Methods:

- `siwx`

Use when:

- the agent should rely on an OWS vault

### Private key mode

Methods:

- `siwx`
- `x402`
- `tempo`

Use when:

- the agent must interact with x402 endpoints
- the agent must interact with Tempo-gated endpoints

## Suggested Agent Workflows

### Safe exploration first

1. Call `probe_origin`
2. Inspect returned candidates
3. Call `fetch_with_payment` only when the target looks correct

### Direct paid fetch

Use `fetch_with_payment` directly when:

- the target is known and trusted
- you want the final body with minimal orchestration

## Example MCP Usage Pattern

### Probe first

```json
{
  "name": "probe_origin",
  "arguments": {
    "url": "https://api.example.com/data"
  }
}
```

### Then fetch

```json
{
  "name": "fetch_with_payment",
  "arguments": {
    "url": "https://api.example.com/data",
    "method": "GET"
  }
}
```

## Operational Notes

### Error handling

`fetch_with_payment` does not hide HTTP errors. It surfaces them in tool output so the agent can reason about:

- 402 payment failures
- 500 server errors
- transport failures

### Tooling boundary

The MCP server does not expose wallet administration commands.

It only exposes:

- fetch with payment
- payment probing

### Private-key MCP is currently the strongest test-covered agent path

The repo has integration coverage for:

- private-key x402 through MCP
- local Tempo challenge discovery through MCP
- live Tempo payment through MCP with real RPC and private key

That makes private-key mode the most complete agent-focused path today.

## Known Caveats

- The CLI entrypoint config caveat still applies: operator-launched `mindwallet mcp` currently depends on config-file loading unless the entrypoint is updated to call `resolveConfig()`.
- Tempo live usage requires a compatible RPC URL and signer configuration.
- OWS key-management workflows are outside the MCP surface.
