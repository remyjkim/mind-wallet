# Contributing

Thanks for contributing to `mindwallet`.

## Local Setup

```bash
bun install
```

Useful commands:

```bash
bun run check
bun run --filter mindwallet check
cd docs && bun run build
```

## Development Expectations

- Keep public docs truthful. If a command, flag, or example changes, update the docs in the same change.
- Add or update tests for behavior changes.
- Prefer small, reviewable commits grouped by purpose.
- Do not commit secrets, private keys, or real paid-service credentials.

## Pull Requests

Before opening a PR:

1. Run the relevant package checks.
2. Run `bun run check` if the change spans packages.
3. Build the docs site if any public docs changed.
4. Review README and docs examples for copy-paste accuracy.

## Release Notes

User-facing changes should be reflected in the changelog and any relevant docs before release.

## Versioning

- keep package versions and changelog entries aligned
- document user-visible CLI and API changes in `CHANGELOG.md`
- verify release contents with `npm pack --dry-run` before publishing
- use Bun for development workflows and `npm publish` / `npm pack --dry-run` for release packaging
