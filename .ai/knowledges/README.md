# Mindwallet Knowledge Index

This directory contains reusable operator and implementation reference material for `mindwallet`.

## Available Docs

### [01_mindwallet_cli_usage_guide.md](./01_mindwallet_cli_usage_guide.md)

Start here for:

- CLI command overview
- operator-facing usage examples
- command behavior and output expectations
- current CLI limitations

### [02_mindwallet_config_and_wallet_modes.md](./02_mindwallet_config_and_wallet_modes.md)

Use this for:

- config file structure
- supported env vars
- OWS vs private-key mode behavior
- defaults, policy fields, and RPC settings

### [03_mindwallet_mcp_and_agent_usage.md](./03_mindwallet_mcp_and_agent_usage.md)

Use this for:

- MCP server usage
- agent integration patterns
- available MCP tools
- wallet behavior in agent-facing mode

## Recommended Reading Order

For general usage:

1. `01_mindwallet_cli_usage_guide.md`
2. `02_mindwallet_config_and_wallet_modes.md`

For agent or MCP integrations:

1. `01_mindwallet_cli_usage_guide.md`
2. `02_mindwallet_config_and_wallet_modes.md`
3. `03_mindwallet_mcp_and_agent_usage.md`

## Important Current Caveat

The config layer supports `MINDWALLET_*` env var parsing through `resolveConfig()`, but the current CLI entrypoint still loads config with `loadConfig()` directly.

Until that is updated, treat:

- config files as the primary CLI configuration mechanism
- env-var merging as supported in the config library and tests, not yet fully wired into the CLI binary
