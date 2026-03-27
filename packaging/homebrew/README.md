# Homebrew Packaging

This directory is the source of truth for the native `mindwallet` Homebrew packaging work.

## Target Contract

The intended install path is:

```bash
brew install remyjkim/tap/mindwallet
```

The formula should produce a native `mindwallet` executable with no `npm` or `node` runtime dependency for end users.

## Packaging Model

- Homebrew builds from tagged source with Bun as a build dependency.
- The build produces a standalone `mindwallet` executable.
- The build also copies the matching OWS native addon file, `ows-node.*.node`, into `libexec/`.
- The installed wrapper script sets `MINDWALLET_OWS_NATIVE_PATH` so OWS-backed commands can find the addon at runtime.

## Supported Targets

The initial target matrix is:

- macOS arm64
- macOS x64
- Linux x64
- Linux arm64

## Current Status

Native Homebrew packaging is in progress. Do not document `brew install` as a supported public path until the local formula simulation and release automation are both passing.

## Tap Release Flow

The tap workflow is:

1. Build native artifacts from a tagged source release.
2. Generate SHA-256 checksums for the release payloads.
3. Run:

```bash
node scripts/homebrew/publish-tap.mjs \
  --version 0.2.0 \
  --url https://github.com/remyjkim/mind-wallet/archive/refs/tags/v0.2.0.tar.gz \
  --sha256 <source-tarball-sha256> \
  --tap-path /path/to/homebrew-mindwallet
```

4. In the tap repo, run:

```bash
brew audit --strict --formula ./Formula/mindwallet.rb
brew install --build-from-source ./Formula/mindwallet.rb
brew test mindwallet
```
