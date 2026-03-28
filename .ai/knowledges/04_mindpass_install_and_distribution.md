# Mindpass Install And Distribution Guide

**Category**: Reference
**Tags**: install, distribution, brew, npm, packages
**Last Updated**: 2026-03-27
**References**: `README.md`, `packages/cli/package.json`, `packages/core/package.json`, `packages/protocols/package.json`, `packages/discovery/package.json`, `packaging/homebrew/README.md`, `packaging/homebrew/mindpass.rb`

---

## Overview

Mindpass has two primary operator install paths and three public library packages.

User-facing names differ slightly by channel:

- installed binary: `mindpass`
- npm CLI package: `mindpass-cli`
- public library packages:
  - `@mindpass/core`
  - `@mindpass/protocols`
  - `@mindpass/discovery`

## Preferred Native Install

Homebrew is the preferred operator install path.

```bash
brew tap remyjkim/mindpass
brew install mindpass
```

What this gives you:

- native `mindpass` executable
- no npm or node runtime dependency for end users
- OWS native addon placement handled by the formula

The formula source lives in:

- `packaging/homebrew/mindpass.rb`

## Alternate CLI Install

If Homebrew is not the right fit, install the CLI package from npm:

```bash
npm install -g mindpass-cli
```

What this gives you:

- the same `mindpass` command
- distribution through npm instead of Homebrew
- a package-manager based install rather than a native bottled/source install

## Library Install

For embedding mindpass behavior inside your own application, install the public libraries directly:

```bash
npm install @mindpass/core @mindpass/protocols @mindpass/discovery
```

Typical combinations:

- `@mindpass/core` + `@mindpass/protocols` for full router and paid-fetch embedding
- `@mindpass/discovery` when you only need probing, registry search, hub search, or audit helpers

## Choosing The Right Path

### Choose Homebrew when

- you want the simplest operator install
- you want the native `mindpass` binary
- you do not want npm or node as a runtime dependency

### Choose npm CLI when

- your environment already standardizes on npm
- Homebrew is unavailable or undesirable
- you still want the `mindpass` command rather than embedding libraries

### Choose direct library dependencies when

- you are building your own app or service
- you want to call `wrapFetch()`, `createRouter()`, or discovery helpers directly
- you do not need the packaged CLI UX

## Published Package Names

Current public names:

- `mindpass-cli`
- `@mindpass/core`
- `@mindpass/protocols`
- `@mindpass/discovery`

Current binary name:

- `mindpass`

Important distinction:

- users run `mindpass`
- npm installs `mindpass-cli`

## Homebrew Packaging Notes

The Homebrew packaging model is:

- build from tagged source with Bun as a build dependency
- compile a standalone `mindpass` executable
- install the matching OWS native addon into `libexec`
- set `MINDPASS_OWS_NATIVE_PATH` in the wrapper script

Verification flow for the live tap:

```bash
brew install --build-from-source remyjkim/mindpass/mindpass
brew test mindpass
brew audit --strict remyjkim/mindpass/mindpass
```

## Quick Install Examples

### Native operator install

```bash
brew tap remyjkim/mindpass
brew install mindpass
mindpass --version
```

### npm CLI install

```bash
npm install -g mindpass-cli
mindpass --version
```

### Library install

```bash
npm install @mindpass/core @mindpass/protocols
```
