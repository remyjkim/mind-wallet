// packages/cli/src/config.test.ts
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig, saveConfig } from './config.js';

describe('config', () => {
  it('loads a valid config file', () => {
    const dir = join(tmpdir(), `mindwallet-test-${Date.now()}`);
    const file = join(dir, 'config.json');
    mkdirSync(dir, { recursive: true });
    const cfg = { walletId: 'my-wallet', vaultPath: dir };
    writeFileSync(file, JSON.stringify(cfg));

    const loaded = loadConfig(file);
    expect(loaded.walletId).toBe('my-wallet');
    expect(loaded.vaultPath).toBe(dir);

    rmSync(dir, { recursive: true });
  });

  it('throws when config file is missing', () => {
    expect(() => loadConfig('/nonexistent/config.json')).toThrow();
  });

  it('saves and reloads a config', () => {
    const dir = join(tmpdir(), `mindwallet-test-${Date.now()}`);
    const file = join(dir, 'config.json');
    const cfg = { walletId: 'test', vaultPath: dir, policy: [] };

    saveConfig(cfg, file);
    const loaded = loadConfig(file);
    expect(loaded.walletId).toBe('test');
    expect(loaded.policy).toEqual([]);

    rmSync(dir, { recursive: true });
  });
});
