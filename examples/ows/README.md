# OWS Example

This example bootstraps a disposable local OWS vault and runs a small app that imports the `mindpass` package directly.

## What it creates

Running setup creates example-local files only:

- `.demo/vault/` — disposable OWS vault
- `.env` — local env file with `CONFIG_PATH` and `OWS_PASSPHRASE`
- `mindpass.config.json` — config file pointing at the local vault

It does not write to your real `~/.config/mindpass` config or your real OWS vault.

## Commands

Install workspace dependencies first:

```bash
bun install
```

Bootstrap the example:

```bash
cd examples/ows
bun run bootstrap
```

Run the example app:

```bash
bun run start
```

Run the example test:

```bash
bun run check
```

## What the app does

The example app:

1. loads the generated `.env`
2. loads `mindpass.config.json` through the `mindpass` package
3. builds a router with `routerFromConfig()`
4. reads the example wallet account and prints a short summary

## Notes

- wallet name: `example-wallet`
- passphrase: `example-passphrase`
- vault path: `examples/ows/.demo/vault`

These values are intentionally disposable and only for local testing.
