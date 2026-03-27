// ABOUTME: Black-box tests for binary MCP startup behavior
// ABOUTME: Verifies the compiled CLI can start or fail correctly in MCP mode

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildCliOnce, makeTempConfigHome, spawnMindpass, writeRawConfig } from './cli-binary-test-helpers.js';
import { TEST_PRIVATE_KEY } from './test-helpers.js';

describe('mindpass binary mcp startup', () => {
  const children: Array<{
    exitCode: number | null;
    kill: (signal?: NodeJS.Signals) => boolean;
    once: (event: 'close', listener: () => void) => void;
  }> = [];

  beforeAll(async () => {
    await buildCliOnce();
  }, 60_000);

  afterEach(async () => {
    await Promise.all(children.splice(0).map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null) {
            resolve();
            return;
          }
          child.once('close', () => resolve());
          child.kill('SIGTERM');
        }),
    ));
  });

  it('starts cleanly with env-only private-key config', async () => {
    const child = await spawnMindpass({
      args: ['mcp'],
      env: {
        ...process.env,
        HOME: makeTempConfigHome(),
        MINDPASS_PRIVATE_KEY: TEST_PRIVATE_KEY,
        MINDPASS_CHAIN_IDS: 'eip155:84532',
      },
    });
    children.push(child);

    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    await new Promise((resolve) => setTimeout(resolve, 250));
    if (child.exitCode === null) {
      expect(child.killed).toBe(false);
      return;
    }

    expect(child.exitCode).toBe(0);
    expect(stderr).toBe('');
  }, 10_000);

  it('fails fast on malformed config', async () => {
    const home = makeTempConfigHome();
    writeRawConfig(home, '{not-json');

    const child = await spawnMindpass({
      args: ['mcp'],
      env: {
        ...process.env,
        HOME: home,
      },
    });

    const result = await new Promise<{ code: number | null; stderr: string }>((resolve) => {
      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.once('close', (code) => resolve({ code, stderr }));
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Expected property name');
  });
});
