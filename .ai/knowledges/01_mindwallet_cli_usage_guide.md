# Mindwallet CLI Usage Guide

**Category**: Reference
**Tags**: cli, usage, wallet, payments, operators
**Last Updated**: 2026-03-26
**References**: `packages/cli/src/cli.ts`, `packages/cli/src/commands/fetch.ts`, `packages/cli/src/commands/pay.ts`, `packages/cli/src/commands/key.ts`, `packages/cli/src/commands/wallet.ts`

---

## Overview

`mindwallet` is a CLI for interacting with payment-gated HTTP services and for running the same functionality as an MCP server.

Today it supports:

- Inspecting an OWS wallet vault
- Fetching a URL with automatic HTTP 402 handling
- Probing a URL before paying
- Discovering payment requirements without paying
- Searching the Bazaar registry for payment-enabled origins
- Managing OWS API keys
- Running an MCP server over stdio

At the router layer, the project supports two wallet modes:

- OWS vault mode
- Raw EVM private key mode

The CLI binary itself is still partly config-file-oriented. See the caveat in `Current State` below before relying on `MINDWALLET_*` env vars from the shell.

## Current State

### What the CLI binary definitely uses today

- `CONFIG_PATH` to override the config file path
- `OWS_PASSPHRASE` for OWS-backed signing and key management
- `MINDWALLET_REGISTRY_URL` for registry search

### Important caveat

The library exports `resolveConfig()` and `readEnvOverrides()`, but the current CLI entrypoint in `packages/cli/src/cli.ts` still calls `loadConfig()` directly.

Implication:

- `MINDWALLET_PRIVATE_KEY`
- `MINDWALLET_CHAIN_IDS`
- `MINDWALLET_WALLET_ID`
- `MINDWALLET_VAULT_PATH`
- `MINDWALLET_RPC_*`
- `MINDWALLET_TEMPO_GAS`

are supported by the config library and tests, but are not yet automatically merged by the `mindwallet` binary unless the CLI entrypoint is updated to use `resolveConfig()`.

For now, shell users should assume:

- config file based usage is the safe path for CLI commands
- direct library consumers can use `resolveConfig()`

## Command Surface

### `mindwallet wallet`

Shows wallet accounts from the configured OWS vault.

Behavior:

- Defaults wallet ID to `default`
- Defaults vault path to `~/.minds/wallet/vault`
- Uses OWS APIs directly

Example:

```bash
mindwallet wallet
```

### `mindwallet fetch <url>`

Fetches a URL and lets the payment router handle HTTP 402 challenges automatically.

Useful when:

- you want the final response body
- you do not need the explicit probe output first

Options:

- `--verbose`
- `--method <METHOD>`

Examples:

```bash
mindwallet fetch https://api.example.com/resource
mindwallet fetch https://api.example.com/resource --verbose
mindwallet fetch https://api.example.com/resource --method POST
```

### `mindwallet pay <url>`

Probes the URL first, prints discovered candidates in verbose mode, then pays and fetches.

Useful when:

- you want visibility into which protocol/method is being selected
- you want better operator feedback before the paid request

Option:

- `--verbose`

Examples:

```bash
mindwallet pay https://api.example.com/resource
mindwallet pay https://api.example.com/resource --verbose
```

### `mindwallet discover <origin>`

Probes an origin without paying and prints parsed payment candidates.

Important limitation:

- the CLI path currently instantiates discovery with `createSiwxMethod()` only
- this means CLI `discover` currently favors SIWX detection, not the full private-key router stack

Example:

```bash
mindwallet discover https://api.example.com
```

### `mindwallet search <query>`

Searches the Bazaar registry for matching origins.

Options:

- `--protocol <proto>`

Examples:

```bash
mindwallet search images
mindwallet search maps --protocol x402
mindwallet search agents --protocol siwx
```

### `mindwallet key list`

Lists OWS API keys from the vault.

Example:

```bash
mindwallet key list
```

### `mindwallet key create <name>`

Creates an OWS API key and prints the token once.

Option:

- `--expires <iso-date>`

Example:

```bash
mindwallet key create ci-agent
mindwallet key create nightly-bot --expires 2026-12-31T23:59:59Z
```

### `mindwallet key revoke <id>`

Revokes an OWS API key by ID.

Example:

```bash
mindwallet key revoke key_123
```

### `mindwallet mcp`

Starts the MCP server over stdio.

This is the agent-facing mode of mindwallet and exposes:

- `fetch_with_payment`
- `probe_origin`

Example:

```bash
mindwallet mcp
```

## Exit Behavior And Output

### `fetch`

- Writes response body to stdout
- Writes headers/status to stderr in verbose mode

### `pay`

- Writes response body to stdout
- Writes probe details to stderr in verbose mode
- Sets `process.exitCode = 1` when the target is unreachable

### `discover`

- Prints a human-readable payment summary
- Does not perform payment

### `search`

- Prints matching origins and protocols
- Prints `No results found.` on empty result sets

## Operational Recommendations

### Use `fetch` when

- you want the simplest operator experience
- you do not care which candidate was selected

### Use `pay` when

- you are debugging payment behavior
- you want visibility into protocol selection

### Use `discover` when

- you are checking whether a target is gated at all
- you want a read-only probe

### Use `mcp` when

- an agent or MCP-compatible client should make paid requests through mindwallet

## Known Limitations

- CLI env-var merging for `MINDWALLET_*` is not fully wired into the binary yet
- CLI `discover` currently uses SIWX-only discovery methods
- OWS key management commands are OWS-specific and do not apply to private-key mode
- Tempo live usage depends on a working RPC and compatible chain configuration
