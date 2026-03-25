Practical manual for using **OWS / Open Wallet Standard on a local machine**, with an emphasis on **safe local usage**, **CLI + SDK workflows**, and **how to control where wallet data is stored**. OWS is designed as a **local-first wallet system**: wallets live on your filesystem, keys stay encrypted at rest, policies are checked before agent-token signing, and the default vault location is `~/.ows/`. ([docs.openwallet.sh][1])

## 1) What OWS is good at on a local machine

OWS is best thought of as a **local encrypted wallet vault plus a signing interface**. It gives you one place on disk for wallets, policies, API keys, and logs; then you can use the CLI, Node SDK, or Python SDK against that vault. The official docs position it for local wallet storage, delegated agent access, and policy-gated signing across multiple chain families. ([docs.openwallet.sh][1])

For local use, there are really three common modes:

1. **CLI-first** for manual wallet management and ad hoc signing.
2. **Node SDK** for apps, bots, and local services in JavaScript/TypeScript.
3. **Python SDK** for automation, scripts, and agent workflows in Python. ([GitHub][2])

## 2) Installation options

The official install options are:

```bash
# All-in-one installer
curl -fsSL https://docs.openwallet.sh/install.sh | bash
```

Or install only what you need:

```bash
# Node SDK
npm install @open-wallet-standard/core

# Node SDK + CLI
npm install -g @open-wallet-standard/core

# Python SDK
pip install open-wallet-standard

# Build from source
git clone https://github.com/open-wallet-standard/core.git
cd core/ows
cargo build --workspace --release
```

The reference repo says the Node package embeds the Rust core via native bindings, and the Python package does the same via PyO3. Prebuilt binaries/wheels are documented for macOS and Linux in the SDK docs. ([GitHub][3])

## 3) Where OWS stores data by default

The storage spec defines a **vault directory** rooted at `~/.ows/`. Inside it, OWS stores:

* `wallets/*.json` for encrypted wallet files
* `keys/*.json` for API-key files
* `policies/*.json` for policy definitions
* `logs/audit.jsonl` for audit logs
* `config.json` for global configuration ([GitHub][4])

The spec also defines filesystem permissions. In particular, `wallets/` and `keys/` are expected to be owner-only (`700` dirs, `600` files), and implementations are supposed to refuse operation if those secret-bearing directories are too permissive. ([GitHub][4])

A quick way to inspect the active vault from the CLI is:

```bash
ows wallet info
```

The CLI reference says this command shows the vault path and supported chains. ([GitHub][2])

## 4) Can you choose a custom storage location?

Yes, **in the SDKs**. Both official SDK references document a **custom vault directory** parameter:

### Node

Functions such as `createWallet`, `listWallets`, `getWallet`, `deleteWallet`, `importWalletMnemonic`, `importWalletPrivateKey`, `signMessage`, `signTypedData`, and `signTransaction` accept a `vaultPath` argument. The docs describe its default as `~/.ows` and explicitly call it a “Custom vault directory root.” ([GitHub][5])

Example:

```javascript
import { createWallet, listWallets, signMessage } from "@open-wallet-standard/core";

const vaultPath = "/Users/you/secure/ows-prod";

const wallet = createWallet("agent-treasury", undefined, 12, vaultPath);
const wallets = listWallets(vaultPath);
const sig = signMessage("agent-treasury", "evm", "hello", undefined, "utf8", 0, vaultPath);
```

### Python

The Python SDK documents `vault_path` on wallet and signing functions such as `create_wallet`, `list_wallets`, `get_wallet`, `delete_wallet`, `export_wallet`, `import_wallet_mnemonic`, `import_wallet_private_key`, `sign_message`, `sign_typed_data`, and `sign_transaction`. ([GitHub][6])

Example:

```python
from ows import create_wallet, list_wallets, sign_message

vault_path = "/Users/you/secure/ows-prod"

wallet = create_wallet("agent-treasury", vault_path=vault_path)
wallets = list_wallets(vault_path=vault_path)
sig = sign_message("agent-treasury", "evm", "hello", vault_path=vault_path)
print(sig["signature"])
```

### CLI

I **did not find an officially documented CLI flag or environment variable** in the CLI reference that changes the vault root away from `~/.ows`. The CLI docs document the default file layout under `~/.ows`, but the storage override is only explicitly documented in the Node and Python SDK references. ([GitHub][2])

So the most accurate recommendation today is:

* Use **Node/Python SDKs** when you want an **official, documented custom vault path**.
* Use the **CLI** when `~/.ows` is acceptable, or when you are okay managing the location indirectly at the OS level yourself. The indirect OS-level approach is a workaround, not something I found documented as an OWS feature. ([GitHub][2])

## 5) Best local setup patterns

For most people, one of these patterns is ideal.

### Pattern A: personal default vault

Use the CLI and default `~/.ows`. This is the simplest setup for a laptop or workstation used by one person. The storage spec and CLI docs are clearly centered on that default path. ([GitHub][4])

### Pattern B: project-specific vault

Use the SDK and set a `vaultPath`/`vault_path` per project, for example:

* `~/work/project-a/.ows-local`
* `~/work/project-b/.ows-local`
* `/mnt/encrypted/team-wallets/prod`

This is the best fit when you want isolation between projects, environments, or clients. The SDKs explicitly support it. ([GitHub][5])

### Pattern C: split dev and prod vaults

Use separate vault roots such as:

* `/Users/you/.ows-dev`
* `/Users/you/.ows-prod`

and wire your app to the correct one by configuration. Since the SDK API takes the vault path directly, this is easy to enforce in code. ([GitHub][5])

## 6) First-run workflow on a local machine

### A. Create a wallet

CLI:

```bash
ows wallet create --name "my-wallet"
```

The CLI reference says this generates a BIP-39 mnemonic and derives addresses for all supported chains. It also supports `--show-mnemonic` and `--words 12|24`. ([GitHub][2])

Node:

```javascript
import { createWallet } from "@open-wallet-standard/core";

const wallet = createWallet("my-wallet");
console.log(wallet.accounts);
```

Python:

```python
from ows import create_wallet

wallet = create_wallet("my-wallet")
print(wallet["accounts"])
```

The SDK docs say creation derives addresses for the current auto-derived chain set. ([GitHub][5])

### B. List wallets

CLI:

```bash
ows wallet list
```

Node:

```javascript
import { listWallets } from "@open-wallet-standard/core";
console.log(listWallets());
```

Python:

```python
from ows import list_wallets
print(list_wallets())
```

These are all documented reference operations. ([GitHub][2])

### C. Sign a message

CLI:

```bash
ows sign message --wallet "my-wallet" --chain evm --message "hello world"
```

The CLI docs say passphrases and API tokens are provided via `OWS_PASSPHRASE` or via an interactive prompt, not a `--passphrase` flag. ([GitHub][2])

Node:

```javascript
import { signMessage } from "@open-wallet-standard/core";

const result = signMessage("my-wallet", "evm", "hello world");
console.log(result.signature);
```

Python:

```python
from ows import sign_message

result = sign_message("my-wallet", "evm", "hello world")
print(result["signature"])
```

The SDKs document chain-specific formatting for message signing. ([GitHub][2])

## 7) Importing existing wallets

The CLI reference supports import from mnemonic or raw private key, reading secrets from stdin or environment variables such as `OWS_MNEMONIC`, `OWS_PRIVATE_KEY`, `OWS_SECP256K1_KEY`, and `OWS_ED25519_KEY`. The lifecycle spec also describes imports from Ethereum Keystore v3, WIF, Solana keypair JSON, and Sui keystore JSON. ([GitHub][2])

Examples:

```bash
# Mnemonic import
echo "goose puzzle decorate ..." | ows wallet import --name "imported" --mnemonic

# EVM private key import
echo "4c0883a691..." | ows wallet import --name "from-evm" --private-key

# Explicit both-curve import
OWS_SECP256K1_KEY="4c0883a691..." \
OWS_ED25519_KEY="9d61b19d..." \
ows wallet import --name "both"
```

The wallet-lifecycle doc also says mnemonic input is intended to be interactive or stdin-based to avoid shell-history exposure. ([GitHub][2])

## 8) Export, backup, and recovery

### Export

CLI export is documented as:

```bash
ows wallet export --wallet "my-wallet"
```

The CLI reference says mnemonic wallets return the phrase, while private-key wallets return JSON with both curve keys, and export requires an interactive terminal. ([GitHub][2])

### Backup

The lifecycle spec documents:

```bash
ows backup --output ~/ows-backup-2026-02-27.tar.gz.enc
```

and restore with:

```bash
ows restore --input ~/ows-backup-2026-02-27.tar.gz.enc
```

The spec says backup encrypts an archive of the vault, and restore extracts it back to `~/.ows/`. It also shows a `backup` section in `~/.ows/config.json` for automated backups. ([GitHub][7])

### Recovery

Recovery from mnemonic is documented as:

```bash
ows wallet recover --name "recovered" --chain evm --chains eip155:8453,eip155:1
```

The lifecycle doc says recovery scans derived accounts using a BIP-44 style gap limit and then writes a new wallet file with discovered accounts. ([GitHub][7])

## 9) Policies and agent keys on a local machine

OWS shines when you want **local ownership** plus **restricted agent access**. The flow is:

1. Create wallet
2. Create policy
3. Create API key tied to wallet + policy
4. Give the token to the agent
5. Revoke the token later if needed ([GitHub][2])

Example policy:

```json
{
  "id": "agent-limits",
  "name": "Agent Safety Limits",
  "version": 1,
  "created_at": "2026-03-22T00:00:00Z",
  "rules": [
    { "type": "allowed_chains", "chain_ids": ["eip155:8453"] },
    { "type": "expires_at", "timestamp": "2026-12-31T23:59:59Z" }
  ],
  "action": "deny"
}
```

Register it:

```bash
ows policy create --file policy.json
```

Create an API key:

```bash
ows key create --name "agent" --wallet my-wallet --policy agent-limits
```

The CLI docs say the raw token is shown once, tokens are never shown again, and revocation deletes the key file so the token becomes useless. The storage spec also says API key files contain re-encrypted wallet secrets plus a SHA-256 hash of the token. ([GitHub][2])

## 10) Security practices that matter most locally

The most important habits for local OWS use are:

**Use a strong passphrase** for owner-controlled wallets. The storage spec documents scrypt for wallet-file KDFs and AES-256-GCM for encryption. ([GitHub][4])

**Do not store mnemonics or private keys in shell history.** The lifecycle and CLI docs both lean toward stdin/interactive entry rather than command-line arguments for sensitive material. ([GitHub][2])

**Keep vault directories private.** The spec expects owner-only permissions on `wallets/` and `keys/`. ([GitHub][4])

**Treat audit logs as sensitive.** OWS stores `logs/audit.jsonl` locally; even when secrets stay encrypted, logs and metadata may still be operationally sensitive. ([GitHub][4])

**Prefer SDK custom vault paths for separation.** If you want clean separation between projects or environments, using `vaultPath` / `vault_path` is the most directly supported way I found. ([GitHub][5])

## 11) Recommended local directory strategies

These are good, sane layouts.

### Single-user laptop

```text
~/.ows
```

Use the CLI for everything. Simple, default, documented. ([GitHub][4])

### Per-project development

```text
~/src/my-bot/.vaults/dev
~/src/my-bot/.vaults/staging
~/src/my-bot/.vaults/prod
```

and in code:

```python
vault_path = "/Users/you/src/my-bot/.vaults/dev"
```

or

```javascript
const vaultPath = "/Users/you/src/my-bot/.vaults/dev";
```

This is the cleanest way to get optional storage placement with official SDK support. ([GitHub][5])

### Encrypted external or mounted disk

```text
/Volumes/SecureDisk/ows-prod
```

Use SDKs with that path. That gives you both OWS encryption and the volume’s own disk encryption. The SDK docs support this because the path is just a directory root. ([GitHub][5])

## 12) What I would personally recommend

For the smoothest setup:

* Use the **CLI** to learn the workflow and inspect wallets.
* Use **Python or Node** for anything persistent, automated, or agentic.
* Put serious wallets in a **custom SDK vault path** rather than mixing everything into one default `~/.ows`.
* Keep **dev** and **prod** in separate vault roots.
* Use **policies + API keys** for agents, and reserve the owner passphrase for break-glass/admin use. ([GitHub][2])

## 13) Minimal “best practice” starter recipes

### CLI-only starter

```bash
npm install -g @open-wallet-standard/core
ows wallet create --name "personal"
ows wallet list
ows wallet info
ows sign message --wallet "personal" --chain evm --message "hello"
```

This follows the documented CLI install and reference flow. ([GitHub][3])

### Python starter with custom storage

```python
from ows import create_wallet, sign_message

vault_path = "/Users/you/secure/ows-dev"

wallet = create_wallet("bot-wallet", vault_path=vault_path)
sig = sign_message("bot-wallet", "evm", "hello", vault_path=vault_path)
print(sig["signature"])
```

The Python SDK documents `vault_path` directly. ([GitHub][6])

### Node starter with custom storage

```javascript
import { createWallet, signMessage } from "@open-wallet-standard/core";

const vaultPath = "/Users/you/secure/ows-dev";

createWallet("bot-wallet", undefined, 12, vaultPath);
const sig = signMessage("bot-wallet", "evm", "hello", undefined, "utf8", 0, vaultPath);
console.log(sig.signature);
```

The Node SDK docs document `vaultPath` directly. ([GitHub][5])

## 14) Bottom line on your storage-location requirement

Yes — **you can optionally choose where wallet data is stored**, but the **officially documented way I found is through the SDKs**:

* **Node:** `vaultPath`
* **Python:** `vault_path` ([GitHub][5])

For the **CLI**, the official docs I found document `~/.ows` as the vault root and do **not** document a separate vault-root flag or env var. So if custom storage location is important for you, the best-supported route is to use **Node or Python**, even if you still keep the CLI installed for inspection and admin tasks. ([GitHub][2])

I can turn this into a shorter “copy/paste setup guide” for either **CLI-only**, **Python**, or **Node**.

[1]: https://docs.openwallet.sh/ "Docs - OWS"
[2]: https://raw.githubusercontent.com/open-wallet-standard/core/main/docs/sdk-cli.md "raw.githubusercontent.com"
[3]: https://github.com/open-wallet-standard/core "GitHub - open-wallet-standard/core: Local, policy-gated signing and wallet management for every chain. · GitHub"
[4]: https://raw.githubusercontent.com/open-wallet-standard/core/main/docs/01-storage-format.md "raw.githubusercontent.com"
[5]: https://raw.githubusercontent.com/open-wallet-standard/core/main/docs/sdk-node.md "raw.githubusercontent.com"
[6]: https://raw.githubusercontent.com/open-wallet-standard/core/main/docs/sdk-python.md "raw.githubusercontent.com"
[7]: https://raw.githubusercontent.com/open-wallet-standard/core/main/docs/06-wallet-lifecycle.md "raw.githubusercontent.com"
