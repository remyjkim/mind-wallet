import { describe, expect, it } from 'vitest';
import { CLI_VERSION } from './version.js';

describe('CLI_VERSION', () => {
  it('is a non-empty string', () => {
    expect(CLI_VERSION).toMatch(/\S+/);
  });
});
