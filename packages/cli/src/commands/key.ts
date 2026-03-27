// ABOUTME: CLI commands for managing OWS API keys (create, revoke, list)
// ABOUTME: API keys grant agents access to wallet signing without exposing the passphrase

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { MindpassConfig } from '../config.js';
import { loadOws, type OwsBindings } from '../ows/load-ows.js';

const DEFAULT_WALLET_ID = 'default';
const DEFAULT_VAULT_PATH = join(homedir(), '.minds', 'wallet', 'vault');

export interface KeyCreateOptions {
  expiresAt?: string;
  owsCreate?: OwsBindings['createApiKey'];
  output?: (line: string) => void;
}

export interface KeyRevokeOptions {
  owsRevoke?: OwsBindings['revokeApiKey'];
  output?: (line: string) => void;
}

export interface KeyListOptions {
  owsList?: OwsBindings['listApiKeys'];
  output?: (line: string) => void;
}

/**
 * Creates an API key scoped to the configured wallet and prints the token once.
 */
export async function keyCreateCommand(
  name: string,
  config: MindpassConfig,
  options: KeyCreateOptions = {},
): Promise<void> {
  const out = options.output ?? console.log;
  const create = options.owsCreate ?? (await loadOws()).createApiKey;
  const passphrase = config.passphrase ?? process.env['OWS_PASSPHRASE'] ?? '';
  const walletId = config.walletId ?? DEFAULT_WALLET_ID;
  const vaultPath = config.vaultPath ?? DEFAULT_VAULT_PATH;

  const result = create(
    name,
    [walletId],
    [],
    passphrase,
    options.expiresAt,
    vaultPath,
  );

  out(`Key created:`);
  out(`  ID:    ${result.id}`);
  out(`  Name:  ${result.name}`);
  out(`  Token: ${result.token}`);
  out(`WARNING: The token above is shown once and cannot be retrieved again.`);
}

/**
 * Revokes an API key by its ID.
 */
export async function keyRevokeCommand(
  id: string,
  config: MindpassConfig,
  options: KeyRevokeOptions = {},
): Promise<void> {
  const out = options.output ?? console.log;
  const revoke = options.owsRevoke ?? (await loadOws()).revokeApiKey;
  const vaultPath = config.vaultPath ?? DEFAULT_VAULT_PATH;

  revoke(id, vaultPath);
  out(`Key ${id} revoked.`);
}

/**
 * Lists all API key IDs and names. Tokens are never returned by OWS.
 */
export async function keyListCommand(
  config: MindpassConfig,
  options: KeyListOptions = {},
): Promise<void> {
  const out = options.output ?? console.log;
  const list = options.owsList ?? (await loadOws()).listApiKeys;
  const vaultPath = config.vaultPath ?? DEFAULT_VAULT_PATH;

  const keys = list(vaultPath) as Array<{ id: string; name: string; createdAt?: string }>;

  if (keys.length === 0) {
    out('No API keys found.');
    return;
  }

  for (const key of keys) {
    const created = key.createdAt ? `  created=${key.createdAt}` : '';
    out(`${key.id}  ${key.name}${created}`);
  }
}
