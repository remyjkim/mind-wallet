// ABOUTME: Shared subprocess helpers for black-box CLI binary tests
// ABOUTME: Builds the CLI once and captures exit code, stdout, and stderr from dist/cli.js

import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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
const distCliPath = join(packageDir, 'dist', 'cli.js');

let buildOncePromise: Promise<string> | undefined;

export function buildCliOnce(): Promise<string> {
  if (!buildOncePromise) {
    buildOncePromise = new Promise((resolve, reject) => {
      execFile(
        'pnpm',
        ['build'],
        {
          cwd: packageDir,
          env: process.env,
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(distCliPath);
        },
      );
    });
  }

  return buildOncePromise;
}

export async function runMindwallet(options: CliRunOptions): Promise<CliRunResult> {
  const child = await spawnMindwallet(options);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timeoutMs = options.timeoutMs ?? 10_000;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`mindwallet process timed out after ${timeoutMs}ms`));
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

export async function spawnMindwallet(options: CliRunOptions): Promise<ChildProcessWithoutNullStreams> {
  const cliPath = await buildCliOnce();

  const child = spawn(process.execPath, [cliPath, ...options.args], {
    cwd: options.cwd ?? packageDir,
    env: options.env ?? process.env,
    stdio: 'pipe',
  });

  return child;
}

export function makeTempConfigHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'mindwallet-cli-home-'));
  mkdirSync(join(home, '.config', 'mindwallet'), { recursive: true });
  return home;
}

export function writeMindwalletConfig(dir: string, config: Record<string, unknown>): string {
  const path = join(dir, '.config', 'mindwallet', 'config.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2));
  return path;
}

export function writeRawConfig(dir: string, raw: string): string {
  const path = join(dir, '.config', 'mindwallet', 'config.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, raw);
  return path;
}
