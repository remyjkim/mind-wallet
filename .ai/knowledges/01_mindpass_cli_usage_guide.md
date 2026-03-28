# Mindpass CLI Usage Guide

**Category**: Reference
**Tags**: cli, usage, wallet, payments, operators
**Last Updated**: 2026-03-27
**References**: `packages/cli/src/cli.ts`, `packages/cli/README.md`, `README.md`

---

## Overview

`mindpass` is the operator-facing CLI for interacting with payment-gated HTTP services and for starting the same payment-aware functionality as an MCP server.

Current install surfaces:

- Homebrew native install:

```bash
brew tap remyjkim/mindpass
brew install mindpass
```

- npm CLI install:

```bash
npm install -g mindpass-cli
```

The installed binary name is `mindpass` in both cases.

## Command Surface

Current top-level commands:

- `mindpass wallet`
- `mindpass fetch <url>`
- `mindpass pay <url>`
- `mindpass discover <origin>`
- `mindpass search <query>`
- `mindpass key list`
- `mindpass key create <name>`
- `mindpass key revoke <key-id>`
- `mindpass mcp`
- `mindpass --version`
- `mindpass help`

Help aliases:

- `help`
- `--help`
- `-h`
- `--version`
- `-V`

## Command Details

### `mindpass wallet`

Shows wallet accounts from the configured OWS vault.

Behavior:

- uses resolved config from `resolveConfig()`
- defaults wallet ID to `default`
- defaults vault path to `~/.minds/wallet/vault`
- is OWS-specific and not a private-key workflow

Example:

```bash
mindpass wallet
```

### `mindpass fetch <url>`

Fetches a URL and lets the payment router handle HTTP 402 challenges automatically.

Options:

- `--verbose` or `-v`
- `--method <METHOD>`

Examples:

```bash
mindpass fetch https://api.example.com/resource
mindpass fetch https://api.example.com/resource --verbose
mindpass fetch https://api.example.com/resource --method POST
```

Output behavior:

- writes the final response body to stdout
- writes status and payment context to stderr in verbose mode

### `mindpass pay <url>`

Probes first, then pays and fetches.

Use this when:

- you want more operator visibility before the paid request
- you are debugging protocol selection or challenge shape

Options:

- `--verbose` or `-v`

Examples:

```bash
mindpass pay https://api.example.com/resource
mindpass pay https://api.example.com/resource --verbose
```

Output behavior:

- writes the final response body to stdout
- writes probe details to stderr in verbose mode
- sets `process.exitCode = 1` when the target is unreachable

### `mindpass discover <origin>`

Probes an origin without paying and prints discovered payment candidates.

Options:

- `--json`

Behavior:

- uses the resolved wallet/config mode to choose discovery methods
- OWS mode sees SIWX candidates
- private-key mode can detect SIWX, x402, and Tempo-compatible challenges

Examples:

```bash
mindpass discover https://api.example.com
mindpass discover https://api.example.com --json
```

### `mindpass search <query>`

Searches the configured registry for matching origins.

Options:

- `--protocol <proto>`
- `--json`

Examples:

```bash
mindpass search images
mindpass search maps --protocol x402
mindpass search agents --protocol siwx --json
```

Output behavior:

- prints matching origins and protocols
- prints `No results found.` on empty result sets in text mode

### `mindpass key list`

Lists OWS API keys from the vault.

Example:

```bash
mindpass key list
```

### `mindpass key create <name>`

Creates an OWS API key and prints the token once.

Options:

- `--expires <iso-date>`

Examples:

```bash
mindpass key create ci-agent
mindpass key create nightly-bot --expires 2026-12-31T23:59:59Z
```

### `mindpass key revoke <key-id>`

Revokes an OWS API key by ID.

Example:

```bash
mindpass key revoke key_123
```

### `mindpass mcp`

Starts the MCP server over stdio.

This exposes:

- `fetch_with_payment`
- `probe_origin`

Example:

```bash
mindpass mcp
```

### `mindpass --version`

Prints the installed CLI version.

Example:

```bash
mindpass --version
```

## Wallet-Mode Applicability

### OWS mode is required for

- `wallet`
- `key list`
- `key create`
- `key revoke`

### Private-key mode is strongest for

- `fetch`
- `pay`
- `discover`
- `search`
- `mcp`

Private-key mode enables SIWX, x402, and Tempo methods. OWS mode is effectively SIWX-only.

## Operator Workflows

### Fastest private-key path

```bash
export MINDPASS_PRIVATE_KEY=0x...
mindpass fetch https://paid-api.example.com/data
```

### OWS vault inspection path

```bash
export MINDPASS_WALLET_ID=default
export MINDPASS_VAULT_PATH=~/.minds/wallet/vault
mindpass wallet
mindpass key list
```

### Registry and probe-first troubleshooting

```bash
mindpass search maps --json
mindpass discover https://api.example.com --json
mindpass pay https://api.example.com --verbose
```

### Sanity checks after install

```bash
mindpass --version
mindpass help
```

## Current Limitations

- OWS key-management commands do not apply to private-key mode
- Tempo live usage depends on a working RPC URL and compatible chain configuration
- `discover` and `mcp` only expose methods available from the resolved wallet mode
