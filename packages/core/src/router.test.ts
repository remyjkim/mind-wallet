// packages/core/src/router.test.ts
import { describe, it, expect } from 'vitest';
import { createRouter } from './router.js';
import { createMemoryStore } from './state/memory.js';

describe('createRouter', () => {
  it('returns a router with a select method', () => {
    const router = createRouter({
      methods: [],
      state: createMemoryStore(),
      policy: [],
    });
    expect(typeof router.select).toBe('function');
  });

  it('exposes the configured methods array', () => {
    const router = createRouter({
      methods: [],
      state: createMemoryStore(),
      policy: [],
    });
    expect(router.methods).toEqual([]);
  });
});
