import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { setupExample } from '../scripts/setup.mjs';
import { run } from '../src/index.mjs';

test('setupExample creates a local OWS vault, env file, and config file', async () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'mindwallet-ows-example-'));

  try {
    const result = await setupExample({ rootDir });

    const envText = readFileSync(result.envPath, 'utf8');
    const configText = readFileSync(result.configPath, 'utf8');

    assert.match(envText, /OWS_PASSPHRASE=example-passphrase/);
    assert.match(configText, /"walletId": "example-wallet"/);

    const summary = await run({ rootDir });
    assert.equal(summary.walletId, 'example-wallet');
    assert.ok(summary.address.startsWith('0x'));
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
