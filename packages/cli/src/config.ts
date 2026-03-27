// ABOUTME: Loads and saves the mindwallet CLI configuration from ~/.config/mindwallet/config.json
// ABOUTME: Provides typed access to wallet, policy, and RPC settings

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface PolicyRuleConfig {
  type: 'budget' | 'deny-protocol' | 'prefer-protocol';
  currency?: string;
  limit?: string;
  window?: 'daily' | 'weekly' | 'monthly';
  protocol?: string;
  boost?: number;
}

export interface MindwalletConfig {
  /** OWS wallet name/ID to use for signing. Defaults to "default". */
  walletId?: string;
  /** Path to the OWS vault directory. Defaults to ~/.minds/wallet/vault. */
  vaultPath?: string;
  /** Passphrase for the OWS vault (use env var OWS_PASSPHRASE in production). */
  passphrase?: string;
  /** Raw EVM private key for non-OWS usage (hex-encoded, 0x-prefixed). Mutually exclusive with walletId. */
  privateKey?: `0x${string}`;
  /** CAIP-2 chain IDs for private key signing. Only used with privateKey. */
  chainIds?: string[];
  /** Fixed gas limit for live Tempo charge signing. */
  tempoGas?: string;
  /** Policy rules to apply during payment selection. */
  policy?: PolicyRuleConfig[];
  /** RPC URL overrides keyed by network name (e.g. "base", "tempo"). */
  rpcUrls?: Record<string, string>;
}

const DEFAULT_CONFIG_DIR = join(homedir(), '.config', 'mindwallet');
const DEFAULT_CONFIG_PATH = join(DEFAULT_CONFIG_DIR, 'config.json');

/**
 * Returns the config file path, using CONFIG_PATH env var if set.
 */
export function configPath(): string {
  return process.env['CONFIG_PATH'] ?? DEFAULT_CONFIG_PATH;
}

/**
 * Loads the mindwallet config from disk.  Throws if the file is missing or
 * malformed — callers are expected to handle this at startup.
 */
export function loadConfig(path: string = configPath()): MindwalletConfig {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {} as MindwalletConfig;
    }
    throw err;
  }
  return JSON.parse(raw) as MindwalletConfig;
}

/**
 * Writes a config object to disk, creating the directory if needed.
 */
export function saveConfig(config: MindwalletConfig, path: string = configPath()): void {
  const dir = join(path, '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/**
 * Reads MINDWALLET_* environment variables and returns a partial config.
 * Only set variables appear in the result — unset variables are omitted.
 */
export function readEnvOverrides(): Partial<MindwalletConfig> {
  const overrides: Partial<MindwalletConfig> = {};

  const privateKey = process.env['MINDWALLET_PRIVATE_KEY'];
  if (privateKey) overrides.privateKey = privateKey as `0x${string}`;

  const chainIds = process.env['MINDWALLET_CHAIN_IDS'];
  if (chainIds) {
    overrides.chainIds = chainIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const walletId = process.env['MINDWALLET_WALLET_ID'];
  if (walletId) overrides.walletId = walletId;

  const vaultPath = process.env['MINDWALLET_VAULT_PATH'];
  if (vaultPath) overrides.vaultPath = vaultPath;

  const tempoGas = process.env['MINDWALLET_TEMPO_GAS'];
  if (tempoGas) overrides.tempoGas = tempoGas;

  const rpcUrls: Record<string, string> = {};
  const rpcBase = process.env['MINDWALLET_RPC_BASE'];
  if (rpcBase) rpcUrls['base'] = rpcBase;
  const rpcTempo = process.env['MINDWALLET_RPC_TEMPO'];
  if (rpcTempo) rpcUrls['tempo'] = rpcTempo;
  if (Object.keys(rpcUrls).length > 0) overrides.rpcUrls = rpcUrls;

  return overrides;
}

/**
 * Resolves the final config by merging: env vars > config file > defaults.
 * Config file is optional — returns {} on ENOENT.
 */
export function resolveConfig(): MindwalletConfig {
  const file = loadConfig();
  const env = readEnvOverrides();
  return { ...file, ...env };
}
