import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@mindwallet/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    server: {
      deps: {
        // NAPI-RS native bindings cannot be bundled by Vite — must be loaded from node_modules
        external: ['@open-wallet-standard/core'],
      },
    },
  },
});
