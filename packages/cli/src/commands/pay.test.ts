// ABOUTME: Integration tests for payCommand against a local SIWX test server
// ABOUTME: Exercises the full probe -> pay -> output flow with discovery info

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallet } from '@open-wallet-standard/core';
import { payCommand } from './pay.js';
import type { MindwalletConfig } from '../config.js';
import { startSiwxTestServer, type SiwxTestServer } from '../test-helpers.js';

const skip = !process.env['RUN_INTEGRATION_TESTS'] || !process.env['OWS_PASSPHRASE'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(skip)('payCommand: SIWX 402 integration (local server)', () => {
  let srv: SiwxTestServer;
  let vaultPath: string;
  let config: MindwalletConfig;

  beforeAll(async () => {
    srv = await startSiwxTestServer();

    vaultPath = mkdtempSync(join(tmpdir(), 'mw-pay-test-'));
    createWallet('test-wallet', undefined, 12, vaultPath);

    config = {
      walletId: 'test-wallet',
      vaultPath,
    };
  });

  afterAll(async () => {
    await srv.close();
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('probes, pays, and writes response body to stdout', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const url = `${srv.url}/resource`;
      await payCommand(url, config);

      const output = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toContain('protected content');
    } finally {
      stdoutSpy.mockRestore();
    }
  });

  it('writes discovery and status info to stderr in verbose mode', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const url = `${srv.url}/resource`;
      await payCommand(url, config, { verbose: true });

      const errOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(errOutput).toContain('payment candidate');
      expect(errOutput).toContain('HTTP 200');
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });

  it('sets exitCode 1 for unreachable URL', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const savedExitCode = process.exitCode;
    try {
      await payCommand('http://127.0.0.1:1/unreachable', config);
      expect(process.exitCode).toBe(1);
    } finally {
      errorSpy.mockRestore();
      process.exitCode = savedExitCode;
    }
  });
});
