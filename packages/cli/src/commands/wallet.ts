// ABOUTME: CLI command that shows wallet information from the configured OWS vault
// ABOUTME: Outputs wallet ID, supported chains, and account addresses

import { homedir } from 'node:os';
import { join } from 'node:path';
import { getWallet } from '@open-wallet-standard/core';
import type { MindwalletConfig } from '../config.js';

const DEFAULT_WALLET_ID = 'default';
const DEFAULT_VAULT_PATH = join(homedir(), '.minds', 'wallet', 'vault');

/**
 * Prints wallet account information to stdout.
 */
export async function walletCommand(config: MindwalletConfig): Promise<void> {
  const walletId = config.walletId ?? DEFAULT_WALLET_ID;
  const vaultPath = config.vaultPath ?? DEFAULT_VAULT_PATH;
  const wallet = getWallet(walletId, vaultPath);

  console.log(`Wallet: ${walletId}`);
  console.log(`Vault:  ${vaultPath}`);
  console.log(`\nAccounts (${wallet.accounts.length}):`);
  for (const account of wallet.accounts) {
    console.log(`  ${account.chainId.padEnd(30)}  ${account.address}`);
  }
}
