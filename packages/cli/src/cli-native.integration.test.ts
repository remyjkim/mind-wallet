import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

const cliDir = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(cliDir);
const repoRoot = resolve(packageDir, '..', '..');
const target =
  process.platform === 'darwin' || process.platform === 'linux'
    ? `${process.platform}-${process.arch}`
    : undefined;
const nativeBinaryPath = target ? join(repoRoot, 'dist', 'native', target, 'mindpass') : undefined;

describe.skipIf(!nativeBinaryPath)('mindpass native binary', () => {
  beforeAll(() => {
    execFileOrThrow('node', ['scripts/build-native-cli.mjs', '--target', target!], repoRoot);
  }, 30_000);

  it('prints the package version with --version', async () => {
    const result = await runNativeMindpass(['--version']);

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('0.2.0');
    expect(result.stderr).toBe('');
  });

  it('prints help without requiring an OWS native path env var', async () => {
    const result = await runNativeMindpass(['help']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stderr).toBe('');
  });

  it('loads the colocated OWS addon for wallet commands', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'mindpass-native-home-'));
    const result = await runNativeMindpass(['wallet'], {
      env: {
        ...process.env,
        HOME: tempHome,
        MINDPASS_VAULT_PATH: join(tempHome, 'vault'),
      },
    });

    expect(result.code).toBe(1);
    expect(result.stderr).not.toContain('ERR_DLOPEN_FAILED');
    expect(result.stderr).not.toContain('Cannot find module');
  });
});

function execFileOrThrow(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'pipe',
  });
}

function runNativeMindpass(args: string[], options: { env?: NodeJS.ProcessEnv } = {}): Promise<RunResult> {
  return new Promise((resolveResult, reject) => {
    execFile(
      nativeBinaryPath!,
      args,
      {
        cwd: repoRoot,
        env: options.env ?? process.env,
        timeout: 10_000,
      },
      (error, stdout, stderr) => {
        if (error && 'killed' in error && error.killed) {
          reject(error);
          return;
        }

        resolveResult({
          code: error && 'code' in error ? (error.code as number | null) : 0,
          stdout,
          stderr,
        });
      },
    );
  });
}
