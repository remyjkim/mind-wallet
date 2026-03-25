// ABOUTME: CLI command that shows wallet information from the configured OWS vault
// ABOUTME: Outputs wallet ID, supported chains, and account addresses

import { getWallet } from '@open-wallet-standard/core';
import type { MindwalletConfig } from '../config.js';

/**
 * Prints wallet account information to stdout.
 */
export async function walletCommand(config: MindwalletConfig): Promise<void> {
  const wallet = getWallet(config.walletId, config.vaultPath);

  console.log(`Wallet: ${config.walletId}`);
  console.log(`Vault:  ${config.vaultPath}`);
  console.log(`\nAccounts (${wallet.accounts.length}):`);
  for (const account of wallet.accounts) {
    console.log(`  ${account.chainId.padEnd(30)}  ${account.address}`);
  }
}
