#!/usr/bin/env bash
set -euo pipefail

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_ENV_HINTS=1

FORMULA="${1:-remyjkim/mindwallet/mindwallet}"

brew uninstall --force mindwallet >/dev/null 2>&1 || true
brew install --build-from-source "$FORMULA"
brew test mindwallet
brew audit --strict "$FORMULA"
