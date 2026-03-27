// ABOUTME: Loads and saves the mindpass CLI configuration from ~/.config/mindpass/config.json
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

export interface MindpassConfig {
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

function homeDirectory(): string {
  return process.env['HOME'] ?? homedir();
}

function defaultConfigDir(): string {
  return join(homeDirectory(), '.config', 'mindpass');
}

function legacyConfigPath(): string {
  return join(homeDirectory(), '.config', 'mindpass', 'config.json');
}

function readCompatEnv(name: string): string | undefined {
  return process.env[`MINDPASS_${name}`];
}

/**
 * Returns the config file path, using CONFIG_PATH env var if set.
 */
export function configPath(): string {
  return process.env['CONFIG_PATH'] ?? join(defaultConfigDir(), 'config.json');
}

/**
 * Loads the mindpass config from disk. Throws if the file is missing or
 * malformed — callers are expected to handle this at startup.
 */
export function loadConfig(path: string = configPath()): MindpassConfig {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      if (process.env['CONFIG_PATH'] === undefined && path === configPath()) {
        try {
          raw = readFileSync(legacyConfigPath(), 'utf8');
        } catch (legacyErr: unknown) {
          if ((legacyErr as NodeJS.ErrnoException).code === 'ENOENT') {
            return {} as MindpassConfig;
          }
          throw legacyErr;
        }
      } else {
        return {} as MindpassConfig;
      }
    } else {
      throw err;
    }
  }
  return JSON.parse(raw) as MindpassConfig;
}

/**
 * Writes a config object to disk, creating the directory if needed.
 */
export function saveConfig(config: MindpassConfig, path: string = configPath()): void {
  const dir = join(path, '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/**
 * Reads MINDPASS_* environment variables.
 * Only set variables appear in the result — unset variables are omitted.
 */
export function readEnvOverrides(): Partial<MindpassConfig> {
  const overrides: Partial<MindpassConfig> = {};

  const privateKey = readCompatEnv('PRIVATE_KEY');
  if (privateKey) overrides.privateKey = privateKey as `0x${string}`;

  const chainIds = readCompatEnv('CHAIN_IDS');
  if (chainIds) {
    overrides.chainIds = chainIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const walletId = readCompatEnv('WALLET_ID');
  if (walletId) overrides.walletId = walletId;

  const vaultPath = readCompatEnv('VAULT_PATH');
  if (vaultPath) overrides.vaultPath = vaultPath;

  const tempoGas = readCompatEnv('TEMPO_GAS');
  if (tempoGas) overrides.tempoGas = tempoGas;

  const rpcUrls: Record<string, string> = {};
  const rpcBase = readCompatEnv('RPC_BASE');
  if (rpcBase) rpcUrls['base'] = rpcBase;
  const rpcTempo = readCompatEnv('RPC_TEMPO');
  if (rpcTempo) rpcUrls['tempo'] = rpcTempo;
  if (Object.keys(rpcUrls).length > 0) overrides.rpcUrls = rpcUrls;

  return overrides;
}

/**
 * Resolves the final config by merging: env vars > config file > defaults.
 * Config file is optional — returns {} on ENOENT.
 */
export function resolveConfig(): MindpassConfig {
  const file = loadConfig();
  const env = readEnvOverrides();
  return { ...file, ...env };
}
