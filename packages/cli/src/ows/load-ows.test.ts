import { describe, expect, it } from 'vitest';
import { loadOws } from './load-ows.js';

describe('loadOws', () => {
  it('returns bindings only when explicitly called', async () => {
    await expect(loadOws()).resolves.toBeDefined();
  });
});
