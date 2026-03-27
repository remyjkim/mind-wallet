import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { CLI_VERSION } from './version.js';

describe('CLI_VERSION', () => {
  it('is a non-empty string', () => {
    expect(CLI_VERSION).toMatch(/\S+/);
  });

  it('uses MINDPASS_VERSION when no compile-time version is injected', async () => {
    const stdout = execFileSync(
      'bun',
      [
        '--eval',
        "import { CLI_VERSION } from './src/version.ts'; console.log(CLI_VERSION);",
      ],
      {
        cwd: new URL('..', import.meta.url),
        env: {
          ...process.env,
          MINDPASS_VERSION: '9.9.9-mindpass',
        },
        encoding: 'utf8',
      },
    );

    expect(stdout.trim()).toBe('9.9.9-mindpass');
  });
});
