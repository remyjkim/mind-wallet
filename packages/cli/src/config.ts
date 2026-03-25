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
  /** OWS wallet name/ID to use for signing. */
  walletId: string;
  /** Path to the OWS vault directory. */
  vaultPath: string;
  /** Passphrase for the OWS vault (use env var OWS_PASSPHRASE in production). */
  passphrase?: string;
  /** Policy rules to apply during payment selection. */
  policy?: PolicyRuleConfig[];
  /** RPC URL overrides keyed by chainId. */
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
  const raw = readFileSync(path, 'utf8');
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
