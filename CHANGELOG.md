# Changelog

All notable changes to this project should be documented in this file.

## 0.2.0

### Packaging

- added a native CLI build pipeline based on `bun build --compile`
- added lazy and explicit OWS native-addon loading for compiled binaries
- added a Homebrew formula template, local formula verification script, and tap publishing helper
- added release workflows for native artifacts and checksum generation
- made Homebrew the primary documented CLI install path, with npm retained as a fallback

## 0.1.1

### CLI

- added env-backed config resolution in the binary entrypoint
- added black-box binary UX coverage
- added `--version`
- added `--json` output for `discover` and `search`
- improved binary discovery to follow the resolved wallet mode

### Docs and packaging

- aligned README and docs with the actual CLI surface
- added package metadata for public npm consumption
- added package-level READMEs
- added OSS trust files and contributor guidance

## 0.1.0

### Initial packages

- `@mindpass/core`
- `@mindpass/protocols`
- `@mindpass/discovery`

### Initial CLI

- `mindpass` CLI and MCP server
- OWS and private-key wallet support
- SIWX, x402, and Tempo-capable routing
