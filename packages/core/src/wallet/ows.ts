// ABOUTME: WalletAdapter implementation backed by Open Wallet Standard Node.js bindings
// ABOUTME: passphrase is optional; omit it to use OWS_PASSPHRASE env var (e.g. in tests)

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type {
  WalletAdapter, WalletAccount, SignRequest, MessageRequest
} from '../types/wallet.js';

type OwsBindings = typeof import('@open-wallet-standard/core');

// Chains this adapter is permitted to sign for.
const SUPPORTED_CHAINS = new Set([
  'eip155:8453',          // Base
  'eip155:65536',         // Tempo
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana mainnet
]);

let owsBindingsPromise: Promise<OwsBindings> | undefined;

async function loadOwsBindings(): Promise<OwsBindings> {
  owsBindingsPromise ??= loadOwsBindingsImpl();
  return owsBindingsPromise;
}

async function loadOwsBindingsImpl(): Promise<OwsBindings> {
  const explicitPath = process.env['MINDPASS_OWS_NATIVE_PATH'];
  const nativePath = explicitPath ?? findColocatedNativeAddon();
  if (nativePath) {
    const require = createRequire(import.meta.url);
    return require(nativePath) as OwsBindings;
  }

  return import('@open-wallet-standard/core');
}

function findColocatedNativeAddon(): string | undefined {
  const filename = getNativeAddonFilename();
  if (!filename) return undefined;

  const candidate = join(dirname(process.execPath), 'ows', filename);
  return existsSync(candidate) ? candidate : undefined;
}

function getNativeAddonFilename(): string | undefined {
  if (process.platform === 'darwin' && (process.arch === 'arm64' || process.arch === 'x64')) {
    return `ows-node.darwin-${process.arch}.node`;
  }

  if (process.platform === 'linux' && (process.arch === 'arm64' || process.arch === 'x64')) {
    return `ows-node.linux-${process.arch}-gnu.node`;
  }

  return undefined;
}

export interface OwsAdapterConfig {
  walletId: string;
  vaultPath: string;    // e.g. ~/.minds/wallet/vault
  passphrase?: string;  // wallet passphrase; if omitted, OWS reads OWS_PASSPHRASE env var
}

export class OwsWalletAdapter implements WalletAdapter {
  constructor(private readonly config: OwsAdapterConfig) {}

  async sign(request: SignRequest): Promise<string> {
    const { signTransaction } = await loadOwsBindings();
    const result = signTransaction(
      request.walletId,
      request.chainId,
      String(request.transaction),
      this.config.passphrase,
      0,
      this.config.vaultPath,
    );
    const hex = result.signature;
    return hex.startsWith('0x') ? hex : `0x${hex}`;
  }

  async signMessage(request: MessageRequest): Promise<string> {
    const { signMessage } = await loadOwsBindings();
    const result = signMessage(
      request.walletId,
      request.chainId,
      request.message,
      this.config.passphrase,
      request.encoding ?? 'utf8',
      request.accountIndex ?? 0,
      this.config.vaultPath,
    );
    const hex = result.signature;
    return hex.startsWith('0x') ? hex : `0x${hex}`;
  }

  async getAccount(walletId: string, chainId: string): Promise<WalletAccount> {
    const { getWallet } = await loadOwsBindings();
    const wallet = getWallet(walletId, this.config.vaultPath);
    // Try exact match first; fall back to same CAIP-2 namespace (e.g. any eip155:* for Base/Tempo)
    const namespace = chainId.split(':')[0];
    const account =
      wallet.accounts.find(a => a.chainId === chainId) ??
      wallet.accounts.find(a => a.chainId.startsWith(`${namespace}:`));
    if (!account) {
      throw new Error(`No account for chain ${chainId} in wallet ${walletId}`);
    }
    // Return with the requested chainId so callers see the chain they asked for
    return { chainId, address: account.address };
  }

  async canSign(chainId: string): Promise<boolean> {
    return SUPPORTED_CHAINS.has(chainId);
  }
}
