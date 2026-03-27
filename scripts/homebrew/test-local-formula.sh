#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMPDIR="$(mktemp -d)"
ARCHIVE="$TMPDIR/mindwallet-local.tar.gz"
VERSION="$(node -p "require('$ROOT/packages/cli/package.json').version")"
TAP_NAME="local/mindwallet-test-$$"
TAP_DIR="$(brew --repository)/Library/Taps/local/homebrew-mindwallet-test-$$"

cleanup() {
  rm -rf "$TMPDIR"
  if brew list --formula mindwallet >/dev/null 2>&1; then
    brew uninstall --force mindwallet >/dev/null 2>&1 || true
  fi
  if brew tap | grep -qx "$TAP_NAME"; then
    brew untap "$TAP_NAME" >/dev/null 2>&1 || true
  else
    rm -rf "$TAP_DIR"
  fi
}
trap cleanup EXIT

tar \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.wrangler' \
  --exclude='.DS_Store' \
  -czf "$ARCHIVE" \
  -C "$ROOT" .

SHA256="$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')"
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_ENV_HINTS=1

brew tap oven-sh/bun >/dev/null
brew tap-new --no-git "$TAP_NAME" >/dev/null
node "$ROOT/scripts/homebrew/publish-tap.mjs" \
  --version "$VERSION" \
  --url "file://$ARCHIVE" \
  --sha256 "$SHA256" \
  --tap-path "$TAP_DIR"

brew uninstall --force mindwallet >/dev/null 2>&1 || true
brew install --build-from-source "$TAP_NAME/mindwallet"

mindwallet --version
mindwallet help
brew test mindwallet
