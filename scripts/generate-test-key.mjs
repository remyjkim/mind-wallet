#!/usr/bin/env node
// ABOUTME: Generates a test private key for integration tests using the OWS SDK
// ABOUTME: Creates a temp wallet, exports the mnemonic, derives the EVM private key via viem

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { createWallet, exportWallet } = await import(
  new URL(
    '../node_modules/.pnpm/@open-wallet-standard+core@1.0.0/node_modules/@open-wallet-standard/core/index.js',
    import.meta.url,
  ).pathname
);
const { mnemonicToAccount } = await import(
  new URL(
    '../packages/protocols/node_modules/viem/_esm/accounts/index.js',
    import.meta.url,
  ).pathname
);

const vaultPath = mkdtempSync(join(tmpdir(), 'mw-keygen-'));
try {
  createWallet('keygen', undefined, 12, vaultPath);
  const mnemonic = exportWallet('keygen', undefined, vaultPath);

  // Derive the default EVM account (m/44'/60'/0'/0/0)
  const account = mnemonicToAccount(mnemonic);
  const hdKey = account.getHdKey();
  if (!hdKey.privateKey) throw new Error('Failed to derive private key from mnemonic');

  const privateKeyHex = '0x' + Buffer.from(hdKey.privateKey).toString('hex');

  console.log('');
  console.log('Generated test private key (do not use with real funds):');
  console.log('');
  console.log(`  Address:     ${account.address}`);
  console.log(`  Private key: ${privateKeyHex}`);
  console.log('');
  console.log('Run x402 integration test:');
  console.log(`  RUN_INTEGRATION_TESTS=1 TEST_PRIVATE_KEY=${privateKeyHex} pnpm -F @mindwallet/protocols test`);
  console.log('');
  console.log('Run Tempo integration test (also needs Moderato RPC):');
  console.log(`  RUN_INTEGRATION_TESTS=1 TEST_PRIVATE_KEY=${privateKeyHex} TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz pnpm -F @mindwallet/protocols test`);
  console.log('');
} finally {
  rmSync(vaultPath, { recursive: true, force: true });
}
