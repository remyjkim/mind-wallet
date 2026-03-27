// ABOUTME: Shared subprocess helpers for black-box CLI binary tests
// ABOUTME: Builds the CLI once and captures exit code, stdout, and stderr from dist/cli.js

import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CliRunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface CliRunOptions {
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
  timeoutMs?: number;
}

const cliDir = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(cliDir);
const repoRoot = join(packageDir, '..', '..');
const distCliPath = join(packageDir, 'dist', 'cli.js');
const buildLockDir = join(packageDir, '.build-lock');

let buildOncePromise: Promise<string> | undefined;

export function buildCliOnce(): Promise<string> {
  if (!buildOncePromise) {
    rmSync(buildLockDir, { recursive: true, force: true });
    buildOncePromise = buildCliWithLock();
  }

  return buildOncePromise;
}

async function buildCliWithLock(): Promise<string> {
  while (true) {
    try {
      mkdirSync(buildLockDir);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
      await sleep(100);
    }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        'bun',
        [
          'run',
          '--filter', '@mindpass/core', 'build',
        ],
        {
          cwd: repoRoot,
          env: process.env,
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          execFile(
            'bun',
            [
              'run',
              '--filter', '@mindpass/protocols', 'build',
            ],
            {
              cwd: repoRoot,
              env: process.env,
            },
            (error2) => {
              if (error2) {
                reject(error2);
                return;
              }

              execFile(
                'bun',
                [
                  'run',
                  '--filter', '@mindpass/discovery', 'build',
                ],
                {
                  cwd: repoRoot,
                  env: process.env,
                },
                (error3) => {
                  if (error3) {
                    reject(error3);
                    return;
                  }

                  execFile(
                    'bun',
                    [
                      'run',
                      '--filter', 'mindpass-cli', 'build',
                    ],
                    {
                      cwd: repoRoot,
                      env: process.env,
                    },
                    (error4) => {
                      if (error4) {
                        reject(error4);
                        return;
                      }

                      resolve();
                    },
                  );
                },
              );
            },
          );
        },
      );
    });

    return distCliPath;
  } finally {
    rmSync(buildLockDir, { recursive: true, force: true });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runMindpass(options: CliRunOptions): Promise<CliRunResult> {
  const child = await spawnMindpass(options);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timeoutMs = options.timeoutMs ?? 10_000;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`mindpass process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }
    child.stdin.end();
  });
}

export async function spawnMindpass(options: CliRunOptions): Promise<ChildProcessWithoutNullStreams> {
  await waitForBuildToSettle();
  const cliPath = await buildCliOnce();

  const child = spawn(process.execPath, [cliPath, ...options.args], {
    cwd: options.cwd ?? packageDir,
    env: options.env ?? process.env,
    stdio: 'pipe',
  });

  return child;
}

async function waitForBuildToSettle(): Promise<void> {
  while (existsSync(buildLockDir)) {
    await sleep(50);
  }
}

export function makeTempConfigHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'mindpass-cli-home-'));
  mkdirSync(join(home, '.config', 'mindpass'), { recursive: true });
  return home;
}

export function writeMindpassConfig(dir: string, config: Record<string, unknown>): string {
  const path = join(dir, '.config', 'mindpass', 'config.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2));
  return path;
}

export function writeRawConfig(dir: string, raw: string): string {
  const path = join(dir, '.config', 'mindpass', 'config.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, raw);
  return path;
}
