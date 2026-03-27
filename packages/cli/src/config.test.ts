// ABOUTME: Tests for config loading, env var resolution, and validation
// ABOUTME: Covers loadConfig behavior, resolveConfig merging, and mutual exclusion rules

import { describe, it, expect } from 'vitest';
import { loadConfig, resolveConfig, readEnvOverrides } from './config.js';
import type { MindwalletConfig } from './config.js';

describe('loadConfig', () => {
  it('returns empty object when file does not exist', () => {
    const result = loadConfig('/tmp/nonexistent-mindwallet-config-' + Date.now() + '.json');
    expect(result).toEqual({});
  });

  it('throws on malformed JSON', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const path = '/tmp/mindwallet-bad-config-' + Date.now() + '.json';
    writeFileSync(path, '{ not valid json');
    try {
      expect(() => loadConfig(path)).toThrow();
    } finally {
      unlinkSync(path);
    }
  });

  it('parses valid config file', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const path = '/tmp/mindwallet-good-config-' + Date.now() + '.json';
    writeFileSync(path, JSON.stringify({ walletId: 'myWallet', vaultPath: '/tmp/vault' }));
    try {
      const config = loadConfig(path);
      expect(config.walletId).toBe('myWallet');
      expect(config.vaultPath).toBe('/tmp/vault');
    } finally {
      unlinkSync(path);
    }
  });
});

describe('MindwalletConfig type', () => {
  it('accepts privateKey and chainIds fields', () => {
    const config: MindwalletConfig = {
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      chainIds: ['eip155:8453'],
    };
    expect(config.privateKey).toBeDefined();
    expect(config.chainIds).toEqual(['eip155:8453']);
  });

  it('accepts empty config (all fields optional)', () => {
    const config: MindwalletConfig = {};
    expect(config).toEqual({});
  });

  it('accepts tempoGas field', () => {
    const config: MindwalletConfig = {
      tempoGas: '200000',
    };
    expect(config.tempoGas).toBe('200000');
  });
});

describe('readEnvOverrides', () => {
  it('reads MINDWALLET_PRIVATE_KEY', () => {
    process.env['MINDWALLET_PRIVATE_KEY'] = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.privateKey).toBe('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    } finally {
      delete process.env['MINDWALLET_PRIVATE_KEY'];
    }
  });

  it('reads MINDWALLET_CHAIN_IDS as comma-separated list', () => {
    process.env['MINDWALLET_CHAIN_IDS'] = 'eip155:8453,eip155:4217';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.chainIds).toEqual(['eip155:8453', 'eip155:4217']);
    } finally {
      delete process.env['MINDWALLET_CHAIN_IDS'];
    }
  });

  it('trims whitespace in comma-separated MINDWALLET_CHAIN_IDS', () => {
    process.env['MINDWALLET_CHAIN_IDS'] = ' eip155:8453 , eip155:4217 ';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.chainIds).toEqual(['eip155:8453', 'eip155:4217']);
    } finally {
      delete process.env['MINDWALLET_CHAIN_IDS'];
    }
  });

  it('reads MINDWALLET_WALLET_ID', () => {
    process.env['MINDWALLET_WALLET_ID'] = 'my-wallet';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.walletId).toBe('my-wallet');
    } finally {
      delete process.env['MINDWALLET_WALLET_ID'];
    }
  });

  it('reads MINDWALLET_VAULT_PATH', () => {
    process.env['MINDWALLET_VAULT_PATH'] = '/custom/vault';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.vaultPath).toBe('/custom/vault');
    } finally {
      delete process.env['MINDWALLET_VAULT_PATH'];
    }
  });

  it('reads MINDWALLET_RPC_BASE and MINDWALLET_RPC_TEMPO into rpcUrls', () => {
    process.env['MINDWALLET_RPC_BASE'] = 'https://base.example.com';
    process.env['MINDWALLET_RPC_TEMPO'] = 'https://tempo.example.com';
    try {
      const overrides = readEnvOverrides();
      expect(overrides.rpcUrls).toEqual({
        base: 'https://base.example.com',
        tempo: 'https://tempo.example.com',
      });
    } finally {
      delete process.env['MINDWALLET_RPC_BASE'];
      delete process.env['MINDWALLET_RPC_TEMPO'];
    }
  });

  it('omits rpcUrls entirely when no RPC env vars are set', () => {
    const overrides = readEnvOverrides();
    expect(overrides.rpcUrls).toBeUndefined();
  });

  it('omits unset env vars from result', () => {
    delete process.env['MINDWALLET_PRIVATE_KEY'];
    delete process.env['MINDWALLET_WALLET_ID'];
    delete process.env['MINDWALLET_CHAIN_IDS'];
    delete process.env['MINDWALLET_VAULT_PATH'];
    delete process.env['MINDWALLET_RPC_BASE'];
    delete process.env['MINDWALLET_RPC_TEMPO'];

    const overrides = readEnvOverrides();
    expect(overrides.privateKey).toBeUndefined();
    expect(overrides.walletId).toBeUndefined();
    expect(overrides.chainIds).toBeUndefined();
    expect(overrides.vaultPath).toBeUndefined();
    expect(overrides.rpcUrls).toBeUndefined();
  });

  it('reads MINDWALLET_TEMPO_GAS', () => {
    process.env['MINDWALLET_TEMPO_GAS'] = '200000';
    try {
      expect(readEnvOverrides().tempoGas).toBe('200000');
    } finally {
      delete process.env['MINDWALLET_TEMPO_GAS'];
    }
  });

  it('preserves empty config when MINDWALLET_CHAIN_IDS is unset', () => {
    delete process.env['MINDWALLET_CHAIN_IDS'];
    expect(readEnvOverrides().chainIds).toBeUndefined();
  });

  it('keeps empty chain entries trimmed out', () => {
    process.env['MINDWALLET_CHAIN_IDS'] = ' eip155:8453 , , eip155:4217 ';
    try {
      expect(readEnvOverrides().chainIds).toEqual(['eip155:8453', 'eip155:4217']);
    } finally {
      delete process.env['MINDWALLET_CHAIN_IDS'];
    }
  });
});

describe('resolveConfig', () => {
  it('env vars override config file values', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const path = '/tmp/mindwallet-resolve-' + Date.now() + '.json';
    writeFileSync(path, JSON.stringify({ walletId: 'file-wallet', vaultPath: '/file/vault' }));
    process.env['MINDWALLET_WALLET_ID'] = 'env-wallet';
    process.env['CONFIG_PATH'] = path;
    try {
      const config = resolveConfig();
      expect(config.walletId).toBe('env-wallet');
      expect(config.vaultPath).toBe('/file/vault');
    } finally {
      delete process.env['MINDWALLET_WALLET_ID'];
      delete process.env['CONFIG_PATH'];
      unlinkSync(path);
    }
  });

  it('works with no config file and only env vars', () => {
    process.env['MINDWALLET_PRIVATE_KEY'] = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const saved = process.env['CONFIG_PATH'];
    process.env['CONFIG_PATH'] = '/tmp/nonexistent-resolve-' + Date.now() + '.json';
    try {
      const config = resolveConfig();
      expect(config.privateKey).toBe('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    } finally {
      delete process.env['MINDWALLET_PRIVATE_KEY'];
      if (saved !== undefined) process.env['CONFIG_PATH'] = saved;
      else delete process.env['CONFIG_PATH'];
    }
  });

  it('returns empty config when no file and no env vars', () => {
    const saved = process.env['CONFIG_PATH'];
    process.env['CONFIG_PATH'] = '/tmp/nonexistent-empty-' + Date.now() + '.json';
    try {
      const config = resolveConfig();
      expect(config).toEqual({});
    } finally {
      if (saved !== undefined) process.env['CONFIG_PATH'] = saved;
      else delete process.env['CONFIG_PATH'];
    }
  });
});
