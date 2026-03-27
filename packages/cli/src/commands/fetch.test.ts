// ABOUTME: Integration tests for fetchCommand against a local SIWX test server
// ABOUTME: Exercises the full CLI command path: config -> wallet -> router -> wrapFetch -> output

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallet } from '@open-wallet-standard/core';
import { fetchCommand } from './fetch.js';
import type { MindwalletConfig } from '../config.js';
import { startSiwxTestServer, type SiwxTestServer } from '../test-helpers.js';

const skip = !process.env['RUN_INTEGRATION_TESTS'] || !process.env['OWS_PASSPHRASE'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(skip)('fetchCommand: SIWX 402 integration (local server)', () => {
  let srv: SiwxTestServer;
  let vaultPath: string;
  let config: MindwalletConfig;

  beforeAll(async () => {
    srv = await startSiwxTestServer();

    vaultPath = mkdtempSync(join(tmpdir(), 'mw-fetch-test-'));
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

  it('resolves a SIWX 402 and writes response body to stdout', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const url = `${srv.url}/resource`;
      await fetchCommand(url, config);

      const output = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(output).toContain('protected content');
    } finally {
      stdoutSpy.mockRestore();
    }
  });

  it('writes headers to stderr in verbose mode', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const url = `${srv.url}/resource`;
      await fetchCommand(url, config, { verbose: true });

      const errOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(errOutput).toContain('HTTP 200');
      expect(errOutput).toContain('content-type');
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });
});
