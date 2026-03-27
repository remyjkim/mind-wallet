// ABOUTME: Black-box tests for the compiled mindpass binary help and usage UX
// ABOUTME: Verifies process-level exit codes and stdio output for the real CLI entrypoint

import { beforeAll, describe, expect, it } from 'vitest';
import { buildCliOnce, runMindpass } from './cli-binary-test-helpers.js';

describe('mindpass binary help UX', () => {
  beforeAll(async () => {
    await buildCliOnce();
  }, 60_000);

  it('prints help with no arguments', async () => {
    const result = await runMindpass({ args: [] });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('mindpass wallet');
    expect(result.stderr).toBe('');
  });

  it('runs the built CLI and prints help', async () => {
    const result = await runMindpass({ args: ['--help'] });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('mindpass');
  });

  it('prints help with help command', async () => {
    const result = await runMindpass({ args: ['help'] });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stderr).toBe('');
  });

  it('prints the package version with --version', async () => {
    const result = await runMindpass({ args: ['--version'] });

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('0.2.0');
    expect(result.stderr).toBe('');
  });

  it('prints help with -h', async () => {
    const result = await runMindpass({ args: ['-h'] });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stderr).toBe('');
  });

  it('returns an error for an unknown command', async () => {
    const result = await runMindpass({ args: ['nope'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unknown command: nope');
    expect(result.stdout).toContain('Usage:');
  });

  it('returns usage error for fetch without a URL', async () => {
    const result = await runMindpass({ args: ['fetch'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindpass fetch <url>');
  });

  it('returns usage error for pay without a URL', async () => {
    const result = await runMindpass({ args: ['pay'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindpass pay <url>');
  });

  it('returns usage error for discover without an origin', async () => {
    const result = await runMindpass({ args: ['discover'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindpass discover <origin>');
  });

  it('returns usage error for search without a query', async () => {
    const result = await runMindpass({ args: ['search'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindpass search <query>');
  });

  it('returns usage error for key create without a name', async () => {
    const result = await runMindpass({ args: ['key', 'create'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindpass key create <name>');
  });

  it('returns usage error for key revoke without an id', async () => {
    const result = await runMindpass({ args: ['key', 'revoke'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindpass key revoke <key-id>');
  });

  it('returns an error for an unknown key subcommand', async () => {
    const result = await runMindpass({ args: ['key', 'bogus'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unknown key subcommand: bogus');
  });
});
