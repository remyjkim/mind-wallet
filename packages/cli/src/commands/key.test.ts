// ABOUTME: Unit tests for key management commands (create, revoke, list)
// ABOUTME: OWS functions are injected so no vault I/O occurs in unit tests

import { describe, it, expect, vi } from 'vitest';
import { keyCreateCommand, keyRevokeCommand, keyListCommand } from './key.js';
import type { MindwalletConfig } from '../config.js';

const config: MindwalletConfig = {
  walletId: 'test-wallet',
  vaultPath: '/tmp/vault',
};

describe('keyCreateCommand', () => {
  it('prints the token and key ID after creation', async () => {
    const mockCreate = vi.fn().mockReturnValue({ token: 'tok-abc123', id: 'key-001', name: 'my-key' });
    const lines: string[] = [];
    await keyCreateCommand('my-key', config, { owsCreate: mockCreate, output: l => lines.push(l) });
    const all = lines.join('\n');
    expect(all).toContain('tok-abc123');
    expect(all).toContain('key-001');
  });

  it('warns that the token is shown once', async () => {
    const mockCreate = vi.fn().mockReturnValue({ token: 'tok-xyz', id: 'key-002', name: 'my-key' });
    const lines: string[] = [];
    await keyCreateCommand('my-key', config, { owsCreate: mockCreate, output: l => lines.push(l) });
    const all = lines.join('\n');
    expect(all.toLowerCase()).toContain('once');
  });

  it('passes walletId, vaultPath, and passphrase to OWS', async () => {
    const mockCreate = vi.fn().mockReturnValue({ token: 't', id: 'k', name: 'n' });
    const cfgWithPass: MindwalletConfig = { ...config, passphrase: 'secret' };
    await keyCreateCommand('agent-key', cfgWithPass, { owsCreate: mockCreate, output: () => {} });
    expect(mockCreate).toHaveBeenCalledWith(
      'agent-key',
      [config.walletId],
      [],
      'secret',
      undefined,
      config.vaultPath,
    );
  });

  it('uses OWS_PASSPHRASE env var when config passphrase is absent', async () => {
    const mockCreate = vi.fn().mockReturnValue({ token: 't', id: 'k', name: 'n' });
    const originalEnv = process.env['OWS_PASSPHRASE'];
    process.env['OWS_PASSPHRASE'] = 'env-secret';
    try {
      await keyCreateCommand('agent-key', config, { owsCreate: mockCreate, output: () => {} });
      expect(mockCreate.mock.calls[0]?.[3]).toBe('env-secret');
    } finally {
      if (originalEnv === undefined) delete process.env['OWS_PASSPHRASE'];
      else process.env['OWS_PASSPHRASE'] = originalEnv;
    }
  });
});

describe('keyRevokeCommand', () => {
  it('calls OWS revokeApiKey with the given id and vaultPath', async () => {
    const mockRevoke = vi.fn();
    await keyRevokeCommand('key-001', config, { owsRevoke: mockRevoke, output: () => {} });
    expect(mockRevoke).toHaveBeenCalledWith('key-001', config.vaultPath);
  });

  it('prints a confirmation message after revocation', async () => {
    const mockRevoke = vi.fn();
    const lines: string[] = [];
    await keyRevokeCommand('key-001', config, { owsRevoke: mockRevoke, output: l => lines.push(l) });
    expect(lines.some(l => /revoked/i.test(l))).toBe(true);
  });
});

describe('keyListCommand', () => {
  it('prints each key id and name', async () => {
    const mockList = vi.fn().mockReturnValue([
      { id: 'k1', name: 'agent-key', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'k2', name: 'bot-key', createdAt: '2026-02-01T00:00:00Z' },
    ]);
    const lines: string[] = [];
    await keyListCommand(config, { owsList: mockList, output: l => lines.push(l) });
    const all = lines.join('\n');
    expect(all).toContain('k1');
    expect(all).toContain('agent-key');
    expect(all).toContain('k2');
    expect(all).toContain('bot-key');
  });

  it('reports no keys when vault is empty', async () => {
    const mockList = vi.fn().mockReturnValue([]);
    const lines: string[] = [];
    await keyListCommand(config, { owsList: mockList, output: l => lines.push(l) });
    expect(lines.some(l => /no (api )?keys/i.test(l))).toBe(true);
  });

  it('passes vaultPath to OWS listApiKeys', async () => {
    const mockList = vi.fn().mockReturnValue([]);
    await keyListCommand(config, { owsList: mockList, output: () => {} });
    expect(mockList).toHaveBeenCalledWith(config.vaultPath);
  });
});
