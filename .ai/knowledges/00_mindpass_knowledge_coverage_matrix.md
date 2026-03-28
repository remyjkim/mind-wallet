# Mindpass Knowledge Coverage Matrix

**Category**: Meta
**Tags**: docs, coverage, audit, knowledge
**Last Updated**: 2026-03-27

---

## Coverage Matrix

| Surface | Source of truth | Covered now? | Target doc |
| --- | --- | --- | --- |
| CLI commands and flags | `packages/cli/src/cli.ts` | yes | `01_mindpass_cli_usage_guide.md` |
| Config and wallet modes | `packages/cli/src/config.ts`, `packages/cli/src/router-from-config.ts`, `packages/discovery/src/registry.ts` | yes | `02_mindpass_config_and_wallet_modes.md` |
| MCP tools and responses | `packages/cli/src/mcp-server.ts` | yes | `03_mindpass_mcp_and_agent_usage.md` |
| Install and distribution | `README.md`, `packages/cli/package.json`, `packaging/homebrew/*` | yes | `04_mindpass_install_and_distribution.md` |
| Package API surface | `packages/core/src/index.ts`, `packages/protocols/src/index.ts`, `packages/discovery/src/index.ts` | yes | `05_mindpass_package_api_guide.md` |

## Known Gaps Closed In This Refresh

- stale legacy product naming across the knowledge set
- missing install and distribution guidance
- missing package API guidance
- missing `@mindpass/discovery` audit and hub-registry coverage
- stale config path and env-var prefixes

## Inclusion Rules

The knowledge set should explicitly cover:

- the `mindpass` CLI command surface
- the `mindpass-cli` npm package
- the public `@mindpass/*` packages
- supported configuration and wallet modes
- MCP agent workflows
- public install and distribution paths

The knowledge set may omit:

- private test-only packages
- contributor-only workflow details that are not part of the public product surface

## Verification Checklist

- no stale legacy product naming remains in `.ai/knowledges`
- install docs match the root README
- package names match `package.json` manifests
- CLI flags match `packages/cli/src/cli.ts`
- config and env vars match `packages/cli/src/config.ts` and `packages/discovery/src/registry.ts`
- MCP tool names and payloads match `packages/cli/src/mcp-server.ts`
- discovery package coverage includes `searchHubRegistry` and audit helpers
