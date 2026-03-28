# Mindpass MCP And Agent Usage

**Category**: Reference
**Tags**: mcp, agents, stdio, payments, integration
**Last Updated**: 2026-03-27
**References**: `packages/cli/src/mcp-server.ts`, `packages/cli/src/router-from-config.ts`

---

## Overview

Mindpass can run as an MCP server over stdio.

This lets an agent use `mindpass` as a payment-aware network tool without reimplementing:

- payment challenge parsing
- candidate selection
- wallet-backed signing
- payment retries

The MCP server is a thin wrapper over the same router and wrapped-fetch path used by the CLI.

## Starting The MCP Server

```bash
mindpass mcp
```

The registered MCP server name is `mindpass`.

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

- returns the response body as text on success
- includes `mimeType` when the response declares a content type
- returns `isError: true` with `HTTP <status> <statusText>` text on non-OK responses

### `probe_origin`

Purpose:

- inspect whether a target requires payment
- return normalized candidate summaries without paying

Arguments:

```json
{
  "url": "https://api.example.com/resource"
}
```

Success response fields:

- `url`
- `requires402`
- `candidates[].protocol`
- `candidates[].method`
- `candidates[].intent`
- `candidates[].amount`
- `candidates[].currency`

Unreachable behavior:

- returns `isError: true`
- payload text starts with `Unreachable:`

## Wallet Behavior In MCP Mode

The MCP server uses `routerFromConfig()`, so wallet behavior matches the configured mode.

### OWS mode

Methods:

- `siwx`

Use when:

- the agent should rely on an OWS vault
- you need custody to stay with an existing vault setup

### Private-key mode

Methods:

- `siwx`
- `x402`
- `tempo`

Use when:

- the agent must interact with x402 endpoints
- the agent must interact with Tempo-gated endpoints
- you want the strongest currently tested agent flow

## Suggested Agent Workflows

### Safe exploration first

1. Call `probe_origin`
2. Inspect returned candidates
3. Call `fetch_with_payment` only when the target looks correct

### Direct paid fetch

Use `fetch_with_payment` directly when:

- the target is known and trusted
- you want the final response body with minimal orchestration

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

`fetch_with_payment` surfaces HTTP failures so the agent can reason about:

- 402 payment failures
- 4xx request errors
- 5xx upstream failures

### Tooling boundary

The MCP server does not expose wallet administration commands.

It only exposes:

- fetch with payment
- payment probing

OWS wallet inspection and API key management remain CLI-only workflows.

### Config startup behavior

Operator-launched `mindpass mcp` resolves configuration through `resolveConfig()`, so env vars and config files both work for startup.

## Known Caveats

- Tempo live usage requires a compatible RPC URL and signer configuration
- OWS mode is SIWX-only
- wallet administration workflows are outside the MCP surface
