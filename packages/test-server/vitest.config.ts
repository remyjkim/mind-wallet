// ABOUTME: Vitest configuration for test-server smoke tests
// ABOUTME: Enables global test APIs (describe, it, expect)

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
});
