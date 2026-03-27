// ABOUTME: Black-box tests for the compiled mindwallet binary help and usage UX
// ABOUTME: Verifies process-level exit codes and stdio output for the real CLI entrypoint

import { describe, expect, it } from 'vitest';
import { runMindwallet } from './cli-binary-test-helpers.js';

describe('mindwallet binary help UX', () => {
  it('prints help with no arguments', async () => {
    const result = await runMindwallet({ args: [] });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('mindwallet wallet');
    expect(result.stderr).toBe('');
  });

  it('runs the built CLI and prints help', async () => {
    const result = await runMindwallet({ args: ['--help'] });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('mindwallet');
  });

  it('prints help with help command', async () => {
    const result = await runMindwallet({ args: ['help'] });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stderr).toBe('');
  });

  it('prints the package version with --version', async () => {
    const result = await runMindwallet({ args: ['--version'] });

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('0.1.1');
    expect(result.stderr).toBe('');
  });

  it('prints help with -h', async () => {
    const result = await runMindwallet({ args: ['-h'] });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stderr).toBe('');
  });

  it('returns an error for an unknown command', async () => {
    const result = await runMindwallet({ args: ['nope'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unknown command: nope');
    expect(result.stdout).toContain('Usage:');
  });

  it('returns usage error for fetch without a URL', async () => {
    const result = await runMindwallet({ args: ['fetch'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindwallet fetch <url>');
  });

  it('returns usage error for pay without a URL', async () => {
    const result = await runMindwallet({ args: ['pay'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindwallet pay <url>');
  });

  it('returns usage error for discover without an origin', async () => {
    const result = await runMindwallet({ args: ['discover'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindwallet discover <origin>');
  });

  it('returns usage error for search without a query', async () => {
    const result = await runMindwallet({ args: ['search'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindwallet search <query>');
  });

  it('returns usage error for key create without a name', async () => {
    const result = await runMindwallet({ args: ['key', 'create'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindwallet key create <name>');
  });

  it('returns usage error for key revoke without an id', async () => {
    const result = await runMindwallet({ args: ['key', 'revoke'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: mindwallet key revoke <key-id>');
  });

  it('returns an error for an unknown key subcommand', async () => {
    const result = await runMindwallet({ args: ['key', 'bogus'] });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unknown key subcommand: bogus');
  });
});
