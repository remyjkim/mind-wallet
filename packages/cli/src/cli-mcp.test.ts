// ABOUTME: Black-box tests for binary MCP startup behavior
// ABOUTME: Verifies the compiled CLI can start or fail correctly in MCP mode

import { afterEach, describe, expect, it } from 'vitest';
import { makeTempConfigHome, spawnMindwallet, writeRawConfig } from './cli-binary-test-helpers.js';
import { TEST_PRIVATE_KEY } from './test-helpers.js';

describe('mindwallet binary mcp startup', () => {
  const children: Array<{ kill: (signal?: NodeJS.Signals) => boolean; once: Function }> = [];

  afterEach(async () => {
    await Promise.all(children.splice(0).map(
      (child) =>
        new Promise<void>((resolve) => {
          child.once('close', () => resolve());
          child.kill('SIGTERM');
        }),
    ));
  });

  it('starts and stays alive with env-only private-key config', async () => {
    const child = await spawnMindwallet({
      args: ['mcp'],
      env: {
        ...process.env,
        HOME: makeTempConfigHome(),
        MINDWALLET_PRIVATE_KEY: TEST_PRIVATE_KEY,
        MINDWALLET_CHAIN_IDS: 'eip155:84532',
      },
    });
    children.push(child);

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(child.exitCode).toBeNull();
    expect(child.killed).toBe(false);
  });

  it('fails fast on malformed config', async () => {
    const home = makeTempConfigHome();
    writeRawConfig(home, '{not-json');

    const child = await spawnMindwallet({
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
