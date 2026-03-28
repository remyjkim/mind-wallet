# Mindpass Knowledge Index

This directory contains reusable operator and implementation reference material for `mindpass`.

## Available Docs

### [00_mindpass_knowledge_coverage_matrix.md](./00_mindpass_knowledge_coverage_matrix.md)

Start here for:

- the current documentation coverage map
- source-of-truth files for each product surface
- known inclusion boundaries for the knowledge set
- final verification criteria for knowledge-doc updates

### [01_mindpass_cli_usage_guide.md](./01_mindpass_cli_usage_guide.md)

Use this for:

- CLI command overview
- operator-facing usage examples
- command flags and output behavior
- command applicability across private-key and OWS modes

### [02_mindpass_config_and_wallet_modes.md](./02_mindpass_config_and_wallet_modes.md)

Use this for:

- config file structure
- supported env vars
- OWS vs private-key mode behavior
- defaults, policy fields, registry settings, and RPC settings

### [03_mindpass_mcp_and_agent_usage.md](./03_mindpass_mcp_and_agent_usage.md)

Use this for:

- MCP server startup and usage
- agent integration patterns
- available MCP tools and response shapes
- wallet behavior in agent-facing mode

### [04_mindpass_install_and_distribution.md](./04_mindpass_install_and_distribution.md)

Use this for:

- Homebrew installation
- npm CLI installation
- package naming across `mindpass`, `mindpass-cli`, and `@mindpass/*`
- choosing brew vs npm vs library dependencies

### [05_mindpass_package_api_guide.md](./05_mindpass_package_api_guide.md)

Use this for:

- public package surfaces
- `@mindpass/core`, `@mindpass/protocols`, and `@mindpass/discovery`
- exported factories and helpers
- when to embed the libraries instead of using the CLI

## Recommended Reading Order

For CLI and operator usage:

1. `00_mindpass_knowledge_coverage_matrix.md`
2. `01_mindpass_cli_usage_guide.md`
3. `02_mindpass_config_and_wallet_modes.md`
4. `04_mindpass_install_and_distribution.md`

For agent and MCP integrations:

1. `00_mindpass_knowledge_coverage_matrix.md`
2. `02_mindpass_config_and_wallet_modes.md`
3. `03_mindpass_mcp_and_agent_usage.md`
4. `05_mindpass_package_api_guide.md`

For library embedding and package-level work:

1. `00_mindpass_knowledge_coverage_matrix.md`
2. `04_mindpass_install_and_distribution.md`
3. `05_mindpass_package_api_guide.md`
4. `02_mindpass_config_and_wallet_modes.md`

## Current Boundary

The knowledge set is intended to cover the full public `mindpass` surface:

- the `mindpass` binary
- the `mindpass-cli` npm package
- the public `@mindpass/core`, `@mindpass/protocols`, and `@mindpass/discovery` packages
- configuration and wallet modes
- Homebrew, npm, and library install paths

It does not need to document private contributor-only internals such as `@mindpass/test-server` unless those become part of a documented external workflow.
