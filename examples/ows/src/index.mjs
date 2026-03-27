import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadConfig, configPath, routerFromConfig } from 'mindwallet';

function loadEnvFile(path) {
  let text = '';
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }

  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export async function run(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  loadEnvFile(resolve(rootDir, '.env'));

  const config = loadConfig(configPath());
  const { wallet, methods } = routerFromConfig(config);
  const walletId = config.walletId ?? 'default';
  const account = await wallet.getAccount(walletId, 'eip155:8453');

  return {
    walletId,
    address: account.address,
    chainId: account.chainId,
    methods: methods.map((method) => method.id),
    configPath: configPath(),
    vaultPath: config.vaultPath ?? '',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const summary = await run();
  console.log(`Mindwallet OWS example`);
  console.log(`Wallet:  ${summary.walletId}`);
  console.log(`Address: ${summary.address}`);
  console.log(`Chain:   ${summary.chainId}`);
  console.log(`Methods: ${summary.methods.join(', ')}`);
  console.log(`Config:  ${summary.configPath}`);
  console.log(`Vault:   ${summary.vaultPath}`);
}
